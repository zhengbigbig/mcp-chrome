import React, { useRef, useEffect } from 'react';
import { Card, Input, Button, Space, Typography, Divider, Tag, List, Avatar, Tooltip } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Message } from './NewApp';
import { ReasoningStep } from '../services/IntelligentReasoningEngine';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface ChatPanelProps {
  messages: Message[];
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  pendingConfirmation: ReasoningStep | null;
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
    const isThinking = message.type === 'thinking';
    const isToolExecution = message.type === 'tool_execution';
    const isSynthesis = message.type === 'synthesis';
    const isTaskPlanning = message.type === 'task_planning';
    const isTaskExecution = message.type === 'task_execution';

    // 根据消息类型选择图标和样式
    let icon = <UserOutlined />;
    let backgroundColor = '#f0f8ff';
    let borderColor = '#d6e4ff';
    let textColor = '#000';

    if (isUser) {
      icon = <UserOutlined />;
      backgroundColor = '#f0f8ff';
      borderColor = '#d6e4ff';
    } else if (isTaskPlanning) {
      icon = <RobotOutlined />;
      backgroundColor = '#f0f5ff';
      borderColor = '#adc6ff';
      textColor = '#1d39c4';
    } else if (isTaskExecution) {
      icon = <RobotOutlined />;
      backgroundColor = '#f6ffed';
      borderColor = '#b7eb8f';
      textColor = '#389e0d';
    } else if (isThinking) {
      icon = <RobotOutlined />;
      backgroundColor = '#fff7e6';
      borderColor = '#ffd591';
      textColor = '#d46b08';
    } else if (isToolExecution) {
      icon = <RobotOutlined />;
      backgroundColor = '#f6ffed';
      borderColor = '#b7eb8f';
      textColor = '#389e0d';
    } else if (isSynthesis) {
      icon = <RobotOutlined />;
      backgroundColor = '#f0f5ff';
      borderColor = '#adc6ff';
      textColor = '#1d39c4';
    } else if (isConfirmation) {
      icon = <ExclamationCircleOutlined />;
      backgroundColor = '#fff2e8';
      borderColor = '#ffbb96';
      textColor = '#d4380d';
    } else {
      icon = <RobotOutlined />;
      backgroundColor = '#f6ffed';
      borderColor = '#b7eb8f';
    }

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
            icon={icon}
            style={{
              backgroundColor: isUser ? '#1890ff' : '#52c41a',
            }}
          />
          <Card
            size="small"
            style={{
              backgroundColor,
              border: `1px solid ${borderColor}`,
              color: textColor,
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {formatTimestamp(message.timestamp)}
              </Text>
              {!isUser && (
                <Tag
                  style={{ marginLeft: '8px' }}
                  color={
                    isTaskPlanning
                      ? 'blue'
                      : isTaskExecution
                        ? 'green'
                        : isThinking
                          ? 'orange'
                          : isToolExecution
                            ? 'green'
                            : isSynthesis
                              ? 'blue'
                              : isConfirmation
                                ? 'red'
                                : 'default'
                  }
                >
                  {isTaskPlanning
                    ? '任务规划'
                    : isTaskExecution
                      ? '任务执行'
                      : isThinking
                        ? '思考中'
                        : isToolExecution
                          ? '工具执行'
                          : isSynthesis
                            ? '总结'
                            : isConfirmation
                              ? '需要确认'
                              : '助手'}
                </Tag>
              )}
            </div>

            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</Paragraph>

            {/* TODO LIST */}
            {isTaskPlanning && message.todoList && message.todoList.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <Divider style={{ margin: '8px 0' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  📋 TODO LIST:
                </Text>
                <List
                  size="small"
                  dataSource={message.todoList}
                  renderItem={(item, index) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Text style={{ fontSize: '12px' }}>
                        {index + 1}. {item}
                      </Text>
                    </List.Item>
                  )}
                />
              </div>
            )}

            {/* 任务链条 */}
            {message.taskChain && message.taskChain.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <Divider style={{ margin: '8px 0' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  🔗 任务链条:
                </Text>
                <List
                  size="small"
                  dataSource={message.taskChain}
                  renderItem={(task, index) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <div style={{ width: '100%' }}>
                        <Text style={{ fontSize: '12px' }}>
                          {index + 1}. {task.description}
                        </Text>
                        <div style={{ marginTop: '4px' }}>
                          <Tag
                            style={{ marginRight: '4px' }}
                            color={
                              task.status === 'completed'
                                ? 'success'
                                : task.status === 'running'
                                  ? 'processing'
                                  : task.status === 'failed'
                                    ? 'error'
                                    : task.status === 'waiting_confirmation'
                                      ? 'warning'
                                      : 'default'
                            }
                          >
                            {task.status === 'completed'
                              ? '完成'
                              : task.status === 'running'
                                ? '执行中'
                                : task.status === 'failed'
                                  ? '失败'
                                  : task.status === 'waiting_confirmation'
                                    ? '等待确认'
                                    : '待执行'}
                          </Tag>
                          <Tag color="blue">
                            {task.type === 'tool_call'
                              ? '工具调用'
                              : task.type === 'model_call'
                                ? '模型调用'
                                : '用户确认'}
                          </Tag>
                          {task.dependsOn && task.dependsOn.length > 0 && (
                            <Tag color="orange">依赖: {task.dependsOn.join(', ')}</Tag>
                          )}
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              </div>
            )}

            {/* 工具执行信息 */}
            {isToolExecution && message.toolName && (
              <div style={{ marginTop: '12px' }}>
                <Divider style={{ margin: '8px 0' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  工具信息:
                </Text>
                <div style={{ marginTop: '8px' }}>
                  <Text style={{ fontSize: '12px' }}>
                    <strong>工具:</strong> {message.toolName}
                  </Text>
                  {message.parameters && (
                    <div style={{ marginTop: '4px' }}>
                      <Text style={{ fontSize: '12px' }}>
                        <strong>参数:</strong> {JSON.stringify(message.parameters, null, 2)}
                      </Text>
                    </div>
                  )}
                  {message.result && (
                    <div style={{ marginTop: '4px' }}>
                      <Text style={{ fontSize: '12px' }}>
                        <strong>结果:</strong> {message.result.success ? '成功' : '失败'}
                        {message.result.error && ` - ${message.result.error}`}
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 执行步骤 */}
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
                        {index + 1}. {step.content}
                        {step.status && (
                          <Tag
                            style={{ marginLeft: '8px' }}
                            color={
                              step.status === 'completed'
                                ? 'success'
                                : step.status === 'running'
                                  ? 'processing'
                                  : step.status === 'failed'
                                    ? 'error'
                                    : step.status === 'waiting_confirmation'
                                      ? 'warning'
                                      : 'default'
                            }
                          >
                            {step.status === 'completed'
                              ? '完成'
                              : step.status === 'running'
                                ? '执行中'
                                : step.status === 'failed'
                                  ? '失败'
                                  : step.status === 'waiting_confirmation'
                                    ? '等待确认'
                                    : '待执行'}
                          </Tag>
                        )}
                      </Text>
                    </List.Item>
                  )}
                />
              </div>
            )}

            {/* 用户确认 */}
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
                  <Button size="small" onClick={() => onConfirmation(false)} disabled={isLoading}>
                    取消
                  </Button>
                </Space>
                {pendingConfirmation.parameters && (
                  <div style={{ marginTop: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      <strong>执行参数:</strong>{' '}
                      {JSON.stringify(pendingConfirmation.parameters, null, 2)}
                    </Text>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  // 更新快速操作，使用新的工具名称格式并创建合适的测试场景
  const quickActions = [
    {
      label: '📸 截取完整页面',
      prompt: '使用 @browser/content/screenshot 工具截取当前页面的完整屏幕截图，保存为图片',
      description: '测试截图工具 - 需要用户确认',
    },
    {
      label: '📄 获取页面内容',
      prompt:
        '使用 @browser/content/web_fetcher 工具获取当前网页的所有文本内容，包括标题和主要内容',
      description: '测试内容获取工具 - 可并行执行',
    },
    {
      label: '📑 查看所有标签页',
      prompt: '使用 @browser/window/get_windows_and_tabs 工具显示所有打开的浏览器窗口和标签页信息',
      description: '测试窗口管理工具 - 无风险操作',
    },
    {
      label: '🔍 搜索引擎',
      prompt:
        '使用 @browser/navigation/navigate 工具打开谷歌搜索页面，然后使用 @browser/content/web_fetcher 获取搜索结果',
      description: '测试导航+内容获取组合 - 需要用户确认导航',
    },
    {
      label: '↩️ 浏览器操作',
      prompt:
        '使用 @browser/navigation/go_back_or_forward 工具返回上一页，然后等待3秒，再使用 @browser/content/web_fetcher 获取页面内容',
      description: '测试导航+内容获取组合 - 需要用户确认',
    },
    {
      label: '📋 页面分析',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/interaction/get_interactive_elements 分析页面结构，提取主要信息和链接',
      description: '测试内容获取+交互元素分析 - 可并行执行',
    },
    {
      label: '🖱️ 点击操作',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/interaction/click 工具点击页面上的登录按钮',
      description: '测试内容获取+点击交互 - 需要用户确认点击',
    },
    {
      label: '✏️ 表单填写',
      prompt:
        '使用 @browser/interaction/get_interactive_elements 获取表单元素，然后使用 @browser/interaction/fill 工具填写用户名和密码字段',
      description: '测试交互元素获取+表单填写 - 需要用户确认',
    },
    {
      label: '🌐 网络监控',
      prompt:
        '使用 @browser/network/capture_start 开始网络监控，然后使用 @browser/navigation/navigate 导航到新页面，最后使用 @browser/network/capture_stop 停止监控并获取结果',
      description: '测试网络监控+导航组合 - 需要用户确认',
    },
    {
      label: '📚 历史记录',
      prompt:
        '使用 @browser/data/history 工具搜索最近访问的网页，然后使用 @browser/data/bookmark_search 搜索相关书签',
      description: '测试数据查询工具 - 可并行执行',
    },
    {
      label: '🔧 脚本注入',
      prompt:
        '使用 @browser/script/inject_script 工具注入一个简单的JavaScript脚本，然后使用 @browser/script/send_command 工具触发脚本事件',
      description: '测试脚本注入工具 - 需要用户确认',
    },
    {
      label: '🐛 调试信息',
      prompt:
        '使用 @browser/debug/console 工具获取页面控制台输出，然后使用 @browser/content/screenshot 工具截取页面截图',
      description: '测试调试+截图组合 - 可并行执行',
    },
  ];

  // 新增：组合式调用测试场景
  const combinationTestScenarios = [
    {
      label: '🚀 完整页面分析流程',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/interaction/get_interactive_elements 分析页面结构，最后使用 @browser/content/screenshot 截取页面截图，并保存所有信息',
      description: '测试完整的内容分析流程 - 3个工具组合',
    },
    {
      label: '🔄 多页面数据收集',
      prompt:
        '使用 @browser/window/get_windows_and_tabs 获取所有标签页，然后对每个标签页使用 @browser/content/web_fetcher 获取内容，最后使用 @browser/data/bookmark_add 将重要页面添加到书签',
      description: '测试多页面数据收集 - 4个工具组合',
    },
    {
      label: '📊 网络性能分析',
      prompt:
        '使用 @browser/network/debugger_start 开始网络调试，然后使用 @browser/navigation/navigate 导航到目标页面，等待页面加载完成后使用 @browser/network/debugger_stop 停止调试，最后使用 @browser/content/web_fetcher 获取页面内容进行对比分析',
      description: '测试网络性能分析 - 4个工具组合',
    },
    {
      label: '🎯 智能表单自动化',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/interaction/get_interactive_elements 识别表单字段，接着使用 @browser/interaction/fill 填写表单，最后使用 @browser/interaction/click 提交表单',
      description: '测试智能表单自动化 - 4个工具组合',
    },
    {
      label: '🔍 深度页面探索',
      prompt:
        '使用 @browser/navigation/navigate 打开目标页面，然后使用 @browser/content/web_fetcher 获取页面内容，接着使用 @browser/interaction/get_interactive_elements 分析交互元素，最后使用 @browser/content/screenshot 截取重要区域截图',
      description: '测试深度页面探索 - 4个工具组合',
    },
    {
      label: '📈 用户行为模拟',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/interaction/click 点击导航菜单，等待页面加载后使用 @browser/content/web_fetcher 获取新页面内容，最后使用 @browser/interaction/fill 填写搜索框并提交',
      description: '测试用户行为模拟 - 4个工具组合',
    },
    {
      label: '🌐 跨页面数据同步',
      prompt:
        '使用 @browser/window/get_windows_and_tabs 获取所有标签页，然后使用 @browser/content/web_fetcher 获取当前页面内容，接着使用 @browser/navigation/navigate 打开新标签页，最后使用 @browser/content/web_fetcher 获取新页面内容进行数据对比',
      description: '测试跨页面数据同步 - 4个工具组合',
    },
    {
      label: '🔧 高级脚本操作',
      prompt:
        '使用 @browser/script/inject_script 注入数据提取脚本，然后使用 @browser/content/web_fetcher 获取页面内容，接着使用 @browser/script/send_command 触发脚本执行，最后使用 @browser/content/screenshot 截取脚本执行结果',
      description: '测试高级脚本操作 - 4个工具组合',
    },
    {
      label: '📱 响应式页面测试',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/content/screenshot 截取不同尺寸的页面截图（800x600, 1280x720, 1920x1080），最后使用 @browser/interaction/get_interactive_elements 分析不同尺寸下的交互元素',
      description: '测试响应式页面测试 - 4个工具组合',
    },
    {
      label: '🎨 页面美化分析',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/interaction/get_interactive_elements 分析页面结构，接着使用 @browser/content/screenshot 截取页面截图，最后使用 @browser/script/inject_script 注入CSS样式优化建议',
      description: '测试页面美化分析 - 4个工具组合',
    },
    {
      label: '🔐 安全检测流程',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/network/capture_start 开始网络监控，接着使用 @browser/interaction/click 点击可疑链接，最后使用 @browser/network/capture_stop 停止监控并分析网络请求',
      description: '测试安全检测流程 - 4个工具组合',
    },
    {
      label: '📊 数据挖掘分析',
      prompt:
        '使用 @browser/content/web_fetcher 获取页面内容，然后使用 @browser/interaction/get_interactive_elements 识别数据表格，接着使用 @browser/script/inject_script 注入数据提取脚本，最后使用 @browser/script/send_command 执行数据提取',
      description: '测试数据挖掘分析 - 4个工具组合',
    },
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
            请用自然语言描述您想要的操作，或选择下面的快速操作进行测试！
          </Paragraph>

          <Divider>🚀 快速操作测试</Divider>
          <Paragraph
            style={{ fontSize: '12px', color: '#666', marginBottom: '16px', textAlign: 'center' }}
          >
            这些操作使用新的 @browser/xxx 工具名称格式，可以测试智能工具编排系统
          </Paragraph>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '12px',
            }}
          >
            {quickActions.map((action, index) => (
              <Tooltip key={index} title={action.description} placement="top">
                <Button
                  type="dashed"
                  size="small"
                  onClick={() => setInputValue(action.prompt)}
                  style={{
                    textAlign: 'left',
                    height: 'auto',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{action.label}</span>
                  <span style={{ fontSize: '11px', color: '#666', lineHeight: '1.2' }}>
                    {action.description}
                  </span>
                </Button>
              </Tooltip>
            ))}
          </div>

          <Divider style={{ margin: '24px 0 16px 0' }}>🔄 组合式调用测试</Divider>
          <Paragraph
            style={{ fontSize: '12px', color: '#666', marginBottom: '16px', textAlign: 'center' }}
          >
            这些场景测试多个工具的组合使用和智能编排能力，验证系统的复杂任务处理能力
          </Paragraph>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {combinationTestScenarios.map((scenario, index) => (
              <Tooltip key={index} title={scenario.description} placement="top">
                <Button
                  type="primary"
                  ghost
                  size="small"
                  onClick={() => setInputValue(scenario.prompt)}
                  style={{
                    textAlign: 'left',
                    height: 'auto',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                    borderColor: '#1890ff',
                    color: '#1890ff',
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{scenario.label}</span>
                  <span style={{ fontSize: '11px', color: '#666', lineHeight: '1.2' }}>
                    {scenario.description}
                  </span>
                </Button>
              </Tooltip>
            ))}
          </div>

          <Divider style={{ margin: '24px 0 16px 0' }}>💡 测试说明</Divider>
          <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
            <p>
              <strong>工具名称格式</strong>: @browser/分类/功能
            </p>
            <p>
              <strong>执行策略</strong>: 系统会自动分析工具依赖关系，智能编排执行顺序
            </p>
            <p>
              <strong>用户确认</strong>: 高风险操作（如导航、点击、脚本注入）需要用户确认
            </p>
            <p>
              <strong>并行执行</strong>: 无依赖关系的工具可以并行执行，提高效率
            </p>
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
            placeholder="描述您想要执行的操作，或使用 @browser/xxx 格式指定工具..."
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
