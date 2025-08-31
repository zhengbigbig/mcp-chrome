import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Divider, List, Tag, Input, Modal, message, Spin, Alert } from 'antd';
import { SettingOutlined, PlayCircleOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

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

  useEffect(() => {
    checkOllamaConnection();
  }, []);

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
            <Alert
              message="连接错误"
              description={ollamaStatus.error}
              type="error"
              showIcon
            />
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
            <Button
              icon={<ReloadOutlined />}
              onClick={checkOllamaConnection}
              loading={isLoading}
            >
              刷新状态
            </Button>
          </Space>
        </Space>
      </Card>

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
                    key="delete"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteModel(model.name)}
                    size="small"
                  >
                    删除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{model.name}</Text>
                      <Tag color="blue">{formatFileSize(model.size)}</Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary">
                      修改时间: {formatDate(model.modified_at)}
                    </Text>
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
    </div>
  );
};
