# Chrome扩展 MCP 客户端使用指南

## 🎉 更新说明

已成功实现基于 `@modelcontextprotocol/sdk` 的MCP客户端，现在可以在Chrome扩展的sidepanel中使用！

## ✨ 新功能

### 1. 修复的SidePanel API

- 正确实现了Chrome扩展的sidePanel打开机制
- 在popup中点击"打开MCP客户端"按钮现在可以正常工作
- 通过background script处理sidepanel的打开请求

### 2. 标准MCP协议实现

- 使用官方 `@modelcontextprotocol/sdk` 类型定义
- 完整的JSON-RPC 2.0协议支持
- 标准的MCP初始化、工具列表和工具调用流程

### 3. 增强的错误处理

- 完善的错误捕获和处理机制
- 详细的错误信息反馈
- 优雅的降级处理

## 🚀 使用步骤

### 1. 启动开发环境

```bash
cd app/chrome-extension
npm run dev
```

### 2. 加载扩展

1. 打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `app/chrome-extension/.output/chrome-mv3` 目录

### 3. 使用MCP客户端

1. 点击扩展图标打开popup
2. 点击底部的"打开MCP客户端"按钮
3. sidepanel将打开显示MCP客户端界面

### 4. 与Ollama交互

1. 确保本地Ollama服务运行：`ollama serve`
2. 确保已安装deepseek-r1:1.5b模型：`ollama pull deepseek-r1:1.5b`
3. 在sidepanel中输入问题开始对话

## 🔧 技术实现

### MCP协议流程

1. **初始化**: 发送 `initialize` 请求建立连接
2. **工具列表**: 通过 `tools/list` 获取可用工具
3. **工具调用**: 使用 `tools/call` 执行具体工具

### 消息传递架构

```
Sidepanel MCP Client → Background Script → MCP Server → Chrome APIs
```

### 支持的MCP方法

- `initialize`: 协议初始化
- `tools/list`: 获取工具列表
- `tools/call`: 调用具体工具

### 可用工具

- `browser_screenshot`: 截图功能
- `browser_get_tabs`: 标签页信息
- `browser_get_page_content`: 页面内容提取
- `browser_get_console_logs`: 控制台日志

## 🐛 调试指南

### 查看日志

1. **Background Script**: `chrome://extensions/` → 扩展详情 → "服务工作进程"
2. **Sidepanel**: 在sidepanel中右键 → "检查"
3. **Popup**: 在popup中右键 → "检查"

### 常见问题

#### Sidepanel无法打开

- 检查Chrome版本是否支持sidePanel API (Chrome 114+)
- 查看background script控制台是否有错误
- 确认扩展权限配置正确

#### MCP通信失败

- 检查MCP服务器是否运行
- 查看background script中的MCP请求处理日志
- 确认JSON-RPC消息格式正确

#### Ollama连接问题

- 确认Ollama服务运行在localhost:11434
- 检查模型是否正确安装
- 查看网络请求是否被阻止

## 📝 开发说明

### 关键文件

- `entrypoints/sidepanel/`: MCP客户端实现
- `entrypoints/background/index.ts`: MCP请求处理
- `entrypoints/popup/components/App.tsx`: 打开sidepanel的按钮

### 扩展开发

要添加新的MCP工具：

1. 在 `background/index.ts` 的 `handleMCPRequest` 中添加工具定义
2. 在 `tools/` 目录中实现具体的工具逻辑
3. 在 `sidepanel/services/MCPClientService.ts` 中添加工具调用逻辑

## 🎯 下一步计划

- [ ] 添加更多浏览器工具
- [ ] 实现流式对话支持
- [ ] 添加工具调用历史记录
- [ ] 优化用户界面体验
- [ ] 添加配置选项

---

现在你可以享受完整的MCP客户端体验了！🎊
