# 🧠 MCP 智能推理浏览器插件

一个基于 WXT 框架的 Chrome 浏览器插件，实现了类似 Cursor 的智能推理系统，集成了 MCP (Model Context Protocol) 和本地 Ollama 大模型。

## ✨ 主要特性

### 🎯 智能推理引擎
- **自动工具选择**: 根据用户输入自动分析并选择合适的 MCP 工具
- **推理链展示**: 完整显示从输入分析到工具选择、执行、结果综合的全过程
- **大模型集成**: 使用本地 Ollama deepseek-r1:1.5b 模型进行智能推理和结果综合
- **流式处理**: 实时显示推理过程的每个步骤

### 🔧 MCP 工具集
1. **echo** - 文本回显
2. **calculate** - 数学计算
3. **get_time** - 获取当前时间
4. **get_page_info** - 获取页面信息（浏览器特有）
5. **scroll_page** - 控制页面滚动（浏览器特有）

### 🎨 用户界面
- **Sidepanel 设计**: 使用 Chrome 侧边栏，不干扰正常浏览
- **实时日志**: 分类显示推理、工具、AI 等不同类型的日志
- **快捷测试**: 预设智能化测试用例
- **状态监控**: 实时显示 MCP Server 和 Ollama 连接状态

## 🏗️ 架构设计

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sidepanel     │    │   Background    │    │  Content Script │
│                 │    │                 │    │                 │
│ 推理引擎 UI      │◄──►│   MCP Server    │◄──►│   MCP Client    │
│ 用户交互界面     │    │   工具执行       │    │   页面操作       │
│ 日志显示        │    │   Ollama 代理    │    │   浮动面板       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 组件说明
- **Sidepanel**: 主要用户界面，集成智能推理引擎
- **Background Script**: 作为 MCP Server，处理工具调用和 Ollama 请求
- **Content Script**: 作为 MCP Client，处理页面级操作

## 🚀 快速开始

### 1. 环境准备
```bash
# 安装 Ollama (macOS)
brew install ollama

# 安装 deepseek-r1:1.5b 模型
ollama pull deepseek-r1:1.5b

# 启动 Ollama 服务 (支持 CORS)
OLLAMA_ORIGINS="*" ollama serve

# 或者使用项目提供的启动脚本
./start-ollama.sh
```

### 2. 构建插件
```bash
# 安装依赖
pnpm install

# 构建插件
pnpm run build
```

### 3. 安装到浏览器
1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `.output/chrome-mv3/` 目录

### 4. 使用插件
1. 点击插件图标打开侧边栏
2. 等待 MCP Server 和 Ollama 连接成功
3. 在输入框中描述你想要做什么
4. 观察智能推理过程和结果

## 💡 使用示例

### 智能计算
**输入**: "帮我算一下 15 乘以 8 再加上 7 等于多少"
**推理过程**:
1. 🧠 分析用户输入，识别数学计算需求
2. 🔧 选择 `calculate` 工具
3. ⚙️ 执行计算: `15 * 8 + 7`
4. 🤖 综合结果: "根据计算，15 × 8 + 7 = 127"

### 页面分析
**输入**: "告诉我当前页面的详细信息"
**推理过程**:
1. 🧠 分析用户输入，识别页面信息查询
2. 🔧 选择 `get_page_info` 工具
3. ⚙️ 通过 content script 获取页面数据
4. 🤖 智能分析并总结页面特征

### AI 对话
**输入**: "向我问好并介绍你的功能"
**推理过程**:
1. 🧠 分析无需工具，直接 AI 对话
2. 💭 调用 Ollama 模型生成回答
3. 🤖 输出个性化的问候和功能介绍

## 🔧 技术栈

- **框架**: WXT (Web Extension Toolkit)
- **前端**: React + TypeScript
- **MCP SDK**: @modelcontextprotocol/sdk
- **AI 模型**: Ollama + deepseek-r1:1.5b
- **构建工具**: Vite
- **样式**: CSS3 (VS Code 暗色主题风格)

## 🎯 核心创新

### 1. 智能工具选择
不再需要手动指定工具，系统会：
- 分析用户的自然语言输入
- 理解用户意图
- 自动选择最合适的工具组合
- 生成必要的参数

### 2. 推理链可视化
完整展示决策过程：
- 用户输入分析
- 工具选择推理
- 执行过程追踪
- 结果综合展示

### 3. 类 Cursor 体验
参考 Cursor IDE 的交互模式：
- 自然语言描述需求
- 自动化工具编排
- 智能结果综合
- 透明的推理过程

## 🛠️ 开发命令

```bash
# 开发模式
pnpm run dev

# 构建生产版本
pnpm run build

# 类型检查
pnpm run compile
```

## 📝 已知问题与解决方案

### 1. Ollama 连接问题
**问题**: 返回 403 错误或 CORS 错误
**解决方案**: 
```bash
# 停止现有 Ollama 进程
pkill ollama

# 使用 CORS 配置重新启动
OLLAMA_ORIGINS="*" ollama serve

# 或使用提供的脚本
./start-ollama.sh
```

### 2. 模型依赖
**问题**: 模型未安装
**解决方案**: 
```bash
ollama pull deepseek-r1:1.5b
```

### 3. 浏览器权限
**问题**: 插件无法访问 localhost
**解决方案**: 项目已配置相关权限，重新加载插件即可

## 🔮 未来规划

- [ ] 支持更多 AI 模型（OpenAI、Claude 等）
- [ ] 扩展更多浏览器特有工具
- [ ] 添加用户自定义工具
- [ ] 优化推理算法
- [ ] 支持多轮对话记忆

## 📄 许可证

ISC License

---

**🎉 体验智能推理的魅力，让浏览器插件真正"理解"你的需求！**