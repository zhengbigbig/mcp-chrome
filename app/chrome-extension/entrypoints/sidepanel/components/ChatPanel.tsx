import React, { useRef, useEffect } from 'react';
import { Card, Input, Button, Space, Typography, Divider, Tag, List, Avatar, Tooltip } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Message, TaskAnalysis } from './NewApp';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface ChatPanelProps {
  messages: Message[];
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  pendingConfirmation: TaskAnalysis | null;
  onConfirmation: (accepted: boolean) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  inputValue,
  setInputValue,
  isLoading,
  onSendMessage,
  pendingConfirmation,
  onConfirmation,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user';
    const isConfirmation = message.type === 'confirmation';

    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          marginBottom: '16px',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          style={{
            maxWidth: '80%',
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <Avatar
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? '#1890ff' : '#52c41a',
            }}
          />
          <Card
            size="small"
            style={{
              backgroundColor: isUser ? '#f0f8ff' : '#f6ffed',
              border: isUser ? '1px solid #d6e4ff' : '1px solid #b7eb8f',
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {formatTimestamp(message.timestamp)}
              </Text>
            </div>
            
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Paragraph>

            {message.steps && message.steps.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <Divider style={{ margin: '8px 0' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  执行步骤:
                </Text>
                <List
                  size="small"
                  dataSource={message.steps}
                  renderItem={(step, index) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Text style={{ fontSize: '12px' }}>
                        {index + 1}. {step.content || step.type}
                      </Text>
                    </List.Item>
                  )}
                />
              </div>
            )}

            {message.toolCalls && message.toolCalls.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <Divider style={{ margin: '8px 0' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  工具调用:
                </Text>
                <div style={{ marginTop: '8px' }}>
                  {message.toolCalls.map((call, index) => (
                    <Tag key={index} color="blue" style={{ marginBottom: '4px' }}>
                      {call.tool}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {isConfirmation && pendingConfirmation && (
              <div style={{ marginTop: '16px' }}>
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onConfirmation(true)}
                    disabled={isLoading}
                  >
                    确认执行
                  </Button>
                  <Button
                    size="small"
                    onClick={() => onConfirmation(false)}
                    disabled={isLoading}
                  >
                    取消
                  </Button>
                </Space>
              </div>
            )}
          </Card>
        </div>
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
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 欢迎消息和快速操作 */}
      {messages.length === 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: '16px' }}>
            🤖 智能浏览器助手
          </Title>
          <Paragraph style={{ textAlign: 'center', marginBottom: '24px' }}>
            我可以帮助您执行各种浏览器操作，包括截图、内容提取、页面搜索等。
            请用自然语言描述您想要的操作！
          </Paragraph>
          
          <Divider>🚀 快速操作</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {quickActions.map((action, index) => (
              <Button
                key={index}
                type="dashed"
                size="small"
                onClick={() => setInputValue(action.prompt)}
                style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: '16px' }}>
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <Card size="small">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="描述您想要执行的操作..."
            disabled={isLoading}
            rows={2}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            loading={isLoading}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
};
