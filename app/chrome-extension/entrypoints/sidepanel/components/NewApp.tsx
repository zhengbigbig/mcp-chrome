import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Button, Dropdown, Space, Typography, ConfigProvider } from 'antd';
import { SettingOutlined, ApiOutlined, MessageOutlined, MenuOutlined } from '@ant-design/icons';
import { EnhancedReasoningEngine } from '../services/EnhancedReasoningEngine';
import { TaskAnalysis, UserInteraction, InteractionResult } from '@/utils/mcp/user-interaction';
import { ExternalMCPConfig } from './ExternalMCPConfig';
import { HostConfig } from './HostConfig';
import { ChatPanel } from './ChatPanel';

const { Header, Content } = Layout;
const { Title } = Typography;

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'confirmation';
  content: string;
  timestamp: Date;
  steps?: any[];
  toolCalls?: any[];
  confirmationData?: TaskAnalysis;
}

export interface ReasoningResult {
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  steps: any[];
  toolCalls: any[];
  result?: any;
}

export default function NewApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPanel, setCurrentPanel] = useState<'chat' | 'host' | 'mcp'>('chat');
  const [pendingConfirmation, setPendingConfirmation] = useState<TaskAnalysis | null>(null);
  const [showExternalMCPConfig, setShowExternalMCPConfig] = useState(false);
  const reasoningEngineRef = useRef<EnhancedReasoningEngine | null>(null);

  useEffect(() => {
    // 初始化增强推理引擎
    reasoningEngineRef.current = new EnhancedReasoningEngine();
    reasoningEngineRef.current.setInteractionHandler({
      requestConfirmation: async (interaction: UserInteraction): Promise<InteractionResult> => {
        return new Promise((resolve) => {
          // 这里会在 handleConfirmation 中处理
          setPendingConfirmation(interaction.data as TaskAnalysis);
        });
      },
    });
  }, []);

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || !reasoningEngineRef.current) return;

    setIsLoading(true);
    addMessage({ type: 'user', content: userMessage });

    try {
      const result: ReasoningResult = await reasoningEngineRef.current.reason(userMessage);
      
      if (result.requiresConfirmation && result.confirmationMessage) {
        addMessage({ 
          type: 'confirmation', 
          content: result.confirmationMessage,
          steps: result.steps,
          toolCalls: result.toolCalls,
          confirmationData: result.steps.find(s => s.data)?.data as TaskAnalysis
        });
        setPendingConfirmation(result.steps.find(s => s.data)?.data as TaskAnalysis);
      } else {
        addMessage({ 
          type: 'assistant', 
          content: result.result || '任务执行完成',
          steps: result.steps,
          toolCalls: result.toolCalls
        });
      }
    } catch (error) {
      console.error('推理引擎执行失败:', error);
      addMessage({ 
        type: 'assistant', 
        content: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (accepted: boolean) => {
    if (!pendingConfirmation || !reasoningEngineRef.current) return;

    try {
      if (accepted) {
        const result = await reasoningEngineRef.current.executeConfirmedTask(pendingConfirmation);
        addMessage({ 
          type: 'assistant', 
          content: result || '任务执行完成',
          steps: pendingConfirmation.steps,
          toolCalls: pendingConfirmation.toolCalls
        });
      } else {
        addMessage({ 
          type: 'assistant', 
          content: '用户取消了任务执行',
          steps: pendingConfirmation.steps,
          toolCalls: pendingConfirmation.toolCalls
        });
      }
    } catch (error) {
      console.error('确认任务执行失败:', error);
      addMessage({ 
        type: 'assistant', 
        content: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setPendingConfirmation(null);
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
        return <ChatPanel
          messages={messages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          pendingConfirmation={pendingConfirmation}
          onConfirmation={handleConfirmation}
        />;
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
        <Header style={{ 
          background: '#fff', 
          borderBottom: '1px solid #f0f0f0',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
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
            <Button 
              type="text" 
              icon={<MenuOutlined />}
              style={{ fontSize: '16px' }}
            >
              切换面板
            </Button>
          </Dropdown>
        </Header>

        <Content style={{ padding: '16px', overflow: 'auto' }}>
          {renderPanelContent()}
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
