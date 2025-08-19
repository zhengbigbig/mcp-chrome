# 🚀 MCP Simple Project - 快速启动指南

## 🎯 调试页面（推荐方式）

### 1. 启动调试页面
```bash
cd /Users/zhengzhiheng/Desktop/github/mcp-chrome/app/mcp-simple-project
npm run debug-ui
```

### 2. 访问页面
打开浏览器访问：**http://localhost:3000**

### 3. 使用步骤
1. **左侧面板（MCP Server）**：
   - 点击 "启动服务器" 按钮
   - 等待服务器状态变为绿色
   - 可以测试工具：echo、calculate、get_time

2. **右侧面板（MCP Client）**：
   - 点击 "连接 MCP" 连接到服务器
   - 点击 "连接 Ollama" 连接到 AI 模型
   - 在输入框中测试各种功能

### 4. 测试示例
在右侧输入框中尝试这些命令：
- `回显 Hello World` - 测试回显工具
- `计算 2 + 3 * 4` - 测试计算工具  
- `现在几点` - 测试时间工具
- `你好，请介绍一下自己` - 测试 AI 对话

## 🖥️ 命令行模式

### 测试 Ollama 连接
```bash
npm run test-ollama
```

### 启动交互式客户端
```bash
npm run dev
```

### 分别启动服务器和客户端
```bash
# 终端 1：启动服务器
npm run server

# 终端 2：启动客户端  
npm run client
```

## 🔧 故障排除

### 调试页面无法启动
```bash
# 检查端口占用
lsof -i:3000

# 终止占用进程
lsof -ti:3000 | xargs kill -9

# 重新启动 (使用 Vite)
npm run debug-ui
```

### 如果遇到模块解析错误
```bash
# 清除 node_modules 并重新安装
rm -rf node_modules package-lock.json
npm install

# 重新启动
npm run debug-ui
```

### Ollama 连接失败
```bash
# 检查 Ollama 服务
curl http://localhost:11434/api/tags

# 启动 Ollama 服务
ollama serve

# 安装模型
ollama pull deepseek-r1:1.5b
```

## 🎨 调试页面功能介绍

### 左侧 - MCP Server 面板
- ✅ **服务器状态指示器**：显示连接状态
- 🔧 **工具选择器**：选择要测试的工具
- ⚙️ **参数配置**：自定义工具参数
- 📝 **实时日志**：显示所有服务器操作
- 🎮 **执行控制**：启动/停止服务器

### 右侧 - MCP Client 面板  
- 🔗 **双重连接状态**：MCP + Ollama 状态
- 🤖 **智能识别**：自动选择工具或 AI 模型
- ⚙️ **Ollama 配置**：自定义服务地址和模型
- 💬 **交互输入**：支持自然语言输入
- 📊 **详细日志**：显示所有客户端操作

### 特色功能
- 🎯 **可视化调试**：无需命令行，直观操作
- 🔄 **实时反馈**：即时显示操作结果
- 📱 **响应式设计**：适配不同屏幕尺寸
- 🌙 **暗色主题**：护眼的开发者友好界面
- 📋 **JSON 查看器**：格式化显示数据结构

---

**💡 提示**：推荐使用调试页面进行开发和测试，它提供了更直观的交互体验！
