// Content Script - MCP Client 实现
// 在页面上下文中运行，作为 MCP Client 并处理页面交互

import axios from 'axios';

// MCP Client 类
class BrowserMCPClient {
  private ollamaBaseUrl: string = 'http://localhost:11434';
  private ollamaModel: string = 'deepseek-r1:1.5b';

  constructor() {
    console.log('[Content] MCP Client 初始化');
  }

  // 获取可用工具列表
  async getAvailableTools(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'MCP_LIST_TOOLS' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response.success) {
            resolve(response.tools);
          } else {
            reject(new Error(response.error || '获取工具列表失败'));
          }
        }
      );
    });
  }

  // 调用 MCP 工具
  async callTool(name: string, args: any = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'MCP_CALL_TOOL', name, args },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response.success) {
            const result = response.result;
            if (result.content && result.content.length > 0) {
              resolve(result.content[0].text || '工具执行完成，但没有返回内容');
            } else {
              resolve('工具执行完成');
            }
          } else {
            reject(new Error(response.error || '工具调用失败'));
          }
        }
      );
    });
  }

  // 通过 background script 代理 Ollama 请求
  async chatWithOllama(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestData = {
        model: this.ollamaModel,
        prompt: message,
        stream: false,
      };

      chrome.runtime.sendMessage(
        { 
          type: 'OLLAMA_REQUEST', 
          url: `${this.ollamaBaseUrl}/api/generate`,
          data: requestData
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response.success) {
            resolve(response.result.response || '模型没有返回响应');
          } else {
            reject(new Error(response.error || 'Ollama 请求失败'));
          }
        }
      );
    });
  }

  // 智能处理用户输入
  async processUserInput(input: string): Promise<string> {
    try {
      // 检查是否需要使用工具
      const toolResult = await this.tryUseTools(input);
      if (toolResult) {
        return toolResult;
      }

      // 使用 Ollama 模型处理
      return await this.chatWithOllama(input);
    } catch (error) {
      return `处理输入时出错: ${error instanceof Error ? error.message : error}`;
    }
  }

  // 尝试使用工具处理输入
  private async tryUseTools(input: string): Promise<string | null> {
    const lowerInput = input.toLowerCase();

    // 简单的关键词匹配来决定使用哪个工具
    if (lowerInput.includes('回显') || lowerInput.includes('echo')) {
      const text = input.replace(/.*?回显|.*?echo/i, '').trim();
      return await this.callTool('echo', { text });
    }

    if (lowerInput.includes('计算') || lowerInput.includes('算')) {
      // 提取数学表达式
      const mathRegex = /[\d+\-*/.() ]+/;
      const match = input.match(mathRegex);
      if (match) {
        return await this.callTool('calculate', { expression: match[0].trim() });
      }
    }

    if (lowerInput.includes('时间') || lowerInput.includes('现在几点')) {
      return await this.callTool('get_time');
    }

    if (lowerInput.includes('页面信息') || lowerInput.includes('页面') || lowerInput.includes('page info')) {
      return await this.callTool('get_page_info');
    }

    if (lowerInput.includes('滚动') || lowerInput.includes('scroll')) {
      const direction = lowerInput.includes('上') || lowerInput.includes('up') ? 'up' :
                      lowerInput.includes('下') || lowerInput.includes('down') ? 'down' :
                      lowerInput.includes('顶部') || lowerInput.includes('top') ? 'top' :
                      lowerInput.includes('底部') || lowerInput.includes('bottom') ? 'bottom' : 'down';
      return await this.callTool('scroll_page', { direction });
    }

    return null;
  }

  // 获取当前页面信息
  getPageInfo(): any {
    const info = {
      title: document.title,
      url: window.location.href,
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      timestamp: new Date().toISOString(),
      elementCount: document.querySelectorAll('*').length,
      hasImages: document.querySelectorAll('img').length > 0,
      hasLinks: document.querySelectorAll('a').length > 0,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    console.log('[Content] 页面信息:', info);
    return info;
  }

  // 页面滚动控制
  scrollPage(direction: string): { message: string } {
    const scrollAmount = 500;
    
    switch (direction) {
      case 'up':
        window.scrollBy(0, -scrollAmount);
        break;
      case 'down':
        window.scrollBy(0, scrollAmount);
        break;
      case 'top':
        window.scrollTo(0, 0);
        break;
      case 'bottom':
        window.scrollTo(0, document.documentElement.scrollHeight);
        break;
      default:
        window.scrollBy(0, scrollAmount);
    }

    return { message: `页面已向 ${direction} 滚动` };
  }

  // 创建浮动控制面板
  createFloatingPanel(): void {
    // 避免重复创建
    if (document.getElementById('mcp-floating-panel')) {
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'mcp-floating-panel';
    panel.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: #1e1e1e;
        color: #d4d4d4;
        border: 1px solid #464647;
        border-radius: 8px;
        padding: 15px;
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          font-weight: bold;
        ">
          <span>🤖 MCP Client</span>
          <button id="mcp-close-btn" style="
            background: none;
            border: none;
            color: #d4d4d4;
            cursor: pointer;
            font-size: 16px;
          ">×</button>
        </div>
        
        <div style="margin-bottom: 10px;">
          <input 
            id="mcp-input" 
            placeholder="输入命令或问题..."
            style="
              width: 100%;
              padding: 8px;
              background: #3c3c3c;
              border: 1px solid #464647;
              color: #d4d4d4;
              border-radius: 4px;
              font-size: 12px;
            "
          />
        </div>
        
        <div style="margin-bottom: 10px;">
          <button id="mcp-send-btn" style="
            background: #0e639c;
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-right: 5px;
          ">发送</button>
          
          <button id="mcp-get-info-btn" style="
            background: #165a3e;
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">页面信息</button>
        </div>
        
        <div 
          id="mcp-output" 
          style="
            background: #2d2d30;
            border: 1px solid #464647;
            border-radius: 4px;
            padding: 8px;
            max-height: 200px;
            overflow-y: auto;
            font-size: 11px;
            line-height: 1.4;
          "
        >
          <div style="color: #569cd6;">MCP Client 已就绪 ✅</div>
          <div style="color: #dcdcaa;">尝试输入：回显 Hello、计算 2+3、现在几点、页面信息、滚动下</div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // 绑定事件
    const input = document.getElementById('mcp-input') as HTMLInputElement;
    const output = document.getElementById('mcp-output') as HTMLDivElement;
    const sendBtn = document.getElementById('mcp-send-btn') as HTMLButtonElement;
    const getInfoBtn = document.getElementById('mcp-get-info-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('mcp-close-btn') as HTMLButtonElement;

    const addOutput = (message: string, type: 'user' | 'system' | 'error' = 'system') => {
      const colors = {
        user: '#569cd6',
        system: '#4ec9b0',
        error: '#f14c4c',
      };
      
      const div = document.createElement('div');
      div.style.color = colors[type];
      div.style.marginBottom = '5px';
      div.textContent = message;
      output.appendChild(div);
      output.scrollTop = output.scrollHeight;
    };

    const handleInput = async () => {
      const value = input.value.trim();
      if (!value) return;

      addOutput(`> ${value}`, 'user');
      input.value = '';

      try {
        const response = await this.processUserInput(value);
        addOutput(response, 'system');
      } catch (error) {
        addOutput(`错误: ${error instanceof Error ? error.message : error}`, 'error');
      }
    };

    sendBtn.addEventListener('click', handleInput);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleInput();
      }
    });

    getInfoBtn.addEventListener('click', async () => {
      try {
        const result = await this.callTool('get_page_info');
        addOutput(result, 'system');
      } catch (error) {
        addOutput(`获取页面信息失败: ${error instanceof Error ? error.message : error}`, 'error');
      }
    });

    closeBtn.addEventListener('click', () => {
      panel.remove();
    });

    console.log('[Content] 浮动面板已创建');
  }
}

// 全局 MCP Client 实例
const mcpClient = new BrowserMCPClient();

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] 收到消息:', message);

  if (message.type === 'GET_PAGE_INFO') {
    const pageInfo = mcpClient.getPageInfo();
    sendResponse(pageInfo);
    return true;
  }

  if (message.type === 'SCROLL_PAGE') {
    const result = mcpClient.scrollPage(message.direction);
    sendResponse(result);
    return true;
  }

  if (message.type === 'SHOW_PAGE_INFO') {
    // 显示页面信息到控制台或创建浮动窗口
    console.log('[Content] 页面信息:', message.data);
    mcpClient.createFloatingPanel();
    return true;
  }

  if (message.type === 'TOGGLE_PANEL') {
    mcpClient.createFloatingPanel();
    return true;
  }

  if (message.type === 'PROCESS_INPUT') {
    const { input } = message;
    mcpClient.processUserInput(input).then((response) => {
      sendResponse(response);
    }).catch((error) => {
      sendResponse(`处理失败: ${error instanceof Error ? error.message : error}`);
    });
    return true; // 保持消息通道开放
  }

  return false;
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Content] MCP Client 已加载到页面');
  });
} else {
  console.log('[Content] MCP Client 已加载到页面');
}

// 快捷键支持（Ctrl+Shift+M 显示/隐藏面板）
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    mcpClient.createFloatingPanel();
  }
});

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    console.log('[Content] MCP Client 已初始化');
  },
});