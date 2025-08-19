import React, { useState, useEffect } from 'react';
import ServerPanel from './ServerPanel';
import ClientPanel from './ClientPanel';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'server' | 'client';
  message: string;
  data?: any;
}

export interface AppState {
  serverLogs: LogEntry[];
  clientLogs: LogEntry[];
  serverStatus: 'disconnected' | 'connecting' | 'connected';
  clientStatus: 'disconnected' | 'connecting' | 'connected';
  ollamaStatus: 'disconnected' | 'connecting' | 'connected';
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    serverLogs: [],
    clientLogs: [],
    serverStatus: 'disconnected',
    clientStatus: 'disconnected',
    ollamaStatus: 'disconnected',
  });

  // 添加日志条目
  const addLog = (panel: 'server' | 'client', entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const logEntry: LogEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      [`${panel}Logs`]: [...(prev[`${panel}Logs` as keyof AppState] as LogEntry[]), logEntry].slice(-1000), // 保留最近1000条
    }));
  };

  // 更新状态
  const updateStatus = (
    type: 'server' | 'client' | 'ollama',
    status: 'disconnected' | 'connecting' | 'connected'
  ) => {
    setState(prev => ({
      ...prev,
      [`${type}Status`]: status,
    }));
  };

  // 清空日志
  const clearLogs = (panel: 'server' | 'client') => {
    setState(prev => ({
      ...prev,
      [`${panel}Logs`]: [],
    }));
  };

  // 初始化时添加欢迎消息
  useEffect(() => {
    addLog('server', {
      type: 'info',
      message: '🚀 MCP Server Debug Console 已启动',
    });
    
    addLog('client', {
      type: 'info',
      message: '🚀 MCP Client Debug Console 已启动',
    });

    addLog('client', {
      type: 'info',
      message: '💡 提示：这是一个模拟的调试环境，用于测试 MCP 功能',
    });
  }, []);

  return (
    <div className="debug-console">
      <ServerPanel
        logs={state.serverLogs}
        status={state.serverStatus}
        onAddLog={(entry) => addLog('server', entry)}
        onUpdateStatus={(status) => updateStatus('server', status)}
        onClearLogs={() => clearLogs('server')}
      />
      <ClientPanel
        logs={state.clientLogs}
        status={state.clientStatus}
        ollamaStatus={state.ollamaStatus}
        onAddLog={(entry) => addLog('client', entry)}
        onUpdateStatus={(status) => updateStatus('client', status)}
        onUpdateOllamaStatus={(status) => updateStatus('ollama', status)}
        onClearLogs={() => clearLogs('client')}
      />
    </div>
  );
};

export default App;
