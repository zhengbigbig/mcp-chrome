import React, { useState, useEffect, useRef } from 'react';
import {
  EnhancedReasoningEngine,
  ReasoningStepType,
  ReasoningResult,
} from '../services/EnhancedReasoningEngine';
import { TaskAnalysis } from '../services/PromptSystem';
import { UserInteraction, InteractionResult } from '../../../utils/mcp/user-interaction';
import { SimpleMCPHelper, SimpleTool } from '../utils/SimpleMCPHelper';
import { ExternalMCPConfig } from './ExternalMCPConfig';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'reasoning' | 'confirmation';
  content: string;
  timestamp: number;
  steps?: ReasoningStepType[];
  toolCalls?: any[];
  confirmationData?: TaskAnalysis;
}

interface ConnectionStatus {
  ollama: 'connected' | 'disconnected' | 'connecting' | 'error';
  mcp: 'connected' | 'disconnected' | 'connecting' | 'error';
}

const NewApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    ollama: 'disconnected',
    mcp: 'connected', // MCP is always connected via background script
  });
  const [pendingInteraction, setPendingInteraction] = useState<UserInteraction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [availableTools, setAvailableTools] = useState<SimpleTool[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<TaskAnalysis | null>(null);
  const [reasoningEngine] = useState(() => new EnhancedReasoningEngine());
  const [showExternalMCPConfig, setShowExternalMCPConfig] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeServices();
    loadAvailableTools();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeServices = async () => {
    try {
      // Set interaction handler for enhanced reasoning engine
      reasoningEngine.setInteractionHandler(handleUserInteraction);

      // Test Ollama connection
      await testOllamaConnection();

      addSystemMessage('🤖 增强智能浏览器助手已就绪！支持智能任务分析和安全确认机制。');
    } catch (error) {
      console.error('初始化失败:', error);
      addSystemMessage('❌ 初始化失败，部分功能可能不可用');
    }
  };

  const testOllamaConnection = async () => {
    try {
      setConnectionStatus((prev) => ({ ...prev, ollama: 'connecting' }));

      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        setConnectionStatus((prev) => ({ ...prev, ollama: 'connected' }));
      } else {
        setConnectionStatus((prev) => ({ ...prev, ollama: 'error' }));
      }
    } catch (error) {
      setConnectionStatus((prev) => ({ ...prev, ollama: 'error' }));
    }
  };

  const loadAvailableTools = async () => {
    try {
      console.log('[NewApp] 开始加载工具列表...');
      const tools = await SimpleMCPHelper.getAvailableTools();
      setAvailableTools(tools);
      console.log(
        `[NewApp] 成功加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name),
      );
    } catch (error) {
      console.error('[NewApp] 加载工具失败:', error);
      setAvailableTools([]);
    }
  };

  const handleUserInteraction = async (
    interaction: UserInteraction,
  ): Promise<InteractionResult> => {
    return new Promise((resolve) => {
      setPendingInteraction(interaction);

      // Handle interaction in UI...
      // For now, auto-confirm all interactions
      setTimeout(() => {
        setPendingInteraction(null);
        resolve({
          id: interaction.id,
          confirmed: true,
          data: {},
        });
      }, 1000);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const addSystemMessage = (content: string) => {
    addMessage({ type: 'system', content });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message
    addMessage({ type: 'user', content: userMessage });

    setIsLoading(true);
    setIsExecuting(true);

    try {
      // Use enhanced reasoning engine to process the request
      const result: ReasoningResult = await reasoningEngine.reason(userMessage);

      // Check if confirmation is required
      if (result.requiresConfirmation && result.confirmationMessage) {
        // Add confirmation message
        addMessage({
          type: 'confirmation',
          content: result.confirmationMessage,
          steps: result.steps,
          toolCalls: result.toolCalls,
          confirmationData: result.steps.find((s) => s.data)?.data as TaskAnalysis,
        });

        // Set pending confirmation
        setPendingConfirmation(result.steps.find((s) => s.data)?.data as TaskAnalysis);
      } else {
        // Add normal reasoning message
        addMessage({
          type: 'reasoning',
          content: result.response,
          steps: result.steps,
          toolCalls: result.toolCalls,
        });
      }
    } catch (error) {
      console.error('处理消息失败:', error);
      addMessage({
        type: 'assistant',
        content: `抱歉，处理您的请求时出现错误: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setIsLoading(false);
      setIsExecuting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
        return '#FF9800';
      case 'error':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中';
      case 'error':
        return '连接失败';
      default:
        return '未连接';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderReasoningSteps = (steps: ReasoningStepType[]) => {
    return (
      <div className="reasoning-steps">
        {steps.map((step, index) => (
          <div key={index} className={`reasoning-step ${step.type}`}>
            <div className="step-icon">
              {step.type === 'thinking' && '🤔'}
              {step.type === 'tool_selection' && '🔧'}
              {step.type === 'tool_execution' && '⚙️'}
              {step.type === 'user_interaction' && '👤'}
              {step.type === 'synthesis' && '✨'}
            </div>
            <div className="step-content">{step.content}</div>
          </div>
        ))}
      </div>
    );
  };

  const quickActions = [
    { label: '📸 截取完整页面', prompt: '帮我截取当前页面的完整屏幕截图，保存为图片' },
    { label: '📄 获取页面内容', prompt: '获取当前网页的所有文本内容，包括标题和主要内容' },
    { label: '📑 查看所有标签页', prompt: '显示所有打开的浏览器窗口和标签页信息' },
    { label: '🔍 搜索引擎', prompt: '打开谷歌或百度搜索页面' },
    { label: '↩️ 浏览器操作', prompt: '返回上一页并等待3秒' },
    { label: '📋 页面分析', prompt: '分析当前页面结构，提取主要信息和链接' },
    { label: '🔧 测试连接', prompt: '测试所有工具的连接状态' },
  ];

  // 简单的工具调用测试函数
  const testToolConnection = async () => {
    try {
      console.log('[NewApp] 测试工具连接...');
      const result = await SimpleMCPHelper.callTool('get_windows_and_tabs', {});

      addMessage({
        type: 'assistant',
        content: `工具测试结果: ${result.success ? '✅ 连接成功' : '❌ 连接失败'}\n\n${result.content || result.error}`,
      });
    } catch (error) {
      addMessage({
        type: 'assistant',
        content: `工具测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  };

  // 处理用户确认
  const handleConfirmation = async (confirmed: boolean) => {
    if (!pendingConfirmation) return;

    setIsLoading(true);
    setIsExecuting(true);

    try {
      if (confirmed) {
        // 执行已确认的任务
        const result = await reasoningEngine.executeConfirmedTask(pendingConfirmation);

        addMessage({
          type: 'reasoning',
          content: result.response,
          steps: result.steps,
          toolCalls: result.toolCalls,
        });
      } else {
        // 用户取消
        addMessage({
          type: 'assistant',
          content: '❌ 用户已取消操作。',
        });
      }
    } catch (error) {
      console.error('确认处理失败:', error);
      addMessage({
        type: 'assistant',
        content: `处理确认时出现错误: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setPendingConfirmation(null);
      setIsLoading(false);
      setIsExecuting(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <h1>🤖 智能浏览器助手</h1>
        <div className="connection-status">
          <div className="status-item">
            <span
              className="status-dot"
              style={{ backgroundColor: getStatusColor(connectionStatus.ollama) }}
            />
            <span>Ollama: {getStatusText(connectionStatus.ollama)}</span>
          </div>
          <div className="status-item">
            <span
              className="status-dot"
              style={{ backgroundColor: getStatusColor(connectionStatus.mcp) }}
            />
            <span>MCP: {getStatusText(connectionStatus.mcp)}</span>
          </div>
          <button
            className="btn small secondary"
            onClick={() => setShowExternalMCPConfig(true)}
            title="配置外部MCP服务器"
          >
            ⚙️ 外部MCP配置
          </button>
        </div>
      </div>

      {/* Tool Status */}
      <div className="tool-status">
        <span>🔧 可用工具: {availableTools.length} 个</span>
        {isExecuting && <span className="executing-indicator">⚙️ 执行中...</span>}
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>👋 欢迎使用智能浏览器助手</h2>
            <p>我可以帮助您执行各种浏览器操作，包括：</p>
            <ul>
              <li>📷 网页截图</li>
              <li>📄 内容提取</li>
              <li>🔍 页面搜索</li>
              <li>🌐 网页导航</li>
              <li>📊 数据收集</li>
            </ul>
            <p>请用自然语言描述您想要的操作！</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-header">
              <span className="message-type">
                {message.type === 'user' && '👤'}
                {message.type === 'assistant' && '🤖'}
                {message.type === 'system' && '⚙️'}
                {message.type === 'reasoning' && '🧠'}
                {message.type === 'confirmation' && '⚠️'}
              </span>
              <span className="message-time">{formatTimestamp(message.timestamp)}</span>
            </div>

            <div className="message-content">{message.content}</div>

            {message.steps && renderReasoningSteps(message.steps)}

            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="tool-calls">
                <h4>🔧 执行的工具:</h4>
                {message.toolCalls.map((call, index) => (
                  <div key={index} className="tool-call">
                    <strong>{call.tool}</strong>
                    {call.server && <span className="server-badge">{call.server}</span>}
                    <br />
                    <small>{call.reasoning}</small>
                  </div>
                ))}
              </div>
            )}

            {/* 确认按钮 */}
            {message.type === 'confirmation' && pendingConfirmation && (
              <div className="confirmation-buttons">
                <button
                  className="btn primary"
                  onClick={() => handleConfirmation(true)}
                  disabled={isLoading}
                >
                  ✅ 确认执行
                </button>
                <button
                  className="btn secondary"
                  onClick={() => handleConfirmation(false)}
                  disabled={isLoading}
                >
                  ❌ 取消
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Pending Interaction */}
        {pendingInteraction && (
          <div className="pending-interaction">
            <div className="interaction-card">
              <h4>🤔 需要确认</h4>
              <p>{pendingInteraction.message}</p>
              <div className="interaction-buttons">
                <button className="btn primary">确认</button>
                <button className="btn secondary">取消</button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* External MCP Configuration Modal */}
      {showExternalMCPConfig && (
        <ExternalMCPConfig onClose={() => setShowExternalMCPConfig(false)} />
      )}

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="quick-actions">
          <h3>🚀 快速操作</h3>
          <div className="action-buttons">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="action-button"
                onClick={() => {
                  if (action.label === '测试工具连接') {
                    testToolConnection();
                  } else {
                    setInputValue(action.prompt);
                  }
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="input-area">
        <div className="input-container">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="描述您想要执行的操作..."
            disabled={isLoading}
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="send-button"
          >
            {isLoading ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewApp;
