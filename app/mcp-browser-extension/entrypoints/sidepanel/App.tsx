import React, { useState, useEffect, useRef } from 'react';
import { MCPReasoningEngine } from '../../utils/mcp-reasoning';
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
  const [reasoningEngine] = useState(() => new MCPReasoningEngine());
  const logAreaRef = useRef<HTMLDivElement>(null);

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

    setLogs(prev => [...prev, logEntry].slice(-100)); // 保留最近100条
  };

  // 初始化时获取工具列表
  useEffect(() => {
    addLog({
      type: 'info',
      message: '🚀 MCP Browser Extension 已启动',
    });

    loadTools();
    checkOllamaStatus();
  }, []);

  // 加载工具列表
  const loadTools = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'MCP_LIST_TOOLS' });
      if (response.success) {
        setTools(response.tools);
        setServerStatus('connected');
        addLog({
          type: 'success',
          message: `✅ 已连接到 MCP Server，获取到 ${response.tools.length} 个工具`,
          data: response.tools,
        });
      } else {
        setServerStatus('disconnected');
        addLog({
          type: 'error',
          message: '❌ 连接 MCP Server 失败',
        });
      }
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
            
          case 'tool_result':
            const { tool, result } = step.content;
            const resultMessage = result.success 
              ? (result.result.content ? result.result.content[0]?.text : JSON.stringify(result.result))
              : `错误: ${result.result.error}`;
            addLog({
              type: result.success ? 'success' : 'error',
              message: `🔧 ${tool}: ${resultMessage}`,
            });
            break;
            
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

  // 直接在 popup 中处理输入
  const processInputDirectly = async (input: string) => {
    try {
      // 简单的工具识别
      const lowerInput = input.toLowerCase();
      
      if (lowerInput.includes('回显') || lowerInput.includes('echo')) {
        const text = input.replace(/.*?回显|.*?echo/i, '').trim();
        await callTool('echo', { text });
      } else if (lowerInput.includes('计算') || lowerInput.includes('算')) {
        const mathRegex = /[\d+\-*/.() ]+/;
        const match = input.match(mathRegex);
        if (match) {
          await callTool('calculate', { expression: match[0].trim() });
        } else {
          addLog({
            type: 'error',
            message: '❌ 无法识别数学表达式',
          });
        }
      } else if (lowerInput.includes('时间') || lowerInput.includes('现在几点')) {
        await callTool('get_time');
      } else if (lowerInput.includes('页面信息') || lowerInput.includes('页面')) {
        await callTool('get_page_info');
      } else {
        // 使用 Ollama
        if (ollamaStatus === 'connected') {
          await chatWithOllama(input);
        } else {
          addLog({
            type: 'warning',
            message: '⚠️ 无法识别命令，且 Ollama 服务不可用',
          });
        }
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 处理输入失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 调用工具
  const callTool = async (name: string, args: any = {}) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MCP_CALL_TOOL',
        name,
        args,
      });

      if (response.success) {
        const result = response.result;
        if (result.content && result.content.length > 0) {
          addLog({
            type: 'success',
            message: `🔧 ${result.content[0].text}`,
          });
        } else {
          addLog({
            type: 'success',
            message: '🔧 工具执行完成',
          });
        }
      } else {
        addLog({
          type: 'error',
          message: `❌ 工具调用失败: ${response.error}`,
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 工具调用失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 与 Ollama 聊天
  const chatWithOllama = async (message: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OLLAMA_REQUEST',
        url: 'http://localhost:11434/api/generate',
        data: {
          model: 'deepseek-r1:1.5b',
          prompt: message,
          stream: false,
        },
      });

      if (response.success) {
        addLog({
          type: 'success',
          message: `🤖 ${response.result.response || '模型没有返回响应'}`,
        });
      } else {
        addLog({
          type: 'error',
          message: `❌ Ollama 请求失败: ${response.error}`,
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ Ollama 请求失败: ${error instanceof Error ? error.message : error}`,
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

  // 显示浮动面板
  const showFloatingPanel = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
        addLog({
          type: 'info',
          message: '📱 已显示页面浮动面板',
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        message: `❌ 显示浮动面板失败: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  // 清空日志
  const clearLogs = () => {
    setLogs([]);
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
          <button 
            onClick={checkOllamaStatus}
            className="btn small secondary"
            style={{ marginLeft: '8px' }}
          >
            重新连接
          </button>
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
              <option key={tool.name} value={tool.name}>
                {tool.name} - {tool.description}
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
          <button onClick={() => setUserInput('向我问好并介绍你的功能')} className="btn small">
            AI 对话
          </button>
        </div>
      </div>

      <div className="logs-section">
        <div className="logs-header">
          <h3>📋 日志</h3>
          <button onClick={clearLogs} className="btn small secondary">
            清空
          </button>
        </div>
        
        <div className="log-area" ref={logAreaRef}>
          {logs.map((log) => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <span className="timestamp">{formatTimestamp(log.timestamp)}</span>
              <span className="message">{log.message}</span>
              {log.data && (
                <div className="log-data">
                  <pre>{JSON.stringify(log.data, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;