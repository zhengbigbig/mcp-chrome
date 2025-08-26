# 多 MCP Server 配置指南

本指南将帮助您在 MCP Browser Extension 中配置和管理多个 MCP Server。

## 📋 目录

1. [快速开始](#快速开始)
2. [Server 类型](#server-类型)
3. [配置示例](#配置示例)
4. [管理界面](#管理界面)
5. [工具选择策略](#工具选择策略)
6. [故障排除](#故障排除)

## 🚀 快速开始

### 1. 启动测试 Server

首先启动我们提供的测试 MCP Server：

```bash
cd app/test-mcp-server
npm install
npm start
```

测试服务器将在 `http://localhost:3001` 启动，提供以下工具：

- `weather`: 获取天气信息
- `translate`: 文本翻译
- `random_number`: 生成随机数
- `system_info`: 系统信息
- `base64_encode/decode`: Base64 编码解码

### 2. 添加 Server

1. 打开浏览器插件的 sidepanel
2. 在 "🌐 Server 管理" 部分点击 "添加 Server"
3. 填写配置信息：

   - **Server 名称**: `test-server`
   - **显示名称**: `测试服务器`
   - **传输类型**: `HTTP`
   - **端点地址**: `http://localhost:3001`
   - **优先级**: `7`

4. 点击 "添加" 完成配置

## 🔧 Server 类型

### HTTP Server

- **传输类型**: `http`
- **端点格式**: `http://localhost:3001`
- **适用场景**: 独立的 HTTP API 服务

### WebSocket Server

- **传输类型**: `websocket`
- **端点格式**: `ws://localhost:3001/ws`
- **适用场景**: 需要实时通信的服务

### STDIO Server

- **传输类型**: `stdio`
- **命令示例**: `node server.js`
- **适用场景**: 本地进程通信

### 内置 Server

- **传输类型**: `builtin`
- **说明**: 浏览器插件内置的 MCP Server
- **包含工具**: 页面操作、DOM 查询、滚动控制等

## 💡 配置示例

### 示例 1: 本地开发环境

```javascript
// 测试服务器
{
  name: 'test-server',
  displayName: '测试服务器',
  type: 'http',
  endpoint: 'http://localhost:3001',
  priority: 8,
  auth: { type: 'none' }
}

// 生产 API 服务器
{
  name: 'api-server',
  displayName: 'API 服务器',
  type: 'http',
  endpoint: 'https://api.example.com/mcp',
  priority: 6,
  auth: {
    type: 'bearer',
    token: 'your-api-token'
  }
}
```

### 示例 2: 多服务器协作

```javascript
// 高优先级：数据库服务器
{
  name: 'db-server',
  displayName: '数据库服务器',
  type: 'http',
  endpoint: 'http://localhost:3002',
  priority: 9
}

// 中优先级：AI 服务器
{
  name: 'ai-server',
  displayName: 'AI 服务器',
  type: 'websocket',
  endpoint: 'ws://localhost:3003/ws',
  priority: 7
}

// 低优先级：缓存服务器
{
  name: 'cache-server',
  displayName: '缓存服务器',
  type: 'http',
  endpoint: 'http://localhost:3004',
  priority: 4
}
```

## 🎛️ 管理界面

### Server 状态指示

- 🟢 **已连接**: Server 正常运行
- 🟡 **连接中**: 正在尝试连接
- 🔴 **错误/断开**: 连接失败或断开

### Server 信息显示

每个 Server 卡片显示：

- **类型**: HTTP/WebSocket/STDIO
- **端点**: Server 地址
- **工具数量**: 可用工具总数
- **延迟**: 响应时间（毫秒）

### 操作按钮

- **移除**: 删除 Server 配置
- **检查**: 手动执行健康检查
- **刷新**: 重新加载 Server 列表

## 🧠 工具选择策略

插件使用智能策略选择最佳 Server：

### 1. 自动选择

当您使用自然语言输入时，LLM 会：

1. 分析用户意图
2. 查找可用工具
3. 选择最佳 Server（基于优先级、延迟、成功率）
4. 执行工具并返回结果

### 2. 优先级规则

- **优先级**: 1-10，数字越大优先级越高
- **延迟**: 响应时间越低优先级越高
- **成功率**: 历史成功率越高优先级越高
- **健康状态**: 只有健康的 Server 会被选择

### 3. 负载均衡

- 相同工具在多个 Server 上可用时，自动选择最佳 Server
- 失败时自动切换到备用 Server
- 支持并行工具调用以提高性能

## 🔍 故障排除

### 连接问题

**问题**: Server 显示红色状态（连接失败）

**解决方案**:

1. 检查 Server 是否正在运行
2. 验证端点地址是否正确
3. 检查防火墙设置
4. 查看 CORS 配置（HTTP Server）

### 工具不可用

**问题**: 某些工具无法调用

**解决方案**:

1. 点击 "检查" 按钮重新检查 Server 状态
2. 点击 "刷新" 重新加载工具列表
3. 检查 Server 日志查看错误信息

### 性能问题

**问题**: 工具调用缓慢

**解决方案**:

1. 检查网络连接
2. 调整 Server 优先级
3. 考虑使用本地 Server 减少延迟

## 🎯 最佳实践

### 1. Server 命名

- 使用描述性名称（如 `ai-server`、`db-server`）
- 避免特殊字符和空格

### 2. 优先级设置

- **10**: 关键生产服务器
- **7-9**: 重要服务器
- **4-6**: 普通服务器
- **1-3**: 备用/测试服务器

### 3. 监控和维护

- 定期检查 Server 健康状态
- 监控延迟和成功率
- 及时移除不可用的 Server

### 4. 安全考虑

- 使用 HTTPS 端点（生产环境）
- 正确配置身份验证
- 定期更新访问令牌

## 📝 API 参考

### Server 配置对象

```typescript
interface ServerConfig {
  name: string; // Server 唯一标识
  displayName: string; // 显示名称
  type: 'http' | 'websocket' | 'stdio' | 'builtin';
  endpoint?: string; // HTTP/WebSocket 端点
  command?: string; // STDIO 命令
  args?: string[]; // STDIO 参数
  auth?: {
    // 身份验证
    type: 'none' | 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
  timeout?: number; // 超时时间（毫秒）
  retryCount?: number; // 重试次数
  priority?: number; // 优先级 1-10
  enabled?: boolean; // 是否启用
  metadata?: Record<string, any>; // 元数据
}
```

## 🤝 贡献

如果您有新的 Server 类型或功能建议，欢迎提交 Issue 或 Pull Request！

---

**注意**: 此功能需要 MCP Browser Extension v1.0+ 支持。
