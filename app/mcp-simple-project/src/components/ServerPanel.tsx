import React, { useState, useRef, useEffect } from 'react';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'server' | 'client';
  message: string;
  data?: any;
}

interface ServerPanelProps {
  logs: LogEntry[];
  status: 'disconnected' | 'connecting' | 'connected';
  onAddLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  onUpdateStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onClearLogs: () => void;
}

const ServerPanel: React.FC<ServerPanelProps> = ({
  logs,
  status,
  onAddLog,
  onUpdateStatus,
  onClearLogs,
}) => {
  const [toolCall, setToolCall] = useState('');
  const [toolArgs, setToolArgs] = useState('{}');
  const [selectedTool, setSelectedTool] = useState('echo');
  const logAreaRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [logs]);

  // 模拟服务器启动
  const handleStartServer = async () => {
    onUpdateStatus('connecting');
    onAddLog({
      type: 'info',
      message: '正在启动 MCP Server...',
    });

    // 模拟启动延迟
    setTimeout(() => {
      onUpdateStatus('connected');
      onAddLog({
        type: 'success',
        message: '✅ MCP Server 启动成功，监听 stdio 连接',
      });
      
      onAddLog({
        type: 'server',
        message: '📋 可用工具: echo, calculate, get_time',
      });
    }, 1500);
  };

  // 模拟服务器停止
  const handleStopServer = () => {
    onUpdateStatus('disconnected');
    onAddLog({
      type: 'warning',
      message: '⚠️ MCP Server 已停止',
    });
  };

  // 模拟工具调用
  const handleToolCall = () => {
    if (!toolCall.trim()) return;

    let args: any = {};
    try {
      args = JSON.parse(toolArgs);
    } catch (e) {
      onAddLog({
        type: 'error',
        message: `❌ 参数解析失败: ${e instanceof Error ? e.message : '未知错误'}`,
      });
      return;
    }

    onAddLog({
      type: 'info',
      message: `📞 收到工具调用: ${selectedTool}`,
      data: { tool: selectedTool, args },
    });

    // 模拟工具执行
    setTimeout(() => {
      let result = '';
      switch (selectedTool) {
        case 'echo':
          result = `回显: ${args.text || ''}`;
          break;
        case 'calculate':
          try {
            const expression = args.expression || '';
            // 简单的数学计算模拟
            const safeResult = eval(expression.replace(/[^0-9+\-*/.() ]/g, ''));
            result = `计算结果: ${expression} = ${safeResult}`;
          } catch (e) {
            result = `计算错误: 无效表达式`;
          }
          break;
        case 'get_time':
          result = `当前时间: ${new Date().toLocaleString('zh-CN')}`;
          break;
        default:
          result = `未知工具: ${selectedTool}`;
      }

      onAddLog({
        type: 'success',
        message: `✅ 工具执行完成: ${result}`,
        data: { result },
      });
    }, 500);

    setToolCall('');
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
          <span className="panel-title">MCP Server</span>
          <div className={`status-indicator status-${status}`}></div>
        </div>
        <div className="controls">
          {status === 'disconnected' ? (
            <button className="btn" onClick={handleStartServer}>
              启动服务器
            </button>
          ) : (
            <button className="btn secondary" onClick={handleStopServer}>
              停止服务器
            </button>
          )}
          <button className="btn secondary" onClick={onClearLogs}>
            清空日志
          </button>
        </div>
      </div>

      <div className="config-section">
        <div className="config-row">
          <span className="config-label">工具:</span>
          <select
            className="tool-selector"
            value={selectedTool}
            onChange={(e) => setSelectedTool(e.target.value)}
          >
            <option value="echo">echo - 回显文本</option>
            <option value="calculate">calculate - 数学计算</option>
            <option value="get_time">get_time - 获取时间</option>
          </select>
        </div>
        <div className="config-row">
          <span className="config-label">参数:</span>
          <input
            className="config-input"
            value={toolArgs}
            onChange={(e) => setToolArgs(e.target.value)}
            placeholder='{"text": "Hello World"}'
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
              value={toolCall}
              onChange={(e) => setToolCall(e.target.value)}
              placeholder="模拟客户端请求..."
              onKeyPress={(e) => e.key === 'Enter' && handleToolCall()}
              disabled={status !== 'connected'}
            />
            <button
              className="btn"
              onClick={handleToolCall}
              disabled={status !== 'connected'}
            >
              执行工具
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerPanel;
