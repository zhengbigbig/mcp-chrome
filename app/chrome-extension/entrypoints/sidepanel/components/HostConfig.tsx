import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Divider,
  List,
  Tag,
  Input,
  Modal,
  message,
  Spin,
  Alert,
  Select,
  Form,
  Switch,
  InputNumber,
} from 'antd';
import {
  SettingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
}

interface OllamaStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  models: OllamaModel[];
  error?: string;
}

interface ModelConfig {
  defaultModel: string;
  autoSwitch: boolean;
  preferredModels: string[];
  modelSettings: Record<
    string,
    {
      temperature: number;
      topP: number;
      maxTokens: number;
      systemPrompt: string;
    }
  >;
}

export const HostConfig: React.FC = () => {
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    status: 'disconnected',
    models: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [endpoint, setEndpoint] = useState('http://localhost:11434');
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [newModelName, setNewModelName] = useState('');

  // 新增：模型配置状态
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    defaultModel: 'qwen2.5:1.5b',
    autoSwitch: false,
    preferredModels: ['qwen2.5:1.5b'],
    modelSettings: {
      'qwen2.5:1.5b': {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        systemPrompt: '',
      },
    },
  });
  const [showModelConfigModal, setShowModelConfigModal] = useState(false);
  const [selectedModelForConfig, setSelectedModelForConfig] = useState<string>('');
  const [configForm] = Form.useForm();

  useEffect(() => {
    checkOllamaConnection();
    loadModelConfig();
  }, []);

  // 加载模型配置
  const loadModelConfig = async () => {
    try {
      const savedConfig = localStorage.getItem('ollama-model-config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setModelConfig(parsed);
      } else {
        // 如果没有保存的配置，使用默认配置
        const defaultConfig: ModelConfig = {
          defaultModel: 'qwen2.5:1.5b',
          autoSwitch: false,
          preferredModels: ['qwen2.5:1.5b'],
          modelSettings: {
            'qwen2.5:1.5b': {
              temperature: 0.7,
              topP: 0.9,
              maxTokens: 2048,
              systemPrompt: '',
            },
          },
        };
        setModelConfig(defaultConfig);
        // 保存默认配置到本地存储
        localStorage.setItem('ollama-model-config', JSON.stringify(defaultConfig));
      }
    } catch (error) {
      console.error('Failed to load model config:', error);
      // 出错时也使用默认配置
      const defaultConfig: ModelConfig = {
        defaultModel: 'qwen2.5:1.5b',
        autoSwitch: false,
        preferredModels: ['qwen2.5:1.5b'],
        modelSettings: {
          'qwen2.5:1.5b': {
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 2048,
            systemPrompt: '',
          },
        },
      };
      setModelConfig(defaultConfig);
    }
  };

  // 保存模型配置
  const saveModelConfig = async (config: ModelConfig) => {
    try {
      localStorage.setItem('ollama-model-config', JSON.stringify(config));
      setModelConfig(config);
      message.success('模型配置已保存');
    } catch (error) {
      message.error('保存配置失败');
    }
  };

  // 设置默认模型
  const setDefaultModel = async (modelName: string) => {
    const newConfig = { ...modelConfig, defaultModel: modelName };
    await saveModelConfig(newConfig);
  };

  // 切换模型偏好
  const toggleModelPreference = async (modelName: string) => {
    const newPreferredModels = modelConfig.preferredModels.includes(modelName)
      ? modelConfig.preferredModels.filter((name) => name !== modelName)
      : [...modelConfig.preferredModels, modelName];

    const newConfig = { ...modelConfig, preferredModels: newPreferredModels };
    await saveModelConfig(newConfig);
  };

  // 打开模型配置弹窗
  const openModelConfig = (modelName: string) => {
    setSelectedModelForConfig(modelName);
    const currentSettings = modelConfig.modelSettings[modelName] || {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      systemPrompt: '',
    };
    configForm.setFieldsValue(currentSettings);
    setShowModelConfigModal(true);
  };

  // 保存模型设置
  const saveModelSettings = async (values: any) => {
    const newModelSettings = {
      ...modelConfig.modelSettings,
      [selectedModelForConfig]: values,
    };
    const newConfig = { ...modelConfig, modelSettings: newModelSettings };
    await saveModelConfig(newConfig);
    setShowModelConfigModal(false);
  };

  // 获取模型设置
  const getModelSettings = (modelName: string) => {
    return (
      modelConfig.modelSettings[modelName] || {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        systemPrompt: '',
      }
    );
  };

  const checkOllamaConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${endpoint}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus({
          status: 'connected',
          models: data.models || [],
        });
        message.success('Ollama 连接成功');
      } else {
        setOllamaStatus({
          status: 'error',
          models: [],
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
        message.error('Ollama 连接失败');
      }
    } catch (error) {
      setOllamaStatus({
        status: 'error',
        models: [],
        error: error instanceof Error ? error.message : '连接失败',
      });
      message.error('无法连接到 Ollama 服务');
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetch(`${endpoint}/api/tags`);
      if (response.ok) {
        message.success('连接测试成功！');
        await checkOllamaConnection();
      } else {
        message.error(`连接测试失败: HTTP ${response.status}`);
      }
    } catch (error) {
      message.error(`连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const pullModel = async (modelName: string) => {
    try {
      message.loading(`正在下载模型: ${modelName}`, 0);

      const response = await fetch(`${endpoint}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (response.ok) {
        message.destroy();
        message.success(`模型 ${modelName} 下载完成`);
        await checkOllamaConnection();
      } else {
        message.destroy();
        message.error(`下载失败: HTTP ${response.status}`);
      }
    } catch (error) {
      message.destroy();
      message.error(`下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const deleteModel = async (modelName: string) => {
    Modal.confirm({
      title: '确认删除模型',
      content: `确定要删除模型 "${modelName}" 吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch(`${endpoint}/api/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName }),
          });

          if (response.ok) {
            message.success(`模型 ${modelName} 删除成功`);
            await checkOllamaConnection();
          } else {
            message.error(`删除失败: HTTP ${response.status}`);
          }
        } catch (error) {
          message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
    });
  };

  const handleAddModel = async () => {
    if (!newModelName.trim()) {
      message.error('请输入模型名称');
      return;
    }

    try {
      await pullModel(newModelName.trim());
      setShowAddModelModal(false);
      setNewModelName('');
    } catch (error) {
      // 错误已在 pullModel 中处理
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'processing';
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
      case 'connecting':
        return '连接中';
      case 'error':
        return '连接失败';
      default:
        return '未连接';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <Title level={4}>🔧 宿主配置</Title>
      <Paragraph>管理本地 Ollama 服务连接和模型配置</Paragraph>

      {/* 连接状态 */}
      <Card title="连接状态" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Tag color={getStatusColor(ollamaStatus.status)}>
              {getStatusText(ollamaStatus.status)}
            </Tag>
            <Text>端点: {endpoint}</Text>
          </div>

          {ollamaStatus.error && (
            <Alert message="连接错误" description={ollamaStatus.error} type="error" showIcon />
          )}

          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={testConnection}
              loading={isTestingConnection}
            >
              测试连接
            </Button>
            <Button icon={<ReloadOutlined />} onClick={checkOllamaConnection} loading={isLoading}>
              刷新状态
            </Button>
          </Space>

          {ollamaStatus.status === 'connected' && ollamaStatus.models.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <Text strong>默认模型:</Text>
              <Select
                style={{ width: '200px', marginLeft: '8px' }}
                value={modelConfig.defaultModel}
                onChange={setDefaultModel}
                placeholder="选择默认模型"
              >
                {ollamaStatus.models.map((model) => (
                  <Option key={model.name} value={model.name}>
                    {model.name}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </Space>
      </Card>

      {/* 全局配置 */}
      {ollamaStatus.status === 'connected' && (
        <Card title="全局配置" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Text>自动切换模型:</Text>
              <Switch
                checked={modelConfig.autoSwitch}
                onChange={(checked) => {
                  const newConfig = { ...modelConfig, autoSwitch: checked };
                  saveModelConfig(newConfig);
                }}
              />
              <Text type="secondary">根据任务类型自动选择最适合的模型</Text>
            </div>

            <div>
              <Text strong>偏好模型:</Text>
              <Select
                mode="multiple"
                style={{ width: '100%', marginTop: '8px' }}
                value={modelConfig.preferredModels}
                onChange={(values) => {
                  const newConfig = { ...modelConfig, preferredModels: values };
                  saveModelConfig(newConfig);
                }}
                placeholder="选择偏好模型（用于自动切换）"
              >
                {ollamaStatus.models.map((model) => (
                  <Option key={model.name} value={model.name}>
                    {model.name}
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
        </Card>
      )}

      {/* 模型管理 */}
      <Card
        title="模型管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowAddModelModal(true)}
            disabled={ollamaStatus.status !== 'connected'}
          >
            添加模型
          </Button>
        }
        style={{ marginBottom: '16px' }}
      >
        {ollamaStatus.status === 'connected' ? (
          <List
            dataSource={ollamaStatus.models}
            renderItem={(model) => (
              <List.Item
                actions={[
                  <Button
                    key="config"
                    type="text"
                    icon={<SettingOutlined />}
                    onClick={() => openModelConfig(model.name)}
                    size="small"
                  >
                    配置
                  </Button>,
                  <Button
                    key="delete"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteModel(model.name)}
                    size="small"
                  >
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{model.name}</Text>
                      <Tag color="blue">{formatFileSize(model.size)}</Tag>
                      {model.name === modelConfig.defaultModel && (
                        <Tag color="green" icon={<StarFilled />}>
                          默认
                        </Tag>
                      )}
                      {modelConfig.preferredModels.includes(model.name) && (
                        <Tag color="orange" icon={<StarOutlined />}>
                          偏好
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary">修改时间: {formatDate(model.modified_at)}</Text>
                      {modelConfig.modelSettings[model.name] && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          温度: {modelConfig.modelSettings[model.name].temperature}, Top-P:{' '}
                          {modelConfig.modelSettings[model.name].topP}, 最大Token:{' '}
                          {modelConfig.modelSettings[model.name].maxTokens}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
            locale={{
              emptyText: '暂无模型，请添加模型或检查连接状态',
            }}
          />
        ) : (
          <Alert
            message="无法获取模型列表"
            description="请先确保 Ollama 服务连接正常"
            type="warning"
            showIcon
          />
        )}
      </Card>

      {/* 添加模型弹窗 */}
      <Modal
        title="添加新模型"
        open={showAddModelModal}
        onOk={handleAddModel}
        onCancel={() => {
          setShowAddModelModal(false);
          setNewModelName('');
        }}
        okText="添加"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>模型名称:</Text>
          <Search
            placeholder="例如: llama2, codellama, mistral"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            onPressEnter={handleAddModel}
            enterButton="添加"
          />
          <Text type="secondary">
            支持 HuggingFace 格式的模型名称，系统会自动从 Ollama 官方仓库下载
          </Text>
        </Space>
      </Modal>

      {/* 模型配置弹窗 */}
      <Modal
        title={`模型配置: ${selectedModelForConfig}`}
        open={showModelConfigModal}
        onOk={() => configForm.submit()}
        onCancel={() => setShowModelConfigModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={configForm} layout="vertical" onFinish={saveModelSettings}>
          <Form.Item label="默认模型" name="defaultModel">
            <Select
              style={{ width: '100%' }}
              value={modelConfig.defaultModel}
              onChange={setDefaultModel}
              disabled={selectedModelForConfig !== modelConfig.defaultModel}
            >
              {ollamaStatus.models.map((model) => (
                <Option key={model.name} value={model.name}>
                  {model.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="自动切换" name="autoSwitch">
            <Switch
              checked={modelConfig.autoSwitch}
              onChange={(checked) => {
                const newConfig = { ...modelConfig, autoSwitch: checked };
                saveModelConfig(newConfig);
              }}
            />
          </Form.Item>
          <Form.Item label="偏好模型">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={modelConfig.preferredModels}
              onChange={(values) => {
                const newConfig = { ...modelConfig, preferredModels: values };
                saveModelConfig(newConfig);
              }}
              placeholder="选择偏好模型"
            >
              {ollamaStatus.models.map((model) => (
                <Option key={model.name} value={model.name}>
                  {model.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Divider />
          <Form.Item label="温度" name="temperature">
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} placeholder="0.7" />
          </Form.Item>
          <Form.Item label="Top-P" name="topP">
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} placeholder="0.9" />
          </Form.Item>
          <Form.Item label="最大 Token" name="maxTokens">
            <InputNumber min={1} max={4096} style={{ width: '100%' }} placeholder="2048" />
          </Form.Item>
          <Form.Item label="系统提示词" name="systemPrompt">
            <Input.TextArea rows={4} placeholder="输入系统提示词..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
