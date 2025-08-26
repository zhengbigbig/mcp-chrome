import React, { useState, useEffect, useRef } from 'react';
import { MCPReasoningEngine, ReasoningStepType } from '../../utils/mcp-reasoning';
import { UserInteraction, InteractionResult } from '../../utils/user-interaction';
import './App.css';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'user' | 'reasoning' | 'tool' | 'ai';
  message: string;
  data?: any;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: any;
  serverName: string;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  parameter_size: string;
  family: string;
}

const App: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [userInput, setUserInput] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [toolArgs, setToolArgs] = useState('{}');
  const [isLoading, setIsLoading] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [serverStatus, setServerStatus] = useState<'disconnected' | 'connected'>('disconnected');
  const [ollamaStatus, setOllamaStatus] = useState<'disconnected' | 'connected'>('disconnected');
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [currentModel, setCurrentModel] = useState('deepseek-r1:1.5b');
  const [reasoningEngine] = useState(() => new MCPReasoningEngine());
  const logAreaRef = useRef<HTMLDivElement>(null);
  
  // 日志管理状态
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error' | 'user' | 'tool'>('all');
  const [showLogData, setShowLogData] = useState<Set<string>>(new Set());

  // Server 管理状态
  const [servers, setServers] = useState<any[]>([]);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [newServerConfig, setNewServerConfig] = useState({
    name: '',
    displayName: '',
    type: 'http' as const,
    endpoint: '',
    priority: 5,
    auth: { type: 'none' as const },
  });

  // 交互状态
  const [pendingInteraction, setPendingInteraction] = useState<UserInteraction | null>(null);
  const [interactionInput, setInteractionInput] = useState('');
  const [executionState, setExecutionState] = useState({
    isExecuting: false,
    currentPlan: null as any,
    pendingInteractions: [] as any[],
    contextSize: 0,
  });

  // 自动滚动到底部
  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [logs]);

  // 添加日志条目
  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const logEntry: LogEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    setLogs(prev => {
      const newLogs = [...prev, logEntry];
      // 保留最近200条，增加日志容量
      if (newLogs.length > 200) {
        return newLogs.slice(-200);
      }
      return newLogs;
    });
  };

  // 初始化时获取工具列表
  useEffect(() => {
    addLog({
      type: 'info',
      message: '🚀 MCP Browser Extension 已启动',
    });

    // 设置交互处理器
    reasoningEngine.setInteractionHandler(handleUserInteraction);

    loadTools();
    checkOllamaStatus();
    loadAvailableModels();
    loadServers();

    // 定期更新执行状态
    const statusInterval = setInterval(() => {
      setExecutionState(reasoningEngine.getExecutionState());
    }, 1000);

    return () => clearInterval(statusInterval);
  }, []);

  // 加载工具列表
  const loadTools = async () => {
    try {
      // 从推理引擎获取所有工具（包括多个 server 的工具）
      const allTools = reasoningEngine.getAvailableTools();
      
      // 转换为 UI 需要的格式
      const uiTools = allTools.map(tool => ({
        name: tool.name,
        description: tool.description || '无描述',
        inputSchema: tool.inputSchema || {},
        serverName: tool.serverName || 'unknown',
      }));
      
      setTools(uiTools);
      setServerStatus('connected');
      
      const serverNames = [...new Set(allTools.map(t => t.serverName))];
      addLog({
        type: 'success',
        message: `✅ 已加载 ${allTools.length} 个工具，来自 ${serverNames.length} 个服务器`,
        data: { 
          tools: allTools.map(t => `${t.serverName}.${t.name}`),
          servers: serverNames
        },
      });
    } catch (error) {
      setServerStatus('disconnected');
      addLog({
        type: 'error',
        message: `❌ 获取工具列表失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 检查 Ollama 状态
  const checkOllamaStatus = async () => {
    try {
      addLog({
        type: 'info',
        message: '🔍 正在检查 Ollama 连接...',
      });

      const response = await chrome.runtime.sendMessage({
        type: 'OLLAMA_REQUEST',
        url: 'http://localhost:11434/api/tags',
        data: null, // 使用 GET 请求
      });

      console.log('[Sidepanel] Ollama 检查响应:', response);

      if (response.success && response.result) {
        setOllamaStatus('connected');
        const models = response.result.models || [];
        const hasDeepseek = models.some((model: any) => model.name === 'deepseek-r1:1.5b');
        
        addLog({
          type: 'success',
          message: `✅ Ollama 服务可用，发现 ${models.length} 个模型`,
          data: { models: models.map((m: any) => m.name) },
        });

        if (hasDeepseek) {
          addLog({
            type: 'success',
            message: '✅ deepseek-r1:1.5b 模型已安装',
          });
        } else {
          addLog({
            type: 'warning',
            message: '⚠️ 未找到 deepseek-r1:1.5b 模型',
          });
        }
      } else {
        setOllamaStatus('disconnected');
        addLog({
          type: 'error',
          message: `❌ Ollama 连接失败: ${response.error || '未知错误'}`,
        });
      }
    } catch (error) {
      setOllamaStatus('disconnected');
      addLog({
        type: 'error',
        message: `❌ 无法连接到 Ollama 服务: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 加载可用模型列表
  const loadAvailableModels = async () => {
    try {
      const models = await reasoningEngine.loadAvailableModels();
      setAvailableModels(models);
      
      // 恢复用户的模型选择
      await reasoningEngine.restoreModelChoice();
      setCurrentModel(reasoningEngine.getCurrentModel());
      
      if (models.length > 0) {
        addLog({
          type: 'info',
          message: `📦 发现 ${models.length} 个可用模型`,
          data: { models: models.map(m => `${m.name} (${m.parameter_size})`) },
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 加载模型列表失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 切换模型
  const handleModelSwitch = async (modelName: string) => {
    try {
      const success = await reasoningEngine.switchModel(modelName);
      if (success) {
        setCurrentModel(modelName);
        addLog({
          type: 'success',
          message: `🔄 已切换到模型: ${modelName}`,
        });
      } else {
        addLog({
          type: 'error',
          message: `❌ 切换模型失败: ${modelName}`,
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 模型切换错误: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 用户交互处理器
  const handleUserInteraction = async (interaction: UserInteraction): Promise<InteractionResult> => {
    setPendingInteraction(interaction);
    setInteractionInput(interaction.defaultValue || '');

    addLog({
      type: 'warning',
      message: `💬 需要用户确认: ${interaction.title}`,
      data: { message: interaction.message },
    });

    return new Promise((resolve) => {
      const handleInteractionResponse = (confirmed: boolean, value?: any) => {
        setPendingInteraction(null);
        setInteractionInput('');
        
        const result: InteractionResult = {
          id: interaction.id,
          confirmed,
          value,
          timedOut: false,
          timestamp: Date.now(),
        };

        addLog({
          type: confirmed ? 'success' : 'warning',
          message: `✅ 用户${confirmed ? '确认' : '取消'}了操作`,
          data: result,
        });

        resolve(result);
      };

      // 设置临时处理器（在组件状态中）
      (window as any).currentInteractionHandler = handleInteractionResponse;
    });
  };

  // 确认当前交互
  const confirmInteraction = () => {
    if ((window as any).currentInteractionHandler) {
      const value = pendingInteraction?.type === 'input' ? interactionInput : true;
      (window as any).currentInteractionHandler(true, value);
    }
  };

  // 取消当前交互
  const cancelInteraction = () => {
    if ((window as any).currentInteractionHandler) {
      (window as any).currentInteractionHandler(false);
    }
  };

  // 选择交互选项
  const selectInteractionOption = (optionValue: any) => {
    if ((window as any).currentInteractionHandler) {
      (window as any).currentInteractionHandler(true, optionValue);
    }
  };

  // 取消当前执行
  const cancelExecution = () => {
    const cancelled = reasoningEngine.cancelExecution();
    if (cancelled) {
      addLog({
        type: 'warning',
        message: '❌ 用户取消了当前执行',
      });
      setIsReasoning(false);
    }
  };



  // 智能推理处理用户输入
  const handleUserInput = async () => {
    if (!userInput.trim() || isLoading || isReasoning) return;

    const input = userInput.trim();
    setUserInput('');
    setIsReasoning(true);

    addLog({
      type: 'user',
      message: `👤 ${input}`,
    });

    try {
      // 使用流式推理
      const reasoningStream = reasoningEngine.reasonStream(input);
      
      for await (const step of reasoningStream) {
        switch (step.type) {
          case 'start':
            addLog({
              type: 'reasoning',
              message: `🧠 ${step.content}`,
            });
            break;
            
          case 'analysis':
            addLog({
              type: 'reasoning',
              message: `🔍 ${step.content}`,
            });
            break;
            
          case 'tools_selected':
            addLog({
              type: 'tool',
              message: `🔧 ${step.content.message}`,
              data: step.content.tools,
            });
            break;
            
          case 'tool_executing':
            addLog({
              type: 'tool',
              message: `⚙️ ${step.content}`,
            });
            break;
            
          case 'tool_result': {
            const { tool, result } = step.content;
            const resultMessage = result.success 
              ? (result.result.content ? result.result.content[0]?.text : JSON.stringify(result.result))
              : `错误: ${result.result.error}`;
            addLog({
              type: result.success ? 'success' : 'error',
              message: `🔧 ${tool}: ${resultMessage}`,
            });
            break;
          }
            
          case 'synthesis':
            addLog({
              type: 'reasoning',
              message: `🤖 ${step.content}`,
            });
            break;
            
          case 'direct_answer':
            addLog({
              type: 'reasoning',
              message: `💭 ${step.content}`,
            });
            break;
            
          case 'complete':
            addLog({
              type: 'ai',
              message: `🤖 ${step.content.finalResponse}`,
              data: {
                confidence: step.content.confidence,
                toolsUsed: step.content.toolCalls.length,
              },
            });
            break;
            
          case 'error':
            addLog({
              type: 'error',
              message: `❌ ${step.content}`,
            });
            break;
        }
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 推理失败: ${error instanceof Error ? error.message : error}`,
      });
    } finally {
      setIsReasoning(false);
    }
  };

  // 调用工具 - 使用推理引擎支持多服务器
  const callTool = async (name: string, args: any = {}) => {
    try {
      addLog({
        type: 'info',
        message: `🔧 调用工具: ${name}`,
        data: { args },
      });

      // 使用推理引擎调用工具，自动选择合适的服务器
      const response = await reasoningEngine.callToolDirectly(name, args);

      if (response.success) {
        const result = response.result;
        if (result.content && result.content.length > 0) {
          addLog({
            type: 'success',
            message: `✅ ${name}: ${result.content[0].text}`,
            data: { server: response.serverName, latency: response.latency },
          });
        } else {
          addLog({
            type: 'success',
            message: '🔧 工具执行完成',
            data: { server: response.serverName, latency: response.latency },
          });
        }
      } else {
        addLog({
          type: 'error',
          message: `❌ 工具调用失败: ${response.error || '未知错误'}`,
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 工具调用失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 手动调用工具
  const handleManualToolCall = async () => {
    if (!selectedTool) return;

    try {
      const args = JSON.parse(toolArgs);
      await callTool(selectedTool, args);
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 参数解析失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 清空日志
  const clearLogs = () => {
    setLogs([]);
  };

  // Server 管理方法
  const loadServers = async () => {
    try {
      const serverList = await reasoningEngine.getAllServers();
      setServers(serverList);
      addLog({
        type: 'info',
        message: `📡 已加载 ${serverList.length} 个 Server`,
      });
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 加载 Server 列表失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  const addServer = async () => {
    try {
      const success = await reasoningEngine.addServer(newServerConfig);
      if (success) {
        setShowAddServerModal(false);
        setNewServerConfig({
          name: '',
          displayName: '',
          type: 'http',
          endpoint: '',
          priority: 5,
          auth: { type: 'none' },
        });
        await loadServers();
        await loadTools(); // 重新加载工具列表
        addLog({
          type: 'success',
          message: `✅ 成功添加 Server: ${newServerConfig.displayName}`,
        });
      } else {
        addLog({
          type: 'error',
          message: `❌ 添加 Server 失败: ${newServerConfig.displayName}`,
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 添加 Server 错误: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  const removeServer = async (serverName: string) => {
    try {
      const success = await reasoningEngine.removeServer(serverName);
      if (success) {
        await loadServers();
        await loadTools(); // 重新加载工具列表
        addLog({
          type: 'success',
          message: `✅ 成功移除 Server: ${serverName}`,
        });
      } else {
        addLog({
          type: 'error',
          message: `❌ 移除 Server 失败: ${serverName}`,
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 移除 Server 错误: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  const healthCheckServer = async (serverName: string) => {
    try {
      addLog({
        type: 'info',
        message: `🔍 正在检查 Server: ${serverName}`,
      });
      
      await reasoningEngine.healthCheckServers();
      await loadServers();
      await loadTools(); // 重新加载工具列表
      
      addLog({
        type: 'success',
        message: `✅ Server 健康检查完成: ${serverName}`,
      });
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ Server 健康检查失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    if (logFilter === 'all') return true;
    return log.type === logFilter;
  });

  // 切换日志数据显示
  const toggleLogData = (logId: string) => {
    setShowLogData(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  return (
    <div className="app">
      <div className="header">
        <h1>🧠 MCP Reasoning Engine</h1>
        <div className="status-bar">
          <div className={`status-indicator ${serverStatus}`}>
            MCP Server: {serverStatus === 'connected' ? '✅' : '❌'}
          </div>
          <div className={`status-indicator ${ollamaStatus}`}>
            Ollama: {ollamaStatus === 'connected' ? '✅' : '❌'}
          </div>
          <div className="model-info">
            当前模型: {currentModel}
          </div>
          <button 
            onClick={checkOllamaStatus}
            className="btn small secondary"
            style={{ marginLeft: '8px' }}
          >
            重新连接
          </button>
        </div>
      </div>

      {/* Server 管理 */}
      <div className="servers-section">
        <h3>🌐 Server 管理</h3>
        <div className="server-controls">
          <button 
            onClick={() => setShowAddServerModal(true)}
            className="btn primary small"
          >
            添加 Server
          </button>
          <button 
            onClick={loadServers}
            className="btn secondary small"
            style={{ marginLeft: '8px' }}
          >
            刷新
          </button>
        </div>
        
        <div className="server-list">
          {servers.map((server) => (
            <div key={server.name} className={`server-card ${server.status.status}`}>
              <div className="server-header">
                <span className="server-name">{server.config.displayName}</span>
                <span className={`server-status ${server.status.status}`}>
                  {server.status.status === 'connected' ? '🟢' : 
                   server.status.status === 'connecting' ? '🟡' : '🔴'}
                </span>
              </div>
              <div className="server-details">
                <p className="server-type">类型: {server.config.type}</p>
                {server.config.endpoint && (
                  <p className="server-endpoint">端点: {server.config.endpoint}</p>
                )}
                <p className="server-tools">
                  工具: {server.status.tools?.length || 0} 个
                </p>
                {server.status.latency && (
                  <p className="server-latency">延迟: {server.status.latency}ms</p>
                )}
              </div>
              <div className="server-actions">
                <button 
                  onClick={() => removeServer(server.config.name)}
                  className="btn danger small"
                >
                  移除
                </button>
                <button 
                  onClick={() => healthCheckServer(server.config.name)}
                  className="btn secondary small"
                  style={{ marginLeft: '4px' }}
                >
                  检查
                </button>
              </div>
            </div>
          ))}
          
          {servers.length === 0 && (
            <div className="no-servers">
              <p>暂无配置的 Server</p>
              <p>点击"添加 Server"开始配置</p>
            </div>
          )}
        </div>
      </div>

      <div className="tools-section">
        <h3>🔧 工具管理</h3>
        <div className="tool-controls">
          <select 
            value={selectedTool} 
            onChange={(e) => setSelectedTool(e.target.value)}
            className="tool-selector"
          >
            <option value="">选择工具...</option>
            {tools.map((tool) => (
              <option key={`${tool.serverName}.${tool.name}`} value={tool.name}>
                {tool.serverName}.{tool.name} - {tool.description}
              </option>
            ))}
          </select>
          
          <input
            type="text"
            value={toolArgs}
            onChange={(e) => setToolArgs(e.target.value)}
            placeholder='{"text": "Hello"}'
            className="tool-args"
          />
          
          <button 
            onClick={handleManualToolCall}
            disabled={!selectedTool}
            className="btn"
          >
            执行
          </button>
        </div>
      </div>

      <div className="input-section">
        <h3>🧠 智能推理助手</h3>
        
        <div className="model-selector-section">
          <label className="model-selector-label">🤖 选择模型:</label>
          <select 
            value={currentModel} 
            onChange={(e) => handleModelSwitch(e.target.value)}
            className="model-selector"
            disabled={availableModels.length === 0}
          >
            {availableModels.length === 0 ? (
              <option value="">加载中...</option>
            ) : (
              availableModels.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name} ({model.parameter_size}) - {model.family}
                </option>
              ))
            )}
          </select>
          <button 
            onClick={loadAvailableModels}
            className="btn small secondary"
            style={{ marginLeft: '8px' }}
          >
            刷新模型
          </button>
        </div>
        
        <div className="input-controls">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="描述你想要做什么，我会自动选择工具并推理..."
            onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
            disabled={isLoading}
            className="user-input"
          />
          <button 
            onClick={handleUserInput}
            disabled={isLoading || isReasoning || !userInput.trim()}
            className="btn primary"
          >
            {isReasoning ? '🧠 推理中...' : isLoading ? '⏳' : '发送'}
          </button>
          {executionState.isExecuting && (
            <button 
              onClick={cancelExecution}
              className="btn danger"
              style={{ marginLeft: '8px' }}
            >
              取消执行
            </button>
          )}
        </div>
        
        <div className="quick-actions">
          <button onClick={() => setUserInput('帮我算一下 15 乘以 8 再加上 7 等于多少')} className="btn small">
            智能计算
          </button>
          <button onClick={() => setUserInput('告诉我当前页面的详细信息')} className="btn small">
            分析页面
          </button>
          <button onClick={() => setUserInput('现在是什么时间？')} className="btn small">
            查询时间
          </button>
          <button onClick={() => setUserInput('请滚动到页面顶部')} className="btn small">
            控制页面
          </button>
          <button onClick={() => setUserInput(`你好！我是使用 ${currentModel} 模型的智能助手，请介绍你的功能`)} className="btn small">
            模型自介绍
          </button>
        </div>
      </div>

      {/* 用户交互区域 */}
      {pendingInteraction && (
        <div className="interaction-section">
          <h3>💬 需要确认</h3>
          <div className="interaction-card">
            <h4>{pendingInteraction.title}</h4>
            <p>{pendingInteraction.message}</p>
            
            {pendingInteraction.type === 'input' && (
              <div className="interaction-input">
                <input
                  type="text"
                  value={interactionInput}
                  onChange={(e) => setInteractionInput(e.target.value)}
                  placeholder={pendingInteraction.defaultValue || '请输入...'}
                  className="interaction-text-input"
                />
              </div>
            )}
            
            {pendingInteraction.type === 'choice' && pendingInteraction.options && (
              <div className="interaction-choices">
                {pendingInteraction.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => selectInteractionOption(option.value)}
                    className={`btn ${option.style || 'secondary'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            
            {(pendingInteraction.type === 'confirmation' || pendingInteraction.type === 'input') && (
              <div className="interaction-buttons">
                <button 
                  onClick={confirmInteraction}
                  className="btn primary"
                >
                  确认
                </button>
                <button 
                  onClick={cancelInteraction}
                  className="btn secondary"
                  style={{ marginLeft: '8px' }}
                >
                  取消
                </button>
              </div>
            )}
            
            {pendingInteraction.timeout && (
              <div className="interaction-timeout">
                ⏱️ 超时时间: {Math.round(pendingInteraction.timeout / 1000)}秒
              </div>
            )}
          </div>
        </div>
      )}

      {/* 执行状态显示 */}
      {executionState.isExecuting && (
        <div className="execution-status-section">
          <h4>⚙️ 执行状态</h4>
          <div className="execution-info">
            <p>待处理交互: {executionState.pendingInteractions.length}</p>
            <p>上下文大小: {executionState.contextSize}</p>
            {executionState.currentPlan && (
              <p>执行阶段: {(executionState.currentPlan as any).phases?.length || 0}</p>
            )}
          </div>
        </div>
      )}

      {/* 添加 Server 模态框 */}
      {showAddServerModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>➕ 添加新 Server</h3>
              <button 
                onClick={() => setShowAddServerModal(false)}
                className="btn small secondary"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Server 名称:</label>
                <input
                  type="text"
                  value={newServerConfig.name}
                  onChange={(e) => setNewServerConfig({
                    ...newServerConfig,
                    name: e.target.value
                  })}
                  placeholder="test-server"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>显示名称:</label>
                <input
                  type="text"
                  value={newServerConfig.displayName}
                  onChange={(e) => setNewServerConfig({
                    ...newServerConfig,
                    displayName: e.target.value
                  })}
                  placeholder="测试服务器"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>传输类型:</label>
                <select
                  value={newServerConfig.type}
                  onChange={(e) => setNewServerConfig({
                    ...newServerConfig,
                    type: e.target.value as any
                  })}
                  className="form-select"
                >
                  <option value="http">HTTP</option>
                  <option value="websocket">WebSocket</option>
                  <option value="stdio">STDIO</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>端点地址:</label>
                <input
                  type="text"
                  value={newServerConfig.endpoint}
                  onChange={(e) => setNewServerConfig({
                    ...newServerConfig,
                    endpoint: e.target.value
                  })}
                  placeholder="http://localhost:3001"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>优先级 (1-10):</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newServerConfig.priority}
                  onChange={(e) => setNewServerConfig({
                    ...newServerConfig,
                    priority: parseInt(e.target.value) || 5
                  })}
                  className="form-input"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={addServer}
                className="btn primary"
                disabled={!newServerConfig.name || !newServerConfig.displayName}
              >
                添加
              </button>
              <button 
                onClick={() => setShowAddServerModal(false)}
                className="btn secondary"
                style={{ marginLeft: '8px' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="logs-section">
        <div className="logs-header">
          <h3>📋 日志 ({filteredLogs.length}/{logs.length})</h3>
          <div className="log-controls">
            <select 
              value={logFilter} 
              onChange={(e) => setLogFilter(e.target.value as any)}
              className="log-filter"
            >
              <option value="all">全部</option>
              <option value="info">信息</option>
              <option value="success">成功</option>
              <option value="warning">警告</option>
              <option value="error">错误</option>
              <option value="user">用户</option>
              <option value="tool">工具</option>
            </select>
            <button onClick={clearLogs} className="btn small secondary">
              清空
            </button>
          </div>
        </div>
        
        <div className="log-area" ref={logAreaRef}>
          {filteredLogs.map((log) => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <span className="timestamp">{formatTimestamp(log.timestamp)}</span>
              <span className="message">{log.message}</span>
              {log.data && (
                <button 
                  className="log-toggle"
                  onClick={() => toggleLogData(log.id)}
                  title={showLogData.has(log.id) ? '折叠详情' : '展开详情'}
                >
                  {showLogData.has(log.id) ? '📥' : '📤'}
                </button>
              )}
              {log.data && showLogData.has(log.id) && (
                <div className="log-data">
                  <pre>{JSON.stringify(log.data, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="no-logs">
              <p>暂无 {logFilter === 'all' ? '' : logFilter + ' '}日志</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;