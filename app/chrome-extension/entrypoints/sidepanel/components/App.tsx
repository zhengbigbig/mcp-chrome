import React, { useState, useEffect, useRef } from 'react';
import { OllamaClient } from '../services/OllamaClient';
import { MCPClientService } from '../services/MCPClientService';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ConnectionStatus {
  ollama: 'connected' | 'disconnected' | 'connecting' | 'error';
  mcp: 'connected' | 'disconnected' | 'connecting' | 'error';
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    ollama: 'disconnected',
    mcp: 'disconnected',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ollamaClientRef = useRef<OllamaClient | null>(null);
  const mcpClientRef = useRef<MCPClientService | null>(null);

  useEffect(() => {
    // 初始化服务
    initializeServices();

    // 添加欢迎消息
    addMessage('system', '欢迎使用MCP客户端！正在连接到Ollama和MCP服务器...');
  }, []);

  useEffect(() => {
    // 自动滚动到底部
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeServices = async () => {
    try {
      // 初始化Ollama客户端
      setConnectionStatus((prev) => ({ ...prev, ollama: 'connecting' }));
      ollamaClientRef.current = new OllamaClient('http://localhost:11434');

      const isOllamaConnected = await ollamaClientRef.current.testConnection();
      setConnectionStatus((prev) => ({
        ...prev,
        ollama: isOllamaConnected ? 'connected' : 'error',
      }));

      if (isOllamaConnected) {
        addMessage('system', 'Ollama连接成功');
      } else {
        addMessage('system', 'Ollama连接失败，请确保Ollama服务正在运行');
      }

      // 初始化MCP客户端
      setConnectionStatus((prev) => ({ ...prev, mcp: 'connecting' }));
      mcpClientRef.current = new MCPClientService();

      const isMCPConnected = await mcpClientRef.current.initialize();
      setConnectionStatus((prev) => ({
        ...prev,
        mcp: isMCPConnected ? 'connected' : 'error',
      }));

      if (isMCPConnected) {
        addMessage('system', 'MCP服务器连接成功');
      } else {
        addMessage('system', 'MCP服务器连接失败');
      }
    } catch (error) {
      console.error('初始化服务时出错:', error);
      addMessage('system', `初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const addMessage = (type: Message['type'], content: string) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    addMessage('user', userMessage);
    setIsLoading(true);

    try {
      // 检查是否需要使用MCP工具
      const needsMCP = await shouldUseMCP(userMessage);

      if (needsMCP && mcpClientRef.current && connectionStatus.mcp === 'connected') {
        // 使用MCP工具处理请求
        const mcpResponse = await mcpClientRef.current.processRequest(userMessage);
        addMessage('assistant', mcpResponse);
      } else if (ollamaClientRef.current && connectionStatus.ollama === 'connected') {
        // 直接使用Ollama处理请求
        const response = await ollamaClientRef.current.chat([
          { role: 'user', content: userMessage },
        ]);
        addMessage('assistant', response);
      } else {
        addMessage('system', '无法处理请求：Ollama和MCP服务都不可用');
      }
    } catch (error) {
      console.error('处理消息时出错:', error);
      addMessage('system', `错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const shouldUseMCP = async (message: string): Promise<boolean> => {
    // 简单的关键词检测来判断是否需要使用MCP工具
    const mcpKeywords = [
      '浏览器',
      '网页',
      '标签页',
      '书签',
      '历史记录',
      '截图',
      '下载',
      '搜索',
      '控制台',
      '网络',
    ];

    return mcpKeywords.some((keyword) => message.includes(keyword));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusColor = (status: ConnectionStatus['ollama']) => {
    switch (status) {
      case 'connected':
        return '#4caf50';
      case 'connecting':
        return '#ff9800';
      case 'error':
        return '#f44336';
      default:
        return '#ccc';
    }
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <h1>MCP 客户端</h1>
        <div className="status-indicators">
          <div className="status-indicator">
            <div
              className="status-dot"
              style={{ backgroundColor: getStatusColor(connectionStatus.ollama) }}
            />
            <span>Ollama</span>
          </div>
          <div className="status-indicator">
            <div
              className="status-dot"
              style={{ backgroundColor: getStatusColor(connectionStatus.mcp) }}
            />
            <span>MCP</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            {message.content}
          </div>
        ))}

        {isLoading && (
          <div className="loading-indicator">
            <span>AI正在思考</span>
            <div className="loading-dots">
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="input-container">
        <div className="input-wrapper">
          <textarea
            className="message-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入你的问题..."
            disabled={isLoading}
          />
        </div>
        <button
          className="send-button"
          onClick={handleSendMessage}
          disabled={isLoading || !inputValue.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default App;
