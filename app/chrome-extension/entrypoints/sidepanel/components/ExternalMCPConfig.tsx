import React, { useState, useEffect } from 'react';
import { ServerConfig, ServerStatus } from '../../../utils/mcp/server-registry';
import { multiMCPClient } from '../../../utils/mcp/multi-mcp-client';

interface ExternalMCPConfigProps {
  onClose: () => void;
}

export const ExternalMCPConfig: React.FC<ExternalMCPConfigProps> = ({ onClose }) => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 新服务器表单状态
  const [newServer, setNewServer] = useState<Partial<ServerConfig>>({
    name: '',
    displayName: '',
    type: 'http',
    endpoint: '',
    priority: 5,
    enabled: true,
    timeout: 10000,
    retryCount: 2,
    auth: { type: 'none' },
  });

  useEffect(() => {
    loadServers();
    loadServerStatuses();
  }, []);

  const loadServers = async () => {
    try {
      const allServers = multiMCPClient.getAllServers();
      const configs = allServers.map((server) => server.config);
      setServers(configs.filter((config) => config.name !== 'builtin'));
    } catch (error) {
      console.error('加载服务器配置失败:', error);
    }
  };

  const loadServerStatuses = async () => {
    try {
      const healthResults = await multiMCPClient.healthCheck();
      const statuses: Record<string, ServerStatus> = {};

      for (const [serverName, isHealthy] of Object.entries(healthResults)) {
        const server = multiMCPClient.getAllServers().find((s) => s.config.name === serverName);
        if (server) {
          statuses[serverName] = server.status;
        }
      }

      setServerStatuses(statuses);
    } catch (error) {
      console.error('加载服务器状态失败:', error);
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.displayName || !newServer.endpoint) {
      alert('请填写必要的服务器信息');
      return;
    }

    setIsLoading(true);
    try {
      const config: ServerConfig = {
        ...(newServer as ServerConfig),
        name: newServer.name!,
        displayName: newServer.displayName!,
        endpoint: newServer.endpoint!,
        type: newServer.type || 'http',
        priority: newServer.priority || 5,
        enabled: newServer.enabled !== false,
        timeout: newServer.timeout || 10000,
        retryCount: newServer.retryCount || 2,
        auth: { type: 'none' },
      };

      await multiMCPClient.addServer(config);
      await loadServers();
      await loadServerStatuses();

      // 重置表单
      setNewServer({
        name: '',
        displayName: '',
        type: 'http',
        endpoint: '',
        priority: 5,
        enabled: true,
        timeout: 10000,
        retryCount: 2,
        auth: { type: 'none' },
      });
      setIsAdding(false);
    } catch (error) {
      console.error('添加服务器失败:', error);
      alert(`添加服务器失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditServer = async (config: ServerConfig) => {
    setIsLoading(true);
    try {
      // 先移除旧配置
      await multiMCPClient.removeServer(config.name);
      // 添加新配置
      await multiMCPClient.addServer(config);
      await loadServers();
      await loadServerStatuses();
      setEditingServer(null);
    } catch (error) {
      console.error('编辑服务器失败:', error);
      alert(`编辑服务器失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveServer = async (serverName: string) => {
    if (!confirm(`确定要移除服务器 "${serverName}" 吗？`)) {
      return;
    }

    setIsLoading(true);
    try {
      await multiMCPClient.removeServer(serverName);
      await loadServers();
      await loadServerStatuses();
    } catch (error) {
      console.error('移除服务器失败:', error);
      alert(`移除服务器失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleServer = async (serverName: string, enabled: boolean) => {
    setIsLoading(true);
    try {
      const server = servers.find((s) => s.name === serverName);
      if (server) {
        const updatedConfig = { ...server, enabled };
        await multiMCPClient.removeServer(serverName);
        await multiMCPClient.addServer(updatedConfig);
        await loadServers();
        await loadServerStatuses();
      }
    } catch (error) {
      console.error('切换服务器状态失败:', error);
      alert(`切换服务器状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中';
      case 'disconnected':
        return '已断开';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  return (
    <div className="external-mcp-config">
      <div className="config-header">
        <h2>🔗 外部MCP服务器配置</h2>
        <button className="btn secondary" onClick={onClose}>
          关闭
        </button>
      </div>

      {/* 添加新服务器 */}
      {!isAdding ? (
        <button className="btn primary add-server-btn" onClick={() => setIsAdding(true)}>
          ➕ 添加新服务器
        </button>
      ) : (
        <div className="add-server-form">
          <h3>添加新MCP服务器</h3>
          <div className="form-row">
            <label>服务器名称:</label>
            <input
              type="text"
              value={newServer.name}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              placeholder="my-mcp-server"
            />
          </div>
          <div className="form-row">
            <label>显示名称:</label>
            <input
              type="text"
              value={newServer.displayName}
              onChange={(e) => setNewServer({ ...newServer, displayName: e.target.value })}
              placeholder="我的MCP服务器"
            />
          </div>
          <div className="form-row">
            <label>传输类型:</label>
            <select
              value={newServer.type}
              onChange={(e) => setNewServer({ ...newServer, type: e.target.value as any })}
            >
              <option value="http">HTTP</option>
              <option value="websocket">WebSocket</option>
              <option value="stdio">STDIO</option>
            </select>
          </div>
          <div className="form-row">
            <label>端点地址:</label>
            <input
              type="text"
              value={newServer.endpoint}
              onChange={(e) => setNewServer({ ...newServer, endpoint: e.target.value })}
              placeholder="http://localhost:3000 或 ws://localhost:3001"
            />
          </div>
          <div className="form-row">
            <label>优先级:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={newServer.priority}
              onChange={(e) => setNewServer({ ...newServer, priority: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>超时时间(ms):</label>
            <input
              type="number"
              min="1000"
              max="60000"
              value={newServer.timeout}
              onChange={(e) => setNewServer({ ...newServer, timeout: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>重试次数:</label>
            <input
              type="number"
              min="0"
              max="5"
              value={newServer.retryCount}
              onChange={(e) => setNewServer({ ...newServer, retryCount: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>认证类型:</label>
            <select
              value={newServer.auth?.type}
              onChange={(e) =>
                setNewServer({
                  ...newServer,
                  auth: { ...newServer.auth, type: e.target.value as any },
                })
              }
            >
              <option value="none">无认证</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>
          {newServer.auth?.type === 'bearer' && (
            <div className="form-row">
              <label>Token:</label>
              <input
                type="password"
                value={newServer.auth.token || ''}
                onChange={(e) =>
                  setNewServer({
                    ...newServer,
                    auth: { ...newServer.auth, token: e.target.value },
                  })
                }
                placeholder="Bearer token"
              />
            </div>
          )}
          {newServer.auth?.type === 'basic' && (
            <>
              <div className="form-row">
                <label>用户名:</label>
                <input
                  type="text"
                  value={newServer.auth.username || ''}
                  onChange={(e) =>
                    setNewServer({
                      ...newServer,
                      auth: { ...newServer.auth, username: e.target.value },
                    })
                  }
                  placeholder="用户名"
                />
              </div>
              <div className="form-row">
                <label>密码:</label>
                <input
                  type="password"
                  value={newServer.auth.password || ''}
                  onChange={(e) =>
                    setNewServer({
                      ...newServer,
                      auth: { ...newServer.auth, password: e.target.value },
                    })
                  }
                  placeholder="密码"
                />
              </div>
            </>
          )}
          <div className="form-actions">
            <button className="btn primary" onClick={handleAddServer} disabled={isLoading}>
              {isLoading ? '添加中...' : '添加服务器'}
            </button>
            <button
              className="btn secondary"
              onClick={() => setIsAdding(false)}
              disabled={isLoading}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 服务器列表 */}
      <div className="servers-list">
        <h3>已配置的服务器</h3>
        {servers.length === 0 ? (
          <p className="no-servers">暂无外部MCP服务器配置</p>
        ) : (
          servers.map((server) => (
            <div key={server.name} className="server-item">
              <div className="server-info">
                <div className="server-header">
                  <h4>{server.displayName}</h4>
                  <span className="server-name">({server.name})</span>
                  <span className={`status ${serverStatuses[server.name]?.status || 'unknown'}`}>
                    {getStatusIcon(serverStatuses[server.name]?.status || 'unknown')}
                    {getStatusText(serverStatuses[server.name]?.status || 'unknown')}
                  </span>
                </div>
                <div className="server-details">
                  <span>类型: {server.type}</span>
                  <span>端点: {server.endpoint}</span>
                  <span>优先级: {server.priority}</span>
                  <span>超时: {server.timeout}ms</span>
                  {server.auth?.type !== 'none' && <span>认证: {server.auth.type}</span>}
                </div>
              </div>
              <div className="server-actions">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={server.enabled !== false}
                    onChange={(e) => handleToggleServer(server.name, e.target.checked)}
                    disabled={isLoading}
                  />
                  <span className="slider"></span>
                </label>
                <button
                  className="btn small secondary"
                  onClick={() => setEditingServer(server)}
                  disabled={isLoading}
                >
                  编辑
                </button>
                <button
                  className="btn small danger"
                  onClick={() => handleRemoveServer(server.name)}
                  disabled={isLoading}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 编辑服务器弹窗 */}
      {editingServer && (
        <div className="edit-server-modal">
          <div className="modal-content">
            <h3>编辑服务器: {editingServer.displayName}</h3>
            <div className="form-row">
              <label>显示名称:</label>
              <input
                type="text"
                value={editingServer.displayName}
                onChange={(e) =>
                  setEditingServer({ ...editingServer, displayName: e.target.value })
                }
              />
            </div>
            <div className="form-row">
              <label>端点地址:</label>
              <input
                type="text"
                value={editingServer.endpoint}
                onChange={(e) => setEditingServer({ ...editingServer, endpoint: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>优先级:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={editingServer.priority}
                onChange={(e) =>
                  setEditingServer({ ...editingServer, priority: parseInt(e.target.value) })
                }
              />
            </div>
            <div className="form-row">
              <label>超时时间(ms):</label>
              <input
                type="number"
                min="1000"
                max="60000"
                value={editingServer.timeout}
                onChange={(e) =>
                  setEditingServer({ ...editingServer, timeout: parseInt(e.target.value) })
                }
              />
            </div>
            <div className="form-actions">
              <button
                className="btn primary"
                onClick={() => handleEditServer(editingServer)}
                disabled={isLoading}
              >
                {isLoading ? '保存中...' : '保存'}
              </button>
              <button
                className="btn secondary"
                onClick={() => setEditingServer(null)}
                disabled={isLoading}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
