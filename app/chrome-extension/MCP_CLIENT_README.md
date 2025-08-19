# Chrome扩展 MCP 客户端使用指南

## 概述

本Chrome扩展现在包含一个完整的MCP（Model Context Protocol）客户端，可以在sidepanel中与本地的Ollama模型（deepseek-r1:1.5b）进行交互，同时能够调用Chrome扩展提供的各种浏览器工具。

## 功能特性

### 🤖 AI 对话

- 集成本地Ollama模型（deepseek-r1:1.5b）
- 支持自然语言交互
- 智能工具调用

### 🔧 浏览器工具集成

- 截图功能
- 标签页管理
- 页面导航
- 内容提取
- 控制台日志查看
- 网络请求监控

### 🎨 用户界面

- 现代化聊天界面
- 实时连接状态显示
- 流畅的交互体验

## 安装和配置

### 1. 确保Ollama运行

首先确保你的本地Ollama服务正在运行，并且已经安装了deepseek-r1:1.5b模型：

```bash
# 启动Ollama服务
ollama serve

# 拉取deepseek-r1:1.5b模型（如果尚未安装）
ollama pull deepseek-r1:1.5b
```

### 2. 启动Chrome扩展

1. 在Chrome扩展的popup中，确保MCP服务器正在运行
2. 点击popup底部的"打开MCP客户端"按钮
3. 这将在sidepanel中打开MCP客户端界面

### 3. 验证连接

在sidepanel中，你应该看到：

- Ollama连接状态（绿色表示已连接）
- MCP连接状态（绿色表示已连接）

## 使用方法

### 基本对话

直接在输入框中输入问题，AI会使用deepseek-r1:1.5b模型回复：

```
你好，请介绍一下你自己
```

### 浏览器工具调用

使用自然语言描述你想要执行的浏览器操作：

#### 截图相关

```
请帮我截取当前页面的截图
截取完整页面的屏幕截图
```

#### 标签页管理

```
显示所有打开的标签页
查看当前打开的页面
```

#### 页面内容

```
获取当前页面的文本内容
显示网页内容
```

#### 调试信息

```
查看控制台日志
显示网络请求记录
```

### 智能工具选择

客户端会自动分析你的请求，决定是否需要调用浏览器工具：

- 包含浏览器相关关键词的请求会触发工具调用
- 纯对话请求直接使用Ollama模型回复

## 技术架构

### 组件结构

```
entrypoints/sidepanel/
├── main.ts              # 入口文件
├── style.css           # 样式文件
├── components/
│   └── App.tsx         # 主应用组件
└── services/
    ├── OllamaClient.ts    # Ollama客户端服务
    └── MCPClientService.ts # MCP客户端服务
```

### 服务说明

#### OllamaClient

- 连接本地Ollama服务（默认端口11434）
- 支持deepseek-r1:1.5b模型
- 提供聊天和流式聊天功能
- 自动模型检测和拉取

#### MCPClientService

- 与Chrome扩展的MCP服务器通信
- 智能工具选择和调用
- 结果格式化和展示

## 故障排除

### 连接问题

#### Ollama连接失败

1. 确保Ollama服务正在运行：`ollama serve`
2. 检查端口11434是否被占用
3. 确认deepseek-r1:1.5b模型已安装

#### MCP连接失败

1. 确保Chrome扩展的MCP服务器正在运行
2. 在popup中检查连接状态
3. 尝试重新连接MCP服务器

### 功能问题

#### 工具调用失败

1. 检查Chrome扩展权限
2. 确保在支持的网页上使用
3. 查看控制台错误信息

#### 界面问题

1. 刷新sidepanel页面
2. 检查Chrome版本是否支持sidePanel API
3. 确认扩展已正确安装

## 开发信息

### API端点

- Ollama: `http://localhost:11434`
- 模型: `deepseek-r1:1.5b`

### 支持的工具

- `browser_screenshot`: 截图
- `browser_get_tabs`: 获取标签页
- `browser_navigate`: 页面导航
- `browser_get_page_content`: 获取页面内容
- `browser_click_element`: 点击元素
- `browser_type_text`: 输入文本
- `browser_get_console_logs`: 获取控制台日志
- `browser_get_network_logs`: 获取网络日志

### 扩展功能

可以通过修改`MCPClientService.ts`中的`analyzeUserMessage`方法来添加更多工具调用逻辑。

## 更新日志

### v1.0.0

- 初始版本发布
- 集成Ollama deepseek-r1:1.5b模型
- 实现基础MCP客户端功能
- 添加浏览器工具集成
- 创建现代化用户界面

---

如有问题或建议，请查看Chrome扩展的开发者工具控制台获取详细错误信息。
