# 测试 MCP Server

一个独立的 MCP (Model Context Protocol) 服务器，用于测试多 Server 功能。

## 🚀 快速启动

### 方式一：使用脚本

```bash
./start.sh
```

### 方式二：手动启动

```bash
npm install
npm start
```

### 方式三：开发模式

```bash
npm run dev
```

## 📡 服务端点

启动后可以通过以下端点访问：

- **HTTP API**: `http://localhost:3001`
- **WebSocket**: `ws://localhost:3001/ws`
- **健康检查**: `http://localhost:3001/health`
- **服务器信息**: `http://localhost:3001/info`

## 🔧 支持的工具

### 1. weather - 天气查询

获取指定城市的模拟天气信息。

**参数**:

- `city` (required): 城市名称
- `unit` (optional): 温度单位 (`celsius` 或 `fahrenheit`)

**示例**:

```json
{
  "name": "weather",
  "arguments": {
    "city": "北京",
    "unit": "celsius"
  }
}
```

### 2. translate - 文本翻译

模拟翻译文本到指定语言。

**参数**:

- `text` (required): 要翻译的文本
- `from` (optional): 源语言代码
- `to` (required): 目标语言代码

**示例**:

```json
{
  "name": "translate",
  "arguments": {
    "text": "hello",
    "to": "zh"
  }
}
```

### 3. random_number - 随机数生成

生成指定范围内的随机数。

**参数**:

- `min` (optional): 最小值，默认 0
- `max` (optional): 最大值，默认 100
- `count` (optional): 生成数量，默认 1

**示例**:

```json
{
  "name": "random_number",
  "arguments": {
    "min": 1,
    "max": 10,
    "count": 3
  }
}
```

### 4. system_info - 系统信息

获取服务器系统信息。

**参数**: 无

**示例**:

```json
{
  "name": "system_info",
  "arguments": {}
}
```

### 5. base64_encode - Base64 编码

对文本进行 Base64 编码。

**参数**:

- `text` (required): 要编码的文本

**示例**:

```json
{
  "name": "base64_encode",
  "arguments": {
    "text": "Hello World"
  }
}
```

### 6. base64_decode - Base64 解码

对 Base64 字符串进行解码。

**参数**:

- `encoded` (required): 要解码的 Base64 字符串

**示例**:

```json
{
  "name": "base64_decode",
  "arguments": {
    "encoded": "SGVsbG8gV29ybGQ="
  }
}
```

## 🧪 测试方法

### HTTP API 测试

1. **获取工具列表**:

```bash
curl -X POST http://localhost:3001/tools/list \
  -H "Content-Type: application/json"
```

2. **调用工具**:

```bash
curl -X POST http://localhost:3001/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "name": "weather",
      "arguments": {
        "city": "上海",
        "unit": "celsius"
      }
    }
  }'
```

3. **健康检查**:

```bash
curl http://localhost:3001/health
```

### 在浏览器插件中添加

1. 打开浏览器插件的 Server 管理页面
2. 添加新的 Server：
   - **名称**: `test-server`
   - **显示名称**: `测试服务器`
   - **类型**: `http`
   - **端点**: `http://localhost:3001`
   - **优先级**: `8`

## 🔧 配置选项

可以通过环境变量配置：

- `PORT`: 服务器端口，默认 3001

```bash
PORT=4000 npm start
```

## 📊 特性

- ✅ 支持标准 MCP 协议
- ✅ HTTP 和 WebSocket 双传输方式
- ✅ 6 个测试工具
- ✅ 健康检查和服务信息端点
- ✅ CORS 支持
- ✅ 优雅关闭
- ✅ 详细日志输出

## 🚀 与浏览器插件集成

这个测试服务器专门设计用于验证浏览器插件的多 Server 功能：

1. **多样化工具**: 提供不同类型的工具（天气、翻译、编码等）
2. **不同延迟**: 模拟真实网络环境
3. **错误处理**: 测试错误情况和重试机制
4. **负载均衡**: 验证多 Server 之间的智能路由

使用这个测试服务器，你可以验证：

- 工具选择的智能性
- 多 Server 之间的负载均衡
- 错误时的自动切换
- 性能监控和统计

## 📝 开发说明

基于 @modelcontextprotocol/sdk 构建，完全兼容 MCP 标准。可以作为开发其他 MCP Server 的参考实现。
