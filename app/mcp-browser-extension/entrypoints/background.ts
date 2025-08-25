// Background Script - MCP Server 实现
// 在浏览器插件的 background 上下文中实现 MCP Server 功能

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// MCP Tool 定义
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// MCP Server 实现
class BrowserMCPServer {
  private tools: MCPTool[] = [
    {
      name: 'echo',
      description: '回显输入的文本',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: '要回显的文本',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'calculate',
      description: '执行简单的数学计算',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '数学表达式，例如: "2 + 3 * 4"',
          },
        },
        required: ['expression'],
      },
    },
    {
      name: 'get_time',
      description: '获取当前时间',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_page_info',
      description: '获取当前页面信息（浏览器插件特有功能）',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'scroll_page',
      description: '滚动页面（浏览器插件特有功能）',
      inputSchema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            description: '滚动方向: up, down, top, bottom',
          },
        },
        required: ['direction'],
      },
    },
  ];

  // 获取工具列表
  getTools(): MCPTool[] {
    return this.tools;
  }

  // 调用工具
  async callTool(name: string, args: any = {}): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      switch (name) {
        case 'echo':
          return {
            content: [
              {
                type: 'text',
                text: `回显: ${args?.text || ''}`,
              },
            ],
          };

        case 'calculate': {
          const expression = args?.expression as string;
          if (!expression) {
            throw new Error('缺少表达式参数');
          }
          
          const result = this.safeEval(expression);
          return {
            content: [
              {
                type: 'text',
                text: `计算结果: ${expression} = ${result}`,
              },
            ],
          };
        }

        case 'get_time': {
          const now = new Date();
          return {
            content: [
              {
                type: 'text',
                text: `当前时间: ${now.toLocaleString('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                })}`,
              },
            ],
          };
        }

        case 'get_page_info': {
          // 通过 content script 获取页面信息
          const pageInfo = await this.getPageInfo();
          return {
            content: [
              {
                type: 'text',
                text: `页面信息: ${JSON.stringify(pageInfo, null, 2)}`,
              },
            ],
          };
        }

        case 'scroll_page': {
          // 通过 content script 控制页面滚动
          const scrollResult = await this.scrollPage(args?.direction || 'down');
          return {
            content: [
              {
                type: 'text',
                text: `页面滚动: ${scrollResult}`,
              },
            ],
          };
        }

        default:
          throw new Error(`未知工具: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return {
        content: [
          {
            type: 'text',
            text: `错误: ${errorMessage}`,
          },
        ],
      };
    }
  }

  // 安全的数学表达式计算
  private safeEval(expression: string): number {
    // 只允许数字、基本运算符和空格
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
    if (sanitized !== expression) {
      throw new Error('表达式包含不允许的字符');
    }

    try {
      // 使用 Function 构造函数进行安全计算
      const result = new Function('return ' + sanitized)();
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('计算结果无效');
      }
      return result;
    } catch (error) {
      throw new Error('表达式计算失败');
    }
  }

  // 获取页面信息（通过 content script）
  private async getPageInfo(): Promise<any> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('无法获取当前标签页');
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_PAGE_INFO',
      });

      return response || { error: '无法获取页面信息' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : '获取页面信息失败' };
    }
  }

  // 控制页面滚动（通过 content script）
  private async scrollPage(direction: string): Promise<string> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('无法获取当前标签页');
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'SCROLL_PAGE',
        direction,
      });

      return response?.message || '滚动完成';
    } catch (error) {
      return `滚动失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }
}

// 全局 MCP Server 实例
const mcpServer = new BrowserMCPServer();

// 消息处理
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  console.log('[Background] 收到消息:', message);

  if (message.type === 'MCP_LIST_TOOLS') {
    const tools = mcpServer.getTools();
    console.log('[Background] 返回工具列表:', tools);
    sendResponse({ success: true, tools });
    return true;
  }

  if (message.type === 'MCP_CALL_TOOL') {
    const { name, args } = message;
    console.log('[Background] 调用工具:', name, args);
    
    mcpServer.callTool(name, args).then((result) => {
      console.log('[Background] 工具执行结果:', result);
      sendResponse({ success: true, result });
    }).catch((error) => {
      console.error('[Background] 工具执行失败:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      });
    });
    
    return true; // 保持消息通道开放
  }

  // Ollama 代理请求
  if (message.type === 'OLLAMA_REQUEST') {
    const { url, data } = message;
    console.log('[Background] Ollama 请求:', url, data);
    
    const fetchOptions: RequestInit = {
      method: data === null ? 'GET' : 'POST',
      headers: data === null ? {} : {
        'Content-Type': 'application/json',
      },
    };
    
    if (data !== null) {
      fetchOptions.body = JSON.stringify(data);
    }
    
    fetch(url, fetchOptions)
    .then(async response => {
      const responseText = await response.text();
      console.log('[Background] Ollama 原始响应:', responseText);
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(`Ollama CORS 错误 (403): 请重启 Ollama 服务并设置 OLLAMA_ORIGINS="*"`);
        }
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      // 检查响应是否为空
      if (!responseText.trim()) {
        throw new Error('Ollama 返回空响应');
      }
      
      try {
        const result = JSON.parse(responseText);
        console.log('[Background] Ollama 解析结果:', result);
        sendResponse({ success: true, result });
      } catch (parseError) {
        console.error('[Background] JSON 解析失败:', parseError, '原始响应:', responseText);
        sendResponse({ 
          success: false, 
          error: `JSON 解析失败: ${parseError instanceof Error ? parseError.message : parseError}` 
        });
      }
    })
    .catch(error => {
      console.error('[Background] Ollama 请求失败:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : '请求失败' 
      });
    });
    
    return true; // 保持消息通道开放
  }

  return false;
});

export default defineBackground(() => {
  console.log('[Background] MCP Server 初始化完成');
  
  // 插件安装时的初始化
  chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] MCP Browser Extension 已安装');
    
    // 启用 sidepanel
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: any) => console.error(error));
    
    // 创建右键菜单
    chrome.contextMenus.create({
      id: 'mcp-demo',
      title: 'MCP Demo - 获取页面信息',
      contexts: ['page'],
    });
  });

  // 处理 action 点击（打开 sidepanel）
  chrome.action.onClicked.addListener(async (tab: any) => {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      console.log('[Background] Sidepanel 已打开');
    } catch (error) {
      console.error('[Background] 打开 sidepanel 失败:', error);
    }
  });

  // 右键菜单点击处理
  chrome.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
    if (info.menuItemId === 'mcp-demo' && tab?.id) {
      try {
        const result = await mcpServer.callTool('get_page_info');
        console.log('[Background] 页面信息:', result);
        
        // 可以选择在控制台显示或发送到 content script
        chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_PAGE_INFO',
          data: result,
        });
      } catch (error) {
        console.error('[Background] 获取页面信息失败:', error);
      }
    }
  });
});