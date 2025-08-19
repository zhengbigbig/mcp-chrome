import React, { useState, useRef, useEffect } from 'react';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'server' | 'client';
  message: string;
  data?: any;
}

interface ClientPanelProps {
  logs: LogEntry[];
  status: 'disconnected' | 'connecting' | 'connected';
  ollamaStatus: 'disconnected' | 'connecting' | 'connected';
  onAddLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  onUpdateStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onUpdateOllamaStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onClearLogs: () => void;
}

const ClientPanel: React.FC<ClientPanelProps> = ({
  logs,
  status,
  ollamaStatus,
  onAddLog,
  onUpdateStatus,
  onUpdateOllamaStatus,
  onClearLogs,
}) => {
  const [userInput, setUserInput] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('deepseek-r1:1.5b');
  const logAreaRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [logs]);

  // 模拟连接到 MCP Server
  const handleConnectMCP = async () => {
    onUpdateStatus('connecting');
    onAddLog({
      type: 'info',
      message: '正在连接到 MCP Server...',
    });

    setTimeout(() => {
      onUpdateStatus('connected');
      onAddLog({
        type: 'success',
        message: '✅ 已连接到 MCP Server',
      });
      
      onAddLog({
        type: 'client',
        message: '📋 正在获取可用工具列表...',
      });

      // 模拟获取工具列表
      setTimeout(() => {
        onAddLog({
          type: 'success',
          message: '✅ 获取到 3 个可用工具: echo, calculate, get_time',
          data: {
            tools: [
              { name: 'echo', description: '回显输入的文本' },
              { name: 'calculate', description: '执行简单的数学计算' },
              { name: 'get_time', description: '获取当前时间' },
            ],
          },
        });
      }, 800);
    }, 1200);
  };

  // 模拟连接到 Ollama
  const handleConnectOllama = async () => {
    onUpdateOllamaStatus('connecting');
    onAddLog({
      type: 'info',
      message: `正在连接到 Ollama: ${ollamaUrl}`,
    });

    setTimeout(() => {
      const isSuccess = Math.random() > 0.3; // 70% 成功率模拟
      
      if (isSuccess) {
        onUpdateOllamaStatus('connected');
        onAddLog({
          type: 'success',
          message: `✅ 已连接到 Ollama，模型: ${ollamaModel}`,
        });
        
        onAddLog({
          type: 'client',
          message: '🤖 AI 模型已就绪，可以开始对话',
        });
      } else {
        onUpdateOllamaStatus('disconnected');
        onAddLog({
          type: 'error',
          message: '❌ 连接 Ollama 失败，请检查服务是否运行',
        });
      }
    }, 2000);
  };

  // 断开连接
  const handleDisconnect = () => {
    onUpdateStatus('disconnected');
    onUpdateOllamaStatus('disconnected');
    onAddLog({
      type: 'warning',
      message: '⚠️ 已断开所有连接',
    });
  };

  // 处理用户输入
  const handleUserInput = async () => {
    if (!userInput.trim()) return;

    const input = userInput.trim();
    setUserInput('');

    onAddLog({
      type: 'info',
      message: `👤 用户输入: ${input}`,
    });

    // 模拟智能处理
    const isToolCall = /回显|echo|计算|算|时间|几点/.test(input.toLowerCase());
    
    if (isToolCall && status === 'connected') {
      // 使用 MCP 工具
      let toolName = '';
      let args: any = {};

      if (/回显|echo/.test(input.toLowerCase())) {
        toolName = 'echo';
        args = { text: input.replace(/.*?回显|.*?echo/i, '').trim() };
      } else if (/计算|算/.test(input.toLowerCase())) {
        toolName = 'calculate';
        const mathMatch = input.match(/[\d+\-*/.() ]+/);
        args = { expression: mathMatch?.[0]?.trim() || '1+1' };
      } else if (/时间|几点/.test(input.toLowerCase())) {
        toolName = 'get_time';
        args = {};
      }

      onAddLog({
        type: 'client',
        message: `🔧 调用工具: ${toolName}`,
        data: { tool: toolName, args },
      });

      // 模拟工具调用延迟
      setTimeout(() => {
        let result = '';
        switch (toolName) {
          case 'echo':
            result = `回显: ${args.text}`;
            break;
          case 'calculate':
            try {
              const safeResult = eval(args.expression.replace(/[^0-9+\-*/.() ]/g, ''));
              result = `计算结果: ${args.expression} = ${safeResult}`;
            } catch (e) {
              result = '计算错误: 无效表达式';
            }
            break;
          case 'get_time':
            result = `当前时间: ${new Date().toLocaleString('zh-CN')}`;
            break;
        }

        onAddLog({
          type: 'success',
          message: `🤖 工具响应: ${result}`,
        });
      }, 800);
      
    } else if (ollamaStatus === 'connected') {
      // 使用 AI 模型
      onAddLog({
        type: 'client',
        message: '🤖 正在生成 AI 响应...',
      });

      // 模拟 AI 响应
      setTimeout(() => {
        const responses = [
          '这是一个模拟的 AI 响应。在实际环境中，这里会显示 deepseek-r1:1.5b 模型的真实回答。',
          '我是 DeepSeek-R1 模型，这是一个调试环境的模拟响应。实际使用时会连接到真正的 Ollama 服务。',
          '您的问题很有趣！在真实环境中，我会基于我的训练数据给出更准确的回答。',
          '这是 MCP Client 的调试模式。真实的对话会通过 Ollama API 与 deepseek-r1:1.5b 模型进行。',
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        onAddLog({
          type: 'success',
          message: `🤖 AI 响应: ${randomResponse}`,
        });
      }, 1500);
      
    } else {
      onAddLog({
        type: 'warning',
        message: '⚠️ 请先连接到 MCP Server 或 Ollama 服务',
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

  return (
    <div className="panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="panel-title">MCP Client</span>
          <div className={`status-indicator status-${status}`}></div>
          <span style={{ marginLeft: '12px', fontSize: '12px', color: '#999' }}>
            Ollama:
          </span>
          <div className={`status-indicator status-${ollamaStatus}`}></div>
        </div>
        <div className="controls">
          {status === 'disconnected' ? (
            <button className="btn" onClick={handleConnectMCP}>
              连接 MCP
            </button>
          ) : (
            <button className="btn secondary" onClick={handleDisconnect}>
              断开连接
            </button>
          )}
          {ollamaStatus === 'disconnected' ? (
            <button className="btn" onClick={handleConnectOllama}>
              连接 Ollama
            </button>
          ) : null}
          <button className="btn secondary" onClick={onClearLogs}>
            清空日志
          </button>
        </div>
      </div>

      <div className="config-section">
        <div className="config-row">
          <span className="config-label">Ollama URL:</span>
          <input
            className="config-input"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>
        <div className="config-row">
          <span className="config-label">模型:</span>
          <input
            className="config-input"
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            placeholder="deepseek-r1:1.5b"
          />
        </div>
      </div>

      <div className="panel-content">
        <div className="log-area scrollbar-thin" ref={logAreaRef}>
          {logs.map((log) => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <span className="timestamp">{formatTimestamp(log.timestamp)}</span>
              <span>{log.message}</span>
              {log.data && (
                <div className="json-viewer">
                  <pre>{JSON.stringify(log.data, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="input-area">
          <div className="input-form">
            <input
              className="input-field"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入消息... (支持: 回显文本、计算表达式、查看时间、或直接与AI对话)"
              onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
              disabled={status === 'disconnected' && ollamaStatus === 'disconnected'}
            />
            <button
              className="btn"
              onClick={handleUserInput}
              disabled={status === 'disconnected' && ollamaStatus === 'disconnected'}
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPanel;
