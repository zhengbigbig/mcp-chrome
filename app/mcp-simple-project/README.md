# MCP Simple Project

一个基于 @modelcontextprotocol/sdk 包的简单 MCP server 和 client 实现，集成了 Ollama deepseek-r1:1.5b 模型。

## 功能特性

- 🚀 **简单的 MCP Server**: 提供基本工具功能（回显、计算、获取时间）
- 🤖 **智能 MCP Client**: 集成 Ollama deepseek-r1:1.5b 模型，支持自然语言交互
- 🔧 **工具自动识别**: 根据用户输入自动选择使用 MCP 工具或 AI 模型
- 💬 **交互式会话**: 支持命令行交互式对话
- 🌊 **流式响应**: 支持 Ollama 模型的流式输出

## 环境要求

1. **Node.js** >= 16.0.0
2. **Ollama** 服务运行在 `http://localhost:11434`
3. **deepseek-r1:1.5b** 模型已安装

## 技术栈

- **后端**: TypeScript + @modelcontextprotocol/sdk + Axios
- **前端**: React + TypeScript + Vite
- **AI 集成**: Ollama API

### 安装 Ollama 和模型

```bash
# 安装 Ollama (macOS)
brew install ollama

# 启动 Ollama 服务
ollama serve

# 安装 deepseek-r1:1.5b 模型
ollama pull deepseek-r1:1.5b
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 测试环境

```bash
# 测试 Ollama 连接和模型
npm run test-ollama
```

### 3. 启动项目

```bash
# 🎯 调试页面（推荐）- 可视化调试界面
npm run debug-ui

# 命令行模式
npm run dev      # 启动交互式客户端
npm run server   # 启动 MCP Server
npm run client   # 启动 MCP Client
```

## 🎨 调试页面功能

调试页面提供了一个可视化的界面来测试和调试 MCP 功能：

### 左侧面板 - MCP Server
- **服务器状态**: 显示服务器连接状态
- **工具测试**: 可以直接测试 echo、calculate、get_time 工具
- **实时日志**: 显示服务器端的所有操作日志
- **参数配置**: 支持自定义工具参数

### 右侧面板 - MCP Client  
- **客户端状态**: 显示客户端和 Ollama 连接状态
- **智能交互**: 自动识别用户意图，选择工具或 AI 模型
- **Ollama 配置**: 可配置 Ollama 服务地址和模型
- **对话测试**: 支持与 deepseek-r1:1.5b 模型对话

### 使用示例
1. 访问 `http://localhost:3000` 打开调试页面
2. 点击"启动服务器"启动 MCP Server
3. 点击"连接 MCP"连接客户端到服务器  
4. 点击"连接 Ollama"连接到 AI 模型
5. 在右侧输入框测试各种功能

## 使用方法

启动客户端后，你可以：

### 使用 MCP 工具
- **回显文本**: `回显 你好世界` 或 `echo hello world`
- **数学计算**: `计算 2 + 3 * 4` 或 `算一下 10 / 2`
- **查看时间**: `现在几点` 或 `时间`

### 与 AI 模型对话
- 直接输入任何问题，如：`你好，请介绍一下你自己`
- 系统会自动判断是使用工具还是 AI 模型回答

### 示例对话

```
你: 回显 Hello MCP!
🤖 回显: Hello MCP!

你: 计算 15 * 8 + 7
🤖 计算结果: 15 * 8 + 7 = 127

你: 现在几点
🤖 当前时间: 2024-01-15 14:30:25

你: 请解释一下什么是 MCP
🤖 MCP (Model Context Protocol) 是一个...
```

## 项目结构

```
mcp-simple-project/
├── src/
│   ├── index.ts            # 命令行主入口
│   ├── server.ts           # MCP Server 实现
│   ├── client.ts           # MCP Client 和 Ollama 集成
│   └── debug-ui/           # React 调试页面
│       ├── index.tsx       # React 入口
│       ├── index.html      # HTML 模板
│       ├── styles.css      # 样式文件
│       └── components/     # React 组件
├── vite.config.ts          # Vite 配置
├── package.json            # 项目配置和依赖
├── tsconfig.json           # TypeScript 配置
├── README.md               # 项目说明
└── QUICK_START.md          # 快速启动指南
```

## 可用命令

```bash
# 开发命令
npm run dev          # 开发模式，启动交互式客户端
npm run server       # 只启动 MCP Server
npm run client       # 只启动 MCP Client
npm run test-ollama  # 测试 Ollama 连接

# 调试页面
npm run debug-ui     # 启动 React 调试页面 (推荐)
npm run build-ui     # 构建调试页面

# 构建命令
npm run build        # 编译 TypeScript
npm run start        # 运行编译后的代码
```

## MCP Server 工具

### 1. echo (回显)
- **描述**: 回显输入的文本
- **参数**: `text` (string) - 要回显的文本

### 2. calculate (计算)
- **描述**: 执行简单的数学计算
- **参数**: `expression` (string) - 数学表达式，如 "2 + 3 * 4"

### 3. get_time (获取时间)
- **描述**: 获取当前时间
- **参数**: 无

## 配置选项

### Ollama 配置

默认配置：
- **服务地址**: `http://localhost:11434`
- **模型**: `deepseek-r1:1.5b`

可以通过环境变量或代码修改：

```typescript
const client = new SimpleMCPClient(
  'http://your-ollama-server:11434',  // 自定义服务地址
  'your-model-name'                   // 自定义模型名称
);
```

## 故障排除

### 1. Ollama 服务不可用
```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 启动 Ollama 服务
ollama serve
```

### 2. 模型不存在
```bash
# 列出已安装的模型
ollama list

# 安装 deepseek-r1:1.5b 模型
ollama pull deepseek-r1:1.5b
```

### 3. MCP Server 连接失败
- 确保没有其他进程占用相同端口
- 检查 TypeScript 编译是否成功
- 查看错误日志获取详细信息

## 开发说明

### 扩展 MCP 工具

在 `src/server.ts` 中添加新工具：

```typescript
// 添加到工具列表
{
  name: 'your_tool',
  description: '工具描述',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: '参数描述' }
    },
    required: ['param']
  }
}

// 添加工具处理逻辑
case 'your_tool':
  // 实现工具逻辑
  return { content: [{ type: 'text', text: '结果' }] };
```

### 自定义 AI 模型

修改 `src/client.ts` 中的 OllamaClient 配置或替换为其他 AI 服务。

## 许可证

ISC License

## 贡献

欢迎提交 Issue 和 Pull Request！
