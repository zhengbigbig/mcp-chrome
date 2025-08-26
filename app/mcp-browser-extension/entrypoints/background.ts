// Background Script - 真正的 MCP Server 实现
// 使用 @modelcontextprotocol/sdk 在浏览器插件中实现标准 MCP Server

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';

// 浏览器 MCP Transport 实现
class BrowserMCPTransport {
  private messageHandlers: Map<string, (message: any) => Promise<any>> = new Map();

  constructor() {
    // 监听来自其他部分的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type && message.type.startsWith('MCP_')) {
        this.handleMessage(message).then(response => {
          sendResponse(response);
        }).catch(error => {
          sendResponse({ error: error.message });
        });
        return true; // 保持消息通道开放
      }
    });
  }

  private async handleMessage(message: any): Promise<any> {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      return await handler(message);
    }
    throw new Error(`Unknown message type: ${message.type}`);
  }

  onMessage(type: string, handler: (message: any) => Promise<any>) {
    this.messageHandlers.set(type, handler);
  }

  sendMessage(type: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, ...data }, resolve);
    });
  }
}

// 真正的 MCP Server 实现
class BrowserMCPServer {
  private server: Server;
  private transport: BrowserMCPTransport;
  private tools: Tool[] = [
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
    } as Tool,
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
    } as Tool,
    {
      name: 'get_time',
      description: '获取当前时间',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    } as Tool,
    {
      name: 'get_page_info',
      description: '获取当前页面信息（浏览器插件特有功能）',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    } as Tool,
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
    } as Tool,
  ];

  constructor() {
    this.transport = new BrowserMCPTransport();
    this.server = new Server(
      {
        name: 'mcp-browser-extension-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupTransport();
  }

  private setupTransport() {
    // 将 MCP 协议消息路由到真正的 MCP Server
    this.transport.onMessage('MCP_LIST_TOOLS', async () => {
      return await this.server.request(
        { method: 'tools/list' },
        ListToolsRequestSchema
      );
    });

    this.transport.onMessage('MCP_CALL_TOOL', async (message) => {
      return await this.server.request(
        { 
          method: 'tools/call', 
          params: { 
            name: message.name, 
            arguments: message.args 
          } 
        },
        CallToolRequestSchema
      );
    });
  }

  private setupToolHandlers() {
    // 设置工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
      return {
        tools: this.tools,
      };
    });

    // 设置工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;
      return await this.callTool(name, args);
    });
  }

  // 获取工具列表（兼容旧接口）
  getTools(): Tool[] {
    return this.tools;
  }

  // 调用工具 - 返回标准 MCP CallToolResult
  async callTool(name: string, args: any = {}): Promise<CallToolResult> {
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

  // 获取可用模型列表
  if (message.type === 'OLLAMA_LIST_MODELS') {
    console.log('[Background] 获取 Ollama 模型列表');
    
    fetch('http://localhost:11434/api/tags', {
      method: 'GET',
    })
    .then(async response => {
      const responseText = await response.text();
      console.log('[Background] 模型列表响应:', responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
      
      try {
        const result = JSON.parse(responseText);
        const models = result.models || [];
        sendResponse({ 
          success: true, 
          models: models.map((model: any) => ({
            name: model.name,
            size: model.size,
            modified_at: model.modified_at,
            parameter_size: model.details?.parameter_size || 'Unknown',
            family: model.details?.family || 'Unknown'
          }))
        });
      } catch (parseError) {
        console.error('[Background] 模型列表解析失败:', parseError);
        sendResponse({ 
          success: false, 
          error: `JSON 解析失败: ${parseError instanceof Error ? parseError.message : parseError}` 
        });
      }
    })
    .catch(error => {
      console.error('[Background] 获取模型列表失败:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : '获取模型列表失败' 
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