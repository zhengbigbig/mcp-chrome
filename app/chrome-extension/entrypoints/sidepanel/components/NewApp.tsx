import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Button, Dropdown, Space, Typography, ConfigProvider } from 'antd';
import { SettingOutlined, ApiOutlined, MessageOutlined, MenuOutlined } from '@ant-design/icons';
import {
  IntelligentReasoningEngine,
  ReasoningResult,
  ReasoningStep,
  TaskChainItem,
} from '../services/IntelligentReasoningEngine';
import { UserInteraction, InteractionResult } from '@/utils/mcp/user-interaction';
import { ExternalMCPConfig } from './ExternalMCPConfig';
import { HostConfig } from './HostConfig';
import { ChatPanel } from './ChatPanel';

const { Header, Content } = Layout;
const { Title } = Typography;

export interface Message {
  id: string;
  type:
    | 'user'
    | 'assistant'
    | 'confirmation'
    | 'thinking'
    | 'tool_execution'
    | 'synthesis'
    | 'task_planning'
    | 'task_execution';
  content: string;
  timestamp: Date;
  steps?: ReasoningStep[];
  toolCalls?: any[];
  toolName?: string;
  parameters?: any;
  result?: any;
  requiresConfirmation?: boolean;
  taskChain?: TaskChainItem[];
  todoList?: string[];
}

export default function NewApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPanel, setCurrentPanel] = useState<'chat' | 'host' | 'mcp'>('chat');
  const [pendingConfirmation, setPendingConfirmation] = useState<ReasoningStep | null>(null);
  const [showExternalMCPConfig, setShowExternalMCPConfig] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const reasoningEngineRef = useRef<IntelligentReasoningEngine | null>(null);

  useEffect(() => {
    // 初始化智能推理引擎
    reasoningEngineRef.current = new IntelligentReasoningEngine();
    reasoningEngineRef.current.setInteractionHandler(
      async (interaction: UserInteraction): Promise<InteractionResult> => {
        return new Promise((resolve) => {
          // 这里会在 handleConfirmation 中处理
          setPendingConfirmation(interaction.data as ReasoningStep);
          // 暂时返回一个默认的确认结果
          resolve({
            id: interaction.id,
            confirmed: true,
            data: interaction.data,
          });
        });
      },
    );
  }, []);

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || !reasoningEngineRef.current) return;

    setIsLoading(true);
    addMessage({ type: 'user', content: userMessage });

    try {
      // 生成新的会话ID
      const sessionId = `session_${Date.now()}`;
      setCurrentSessionId(sessionId);

      // 开始智能推理
      const result = await reasoningEngineRef.current.startReasoning(userMessage, sessionId);

      // 根据结果类型处理
      if (result.nextAction === 'wait_confirmation') {
        // 需要用户确认
        const confirmationStep = result.steps.find((s) => s.requiresConfirmation);
        if (confirmationStep) {
          setPendingConfirmation(confirmationStep);
          addMessage({
            type: 'confirmation',
            content: `请确认是否执行: ${confirmationStep.toolName}`,
            requiresConfirmation: true,
            toolName: confirmationStep.toolName,
            parameters: confirmationStep.parameters,
          });
        }
      } else if (result.nextAction === 'complete') {
        // 执行完成
        addMessage({
          type: 'synthesis',
          content: result.content,
          steps: result.steps,
          taskChain: result.taskChain,
          todoList: result.todoList,
        });
      } else if (result.nextAction === 'error') {
        // 执行出错
        addMessage({
          type: 'assistant',
          content: `执行失败: ${result.content}`,
          steps: result.steps,
        });
      }

      // 添加所有步骤到消息中
      result.steps.forEach((step) => {
        if (step.type === 'task_planning') {
          addMessage({
            type: 'task_planning',
            content: step.content,
            steps: [step],
            taskChain: result.taskChain,
            todoList: result.todoList,
          });
        } else if (step.type === 'task_execution') {
          addMessage({
            type: 'task_execution',
            content: step.content,
            toolName: step.toolName,
            parameters: step.parameters,
            result: step.result,
            steps: [step],
            taskChain: step.taskChain,
          });
        } else if (step.type === 'thinking') {
          addMessage({
            type: 'thinking',
            content: step.content,
            steps: [step],
          });
        } else if (step.type === 'tool_execution') {
          addMessage({
            type: 'tool_execution',
            content: step.content,
            toolName: step.toolName,
            parameters: step.parameters,
            result: step.result,
            steps: [step],
          });
        }
      });
    } catch (error) {
      console.error('智能推理执行失败:', error);
      addMessage({
        type: 'assistant',
        content: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (accepted: boolean) => {
    if (!pendingConfirmation || !reasoningEngineRef.current || !currentSessionId) return;

    try {
      setIsLoading(true);

      if (accepted) {
        // 用户确认，继续执行
        const result = await reasoningEngineRef.current.continueAfterConfirmation(
          currentSessionId,
          true,
        );

        // 处理继续执行的结果
        if (result.nextAction === 'wait_confirmation') {
          // 又遇到需要确认的步骤
          const confirmationStep = result.steps.find((s) => s.requiresConfirmation);
          if (confirmationStep) {
            setPendingConfirmation(confirmationStep);
            addMessage({
              type: 'confirmation',
              content: `请确认是否执行: ${confirmationStep.toolName}`,
              requiresConfirmation: true,
              toolName: confirmationStep.toolName,
              parameters: confirmationStep.parameters,
            });
          }
        } else if (result.nextAction === 'complete') {
          // 执行完成
          addMessage({
            type: 'synthesis',
            content: result.content,
            steps: result.steps,
          });
          setPendingConfirmation(null);
        }

        // 添加新的步骤到消息中
        result.steps.forEach((step) => {
          if (step.type === 'thinking') {
            addMessage({
              type: 'thinking',
              content: step.content,
              steps: [step],
            });
          } else if (step.type === 'tool_execution') {
            addMessage({
              type: 'tool_execution',
              content: step.content,
              toolName: step.toolName,
              parameters: step.parameters,
              result: step.result,
              steps: [step],
            });
          }
        });
      } else {
        // 用户取消
        addMessage({
          type: 'assistant',
          content: '用户取消了操作',
        });
        setPendingConfirmation(null);

        // 清理会话
        reasoningEngineRef.current.cleanupSession(currentSessionId);
        setCurrentSessionId('');
      }
    } catch (error) {
      console.error('确认后继续执行失败:', error);
      addMessage({
        type: 'assistant',
        content: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const panelMenuItems = [
    {
      key: 'chat',
      icon: <MessageOutlined />,
      label: 'Chat 面板',
    },
    {
      key: 'host',
      icon: <SettingOutlined />,
      label: '宿主配置',
    },
    {
      key: 'mcp',
      icon: <ApiOutlined />,
      label: 'MCP 配置',
    },
  ];

  const renderPanelContent = () => {
    switch (currentPanel) {
      case 'chat':
        return (
          <ChatPanel
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            pendingConfirmation={pendingConfirmation}
            onConfirmation={handleConfirmation}
          />
        );
      case 'host':
        return <HostConfig />;
      case 'mcp':
        return (
          <div>
            <ExternalMCPConfig onClose={() => {}} />
          </div>
        );
      default:
        return (
          <ChatPanel
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            pendingConfirmation={pendingConfirmation}
            onConfirmation={handleConfirmation}
          />
        );
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <Layout style={{ height: '100vh', background: '#fff' }}>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            MCP Chrome Extension
          </Title>

          <Dropdown
            menu={{
              items: panelMenuItems,
              onClick: ({ key }) => setCurrentPanel(key as 'chat' | 'host' | 'mcp'),
              selectedKeys: [currentPanel],
            }}
            placement="bottomRight"
          >
            <Button type="text" icon={<MenuOutlined />} style={{ fontSize: '16px' }}>
              切换面板
            </Button>
          </Dropdown>
        </Header>

        <Content style={{ padding: '16px', overflow: 'auto' }}>{renderPanelContent()}</Content>
      </Layout>
    </ConfigProvider>
  );
}
