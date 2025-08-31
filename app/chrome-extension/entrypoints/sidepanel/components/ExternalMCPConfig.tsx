import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Typography, 
  List, 
  Tag, 
  Modal, 
  message, 
  Form, 
  Select, 
  Switch,
  Tooltip,
  Popconfirm,
  Badge,
  Alert,
  Input
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { createMCPClient, ExternalMCPClient } from '../../../utils/mcp/external-mcp-client';
import { ChromeMCPClient } from '../../../utils/mcp/mcp-client';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface ExternalMCPConfigProps {
  onClose?: () => void;
}

interface ServerConfig {
  id: string;
  name: string;
  type: 'http' | 'websocket' | 'stdio' | 'internal';
  endpoint: string;
  auth?: {
    type: 'none' | 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
  options?: {
    timeout?: number;
    retries?: number;
  };
  enabled: boolean;
}

// 内置 MCP 客户端
const internalMCPClient = new ChromeMCPClient();

export const ExternalMCPConfig: React.FC<ExternalMCPConfigProps> = ({ onClose }) => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentServer, setCurrentServer] = useState<ServerConfig | null>(null);
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatuses, setServerStatuses] = useState<Record<string, 'connected' | 'disconnected' | 'error'>>({});
  
  // 新增：工具弹窗相关状态
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [toolsModalTitle, setToolsModalTitle] = useState('');
  const [toolsModalContent, setToolsModalContent] = useState<React.ReactNode>(null);
  const [toolsModalLoading, setToolsModalLoading] = useState(false);

  useEffect(() => {
    loadServers();
    loadServerStatuses();
  }, []);

  const loadServers = async () => {
    try {
      // 初始化服务器列表：内部服务器 + localhost:3002
      setServers([
        {
          id: 'localhost-3002',
          name: 'Local MCP Server',
          type: 'http',
          endpoint: 'http://localhost:3002',
          auth: { type: 'none' },
          enabled: true,
        }
      ]);
    } catch (error) {
      console.error('加载服务器列表失败:', error);
      message.error('加载服务器列表失败');
    }
  };

  const loadServerStatuses = async () => {
    try {
      // 初始化服务器状态
      setServerStatuses({
        'localhost-3002': 'disconnected'
      });
    } catch (error) {
      console.error('加载服务器状态失败:', error);
    }
  };

  const handleAddServer = async (values: any) => {
    try {
      const newServer: ServerConfig = {
        id: Date.now().toString(),
        ...values,
        enabled: true,
      };
      
      setServers(prev => [...prev, newServer]);
      message.success('服务器添加成功');
      setShowAddModal(false);
      form.resetFields();
    } catch (error) {
      message.error('添加服务器失败');
    }
  };

  const handleEditServer = async (values: any) => {
    if (!currentServer) return;

    try {
      setServers(prev => prev.map(server => 
        server.id === currentServer.id ? { ...server, ...values } : server
      ));

      message.success('服务器配置更新成功');
      setShowEditModal(false);
      setCurrentServer(null);
      form.resetFields();
    } catch (error) {
      message.error('更新服务器配置失败');
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      // 不允许删除内部服务器和 localhost:3002
      if (serverId === 'localhost-3002') {
        message.warning('不能删除预配置的本地服务器');
        return;
      }
      
      setServers(prev => prev.filter(server => server.id !== serverId));
      message.success('服务器删除成功');
    } catch (error) {
      message.error('删除服务器失败');
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    try {
      setServers(prev => prev.map(server => 
        server.id === serverId ? { ...server, enabled } : server
      ));
      
      message.success(`服务器已${enabled ? '启用' : '禁用'}`);
    } catch (error) {
      message.error('切换服务器状态失败');
    }
  };

  const testConnection = async (server: ServerConfig) => {
    setIsLoading(true);
    try {
      // 实际连接测试逻辑
      if (server.endpoint === 'http://localhost:3002') {
        // 测试 localhost:3002 连接
        const response = await fetch(`${server.endpoint}/health`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          message.success('连接测试成功 - 本地 MCP 服务器运行正常');
          setServerStatuses(prev => ({ ...prev, [server.id]: 'connected' }));
        } else {
          message.error(`连接测试失败 - HTTP ${response.status}: ${response.statusText}`);
          setServerStatuses(prev => ({ ...prev, [server.id]: 'error' }));
        }
      } else {
        // 其他服务器的连接测试
        const response = await fetch(`${server.endpoint}/health`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          message.success('连接测试成功');
          setServerStatuses(prev => ({ ...prev, [server.id]: 'connected' }));
        } else {
          message.error(`连接测试失败 - HTTP ${response.status}: ${response.statusText}`);
          setServerStatuses(prev => ({ ...prev, [server.id]: 'error' }));
        }
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      message.error(`连接测试失败: ${error instanceof Error ? error.message : '网络错误'}`);
      setServerStatuses(prev => ({ ...prev, [server.id]: 'error' }));
    } finally {
      setIsLoading(false);
    }
  };

  const viewTools = async (server: ServerConfig) => {
    try {
      // 外部服务器的工具列表
      setToolsModalLoading(true);
      setToolsModalTitle(`${server.name} 的工具列表`);
      
      // 内置服务的工具列表
      if (server.type === 'internal' || server.endpoint === 'internal') {
        setToolsModalTitle(`${server.name} 的工具列表`);
        try {
          const tools = await internalMCPClient.listTools();
          setToolsModalContent(
            <div>
              <Alert
                message="内置浏览器工具"
                description="这些工具直接集成在 Chrome 扩展中，通过 MCP 协议提供"
                type="info"
                style={{ marginBottom: 16 }}
              />
              <List
                dataSource={tools}
                renderItem={(tool: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={tool.name}
                      description={tool.description || '无描述'}
                    />
                    <Tag color="green">browser</Tag>
                  </List.Item>
                )}
              />
            </div>
          );
        } catch (error) {
          setToolsModalContent(
            <div>
              <Alert
                message="获取内置工具失败"
                description={`无法获取内置工具列表：${error instanceof Error ? error.message : '未知错误'}`}
                type="error"
                showIcon
              />
            </div>
          );
        }
        setShowToolsModal(true);
        return;
      }

      // 外部服务器的工具列表
      try {
        // 创建 MCP 客户端
        const mcpClient = createMCPClient(
          server.type,
          server.endpoint,
          { timeout: server.options?.timeout || 30000 }
        );

        // 通过 MCP 协议获取工具列表
        const tools = await mcpClient.listTools();
        
        if (tools && tools.length > 0) {
          setToolsModalContent(
            <div>
              <Alert
                message="MCP 协议连接成功"
                description={`通过 ${server.type.toUpperCase()} 传输成功获取到 ${tools.length} 个工具`}
                type="success"
                style={{ marginBottom: 16 }}
              />
              <List
                dataSource={tools}
                renderItem={(tool: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={tool.name}
                      description={tool.description || '无描述'}
                    />
                    <Tag color="blue">{server.name}</Tag>
                  </List.Item>
                )}
              />
            </div>
          );
        } else {
          setToolsModalContent(
            <div>
              <Alert
                message="工具列表为空"
                description={`服务器 ${server.endpoint} 返回了空的工具列表。这可能是因为：
                1. 服务器没有注册任何工具
                2. 服务器配置问题
                3. 权限不足`}
                type="warning"
                showIcon
              />
            </div>
          );
        }
      } catch (error) {
        console.error('Failed to get tools via MCP:', error);
        
        setToolsModalContent(
          <div>
            <Alert
              message="MCP 协议连接失败"
              description={`无法通过 MCP 协议连接到服务器 ${server.endpoint}：
              
              错误信息: ${error instanceof Error ? error.message : '网络错误'}
              
              请检查：
              1. 服务器是否正在运行
              2. 服务器是否支持 MCP 协议
              3. 传输类型是否正确 (${server.type})
              4. 网络连接和防火墙设置`}
              type="error"
              showIcon
            />
          </div>
        );
      }
      
      setShowToolsModal(true);
    } catch (error) {
      console.error('Unexpected error in viewTools:', error);
      message.error(`获取工具列表失败: ${error instanceof Error ? error.message : '网络错误'}`);
    } finally {
      setToolsModalLoading(false);
    }
  };

  const openEditModal = (server: ServerConfig) => {
    // 不允许编辑内部服务器和 localhost:3002
    if (server.id === 'localhost-3002') {
      message.warning('不能编辑预配置的本地服务器');
      return;
    }
    
    setCurrentServer(server);
    form.setFieldsValue(server);
    setShowEditModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'disconnected':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return '已连接';
      case 'disconnected':
        return '未连接';
      case 'error':
        return '连接错误';
      default:
        return '未知';
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <Title level={4}>🔌 MCP 配置</Title>
      <Paragraph>管理外部 MCP 服务器连接和配置</Paragraph>

      {/* 内部服务器状态 */}
      <Card title="内部服务器" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Tag color="success" icon={<CheckCircleOutlined />}>
              已连接
            </Tag>
            <Text>内部 MCP 服务器 (Chrome Extension)</Text>
          </div>
          <Text type="secondary">
            提供浏览器自动化工具，包括截图、内容提取、页面操作等
          </Text>
          <Button
            type="text"
            icon={<ApiOutlined />}
            onClick={() => {
              viewTools({ 
                id: 'internal', 
                name: '内部 MCP 服务器', 
                type: 'internal', 
                endpoint: 'internal', 
                enabled: true 
              });
            }}
            size="small"
          >
            查看工具列表
          </Button>
        </Space>
      </Card>

      {/* 外部服务器列表 */}
      <Card 
        title="外部服务器" 
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowAddModal(true)}
          >
            添加服务器
          </Button>
        }
        style={{ marginBottom: '16px' }}
      >
        <List
          dataSource={servers}
          renderItem={(server) => (
            <List.Item
              actions={[
                <Tooltip key="test" title="测试连接">
                  <Button
                    type="text"
                    icon={<CheckCircleOutlined />}
                    onClick={() => testConnection(server)}
                    loading={isLoading}
                    size="small"
                  >
                    测试
                  </Button>
                </Tooltip>,
                <Tooltip key="tools" title="查看工具">
                  <Button
                    type="text"
                    icon={<ApiOutlined />}
                    onClick={() => {
                      viewTools(server);
                    }}
                    size="small"
                  >
                    工具
                  </Button>
                </Tooltip>,
                server.id !== 'localhost-3002' && (
                  <Tooltip key="edit" title="编辑配置">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(server)}
                      size="small"
                    >
                      编辑
                    </Button>
                  </Tooltip>
                ),
                server.id !== 'localhost-3002' && (
                  <Popconfirm
                    key="delete"
                    title="确认删除"
                    description={`确定要删除服务器 "${server.name}" 吗？`}
                    onConfirm={() => handleDeleteServer(server.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{server.name}</Text>
                    <Tag color="blue">{server.type.toUpperCase()}</Tag>
                    <Badge
                      status={getStatusColor(serverStatuses[server.id] || 'default')}
                      text={getStatusText(serverStatuses[server.id] || 'default')}
                    />
                  </Space>
                }
                description={
                  <Space direction="vertical" size="small">
                    <Text type="secondary">{server.endpoint}</Text>
                    <Switch
                      checked={server.enabled}
                      onChange={(checked) => handleToggleServer(server.id, checked)}
                      size="small"
                    />
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{
            emptyText: '暂无外部服务器，点击右上角按钮添加',
          }}
        />
      </Card>

      {/* 添加服务器弹窗 */}
      <Modal
        title="添加外部 MCP 服务器"
        open={showAddModal}
        onCancel={() => {
          setShowAddModal(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddServer}
          initialValues={{
            type: 'http',
            auth: { type: 'none' },
            options: { timeout: 30000, retries: 3 },
          }}
        >
          <Form.Item
            name="name"
            label="服务器名称"
            rules={[{ required: true, message: '请输入服务器名称' }]}
          >
            <Input placeholder="例如: OpenAI GPT-4" />
          </Form.Item>

          <Form.Item
            name="type"
            label="连接类型"
            rules={[{ required: true, message: '请选择连接类型' }]}
          >
            <Select>
              <Option value="http">HTTP</Option>
              <Option value="websocket">WebSocket</Option>
              <Option value="stdio">STDIO</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="endpoint"
            label="端点地址"
            rules={[{ required: true, message: '请输入端点地址' }]}
          >
            <Input placeholder="例如: https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item label="认证配置">
            <Form.Item name={['auth', 'type']} noStyle>
              <Select style={{ width: '100%' }}>
                <Option value="none">无认证</Option>
                <Option value="bearer">Bearer Token</Option>
                <Option value="basic">Basic Auth</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.auth?.type !== currentValues.auth?.type
              }
            >
              {({ getFieldValue }) => {
                const authType = getFieldValue(['auth', 'type']);
                if (authType === 'bearer') {
                  return (
                    <Form.Item
                      name={['auth', 'token']}
                      style={{ marginTop: 8 }}
                      rules={[{ required: true, message: '请输入 Token' }]}
                    >
                      <Input.Password placeholder="Bearer Token" />
                    </Form.Item>
                  );
                } else if (authType === 'basic') {
                  return (
                    <Space style={{ marginTop: 8, width: '100%' }}>
                      <Form.Item
                        name={['auth', 'username']}
                        rules={[{ required: true, message: '请输入用户名' }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="用户名" />
                      </Form.Item>
                      <Form.Item
                        name={['auth', 'password']}
                        rules={[{ required: true, message: '请输入密码' }]}
                        style={{ flex: 1 }}
                      >
                        <Input.Password placeholder="密码" />
                      </Form.Item>
                    </Space>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Form.Item>

          <Form.Item label="连接选项">
            <Space style={{ width: '100%' }}>
              <Form.Item
                name={['options', 'timeout']}
                label="超时时间(ms)"
                style={{ flex: 1 }}
              >
                <Input type="number" placeholder="30000" />
              </Form.Item>
              <Form.Item
                name={['options', 'retries']}
                label="重试次数"
                style={{ flex: 1 }}
              >
                <Input type="number" placeholder="3" />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                添加服务器
              </Button>
              <Button onClick={() => {
                setShowAddModal(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑服务器弹窗 */}
      <Modal
        title="编辑服务器配置"
        open={showEditModal}
        onCancel={() => {
          setShowEditModal(false);
          setCurrentServer(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditServer}
        >
          <Form.Item
            name="name"
            label="服务器名称"
            rules={[{ required: true, message: '请输入服务器名称' }]}
          >
            <Input placeholder="例如: OpenAI GPT-4" />
          </Form.Item>

          <Form.Item
            name="type"
            label="连接类型"
            rules={[{ required: true, message: '请选择连接类型' }]}
          >
            <Select>
              <Option value="http">HTTP</Option>
              <Option value="websocket">WebSocket</Option>
              <Option value="stdio">STDIO</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="endpoint"
            label="端点地址"
            rules={[{ required: true, message: '请输入端点地址' }]}
          >
            <Input placeholder="例如: https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="认证配置">
            <Form.Item name={['auth', 'type']} noStyle>
              <Select style={{ width: '100%' }}>
                <Option value="none">无认证</Option>
                <Option value="bearer">Bearer Token</Option>
                <Option value="basic">Basic Auth</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.auth?.type !== currentValues.auth?.type
              }
            >
              {({ getFieldValue }) => {
                const authType = getFieldValue(['auth', 'type']);
                if (authType === 'bearer') {
                  return (
                    <Form.Item
                      name={['auth', 'token']}
                      style={{ marginTop: 8 }}
                      rules={[{ required: true, message: '请输入 Token' }]}
                    >
                      <Input.Password placeholder="Bearer Token" />
                    </Form.Item>
                  );
                } else if (authType === 'basic') {
                  return (
                    <Space style={{ marginTop: 8, width: '100%' }}>
                      <Form.Item
                        name={['auth', 'username']}
                        rules={[{ required: true, message: '请输入用户名' }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="用户名" />
                      </Form.Item>
                      <Form.Item
                        name={['auth', 'password']}
                        rules={[{ required: true, message: '请输入密码' }]}
                        style={{ flex: 1 }}
                      >
                        <Input.Password placeholder="密码" />
                      </Form.Item>
                    </Space>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Form.Item>

          <Form.Item label="连接选项">
            <Space style={{ width: '100%' }}>
              <Form.Item
                name={['options', 'timeout']}
                label="超时时间(ms)"
                style={{ flex: 1 }}
              >
                <Input type="number" placeholder="30000" />
              </Form.Item>
              <Form.Item
                name={['options', 'retries']}
                label="重试次数"
                style={{ flex: 1 }}
              >
                <Input type="number" placeholder="3" />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存配置
              </Button>
              <Button onClick={() => {
                setShowEditModal(false);
                setCurrentServer(null);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 工具弹窗 */}
      <Modal
        title={toolsModalTitle}
        open={showToolsModal}
        onCancel={() => setShowToolsModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowToolsModal(false)}>
            关闭
          </Button>
        ]}
        width={600}
        confirmLoading={toolsModalLoading}
      >
        {toolsModalContent}
      </Modal>
    </div>
  );
};
