// Background Script MCP Server - wraps existing tools as MCP server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool,
  CallToolResult 
} from '@modelcontextprotocol/sdk/types.js';
import { handleCallTool } from '../../entrypoints/background/tools';
import * as browserTools from '../../entrypoints/background/tools/browser';

/**
 * Custom transport for Chrome Extension background script
 */
export class BackgroundMCPTransport {
  private messageListeners: Map<string, (data: any) => void> = new Map();

  constructor() {
    // Set up message listener for Chrome runtime messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'MCP_REQUEST') {
        this.handleMCPRequest(message.payload, sendResponse);
        return true; // Keep message channel open for async response
      }
    });
  }

  private async handleMCPRequest(request: any, sendResponse: (response: any) => void) {
    try {
      const listener = this.messageListeners.get(request.method);
      if (listener) {
        const result = await listener(request);
        sendResponse({ success: true, data: result });
      } else {
        sendResponse({ success: false, error: `Unknown method: ${request.method}` });
      }
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  onRequest(method: string, handler: (data: any) => Promise<any>) {
    this.messageListeners.set(method, handler);
  }
}

/**
 * Background MCP Server - exposes existing browser tools as MCP server
 */
export class BackgroundMCPServer {
  private server: Server;
  private transport: BackgroundMCPTransport;

  constructor() {
    this.transport = new BackgroundMCPTransport();
    this.server = new Server({
      name: 'chrome-extension-mcp-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupServer();
    this.setupChromeMessageHandlers();
  }

  private setupServer() {
    // Handle tools/list requests
    this.transport.onRequest('tools/list', async () => {
      const tools = this.getAllTools();
      return { tools };
    });

    // Handle tools/call requests
    this.transport.onRequest('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      const result = await this.callTool(name, args);
      return result;
    });
  }

  private setupChromeMessageHandlers() {
    // Handle direct Chrome extension messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'MCP_LIST_TOOLS') {
        const tools = this.getAllTools();
        sendResponse({ success: true, tools });
        return false;
      }

      if (message.type === 'MCP_CALL_TOOL') {
        this.callTool(message.payload.name, message.payload.args)
          .then(result => {
            sendResponse({ success: true, result });
          })
          .catch(error => {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Tool call failed' 
            });
          });
        return true; // Keep message channel open for async response
      }

      if (message.type === 'GET_BUILTIN_TOOLS_COUNT') {
        const tools = this.getAllTools();
        sendResponse({ success: true, count: tools.length });
        return false;
      }

      if (message.type === 'GET_ALL_TOOLS') {
        const tools = this.getAllTools();
        const toolsWithServer = tools.map(tool => ({
          ...tool,
          serverName: 'builtin'
        }));
        sendResponse({ success: true, tools: toolsWithServer });
        return false;
      }
    });
  }

  private getAllTools(): Tool[] {
    // Convert all browser tools to MCP Tool format
    const tools: Tool[] = [];
    
    // Get all browser tool instances
    const toolInstances = Object.values(browserTools);
    
    for (const toolInstance of toolInstances) {
      if (toolInstance && typeof toolInstance === 'object' && 'name' in toolInstance) {
        const tool: Tool = {
          name: toolInstance.name,
          description: this.getToolDescription(toolInstance.name),
          inputSchema: this.getToolInputSchema(toolInstance.name)
        };
        tools.push(tool);
      }
    }

    return tools;
  }

  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      // Navigation tools
      'browser_navigate': '在浏览器中打开URL、创建新窗口或刷新页面',
      'browser_close_tabs': '关闭指定的浏览器标签页',
      'browser_go_back_or_forward': '在浏览器历史中前进或后退',
      
      // Content tools
      'browser_screenshot': '捕获网页截图，支持可见区域、全页面或特定元素',
      'browser_web_fetcher': '获取网页内容，支持HTML和文本格式',
      'browser_get_interactive_elements': '获取页面中的可交互元素',
      
      // Interaction tools
      'browser_click_element': '点击页面上的指定元素',
      'browser_fill_input': '在表单输入框中填写文本',
      'browser_keyboard': '模拟键盘操作',
      
      // Browser data tools
      'browser_history': '搜索和管理浏览器历史记录',
      'browser_bookmark_search': '搜索浏览器书签',
      'browser_bookmark_add': '添加新的浏览器书签',
      'browser_bookmark_delete': '删除浏览器书签',
      
      // Developer tools
      'browser_console': '获取浏览器控制台日志',
      'browser_network_request': '发起网络请求',
      'browser_network_debugger_start': '开始网络调试',
      'browser_network_debugger_stop': '停止网络调试',
      'browser_network_capture_start': '开始网络请求捕获',
      'browser_network_capture_stop': '停止网络请求捕获',
      'browser_inject_script': '向页面注入JavaScript脚本',
      'browser_send_command_to_inject_script': '向已注入的脚本发送命令',
      
      // Advanced tools
      'browser_vector_search_tabs_content': '使用向量搜索在标签页内容中查找信息',
      'browser_window': '管理浏览器窗口',
    };

    return descriptions[toolName] || `浏览器工具: ${toolName}`;
  }

  private getToolInputSchema(toolName: string): any {
    // Define schemas for each tool
    const schemas: Record<string, any> = {
      'browser_navigate': {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要导航到的URL' },
          newWindow: { type: 'boolean', description: '是否在新窗口中打开' },
          width: { type: 'number', description: '新窗口宽度' },
          height: { type: 'number', description: '新窗口高度' },
          refresh: { type: 'boolean', description: '是否刷新当前页面' }
        }
      },
      'browser_close_tabs': {
        type: 'object',
        properties: {
          tabIds: { type: 'array', items: { type: 'number' }, description: '要关闭的标签页ID数组' },
          url: { type: 'string', description: '要关闭的URL匹配模式' }
        }
      },
      'browser_go_back_or_forward': {
        type: 'object',
        properties: {
          isForward: { type: 'boolean', description: '是否前进（false为后退）' }
        }
      },
      'browser_screenshot': {
        type: 'object',
        properties: {
          name: { type: 'string', description: '截图文件名' },
          selector: { type: 'string', description: 'CSS选择器，用于截取特定元素' },
          width: { type: 'number', description: '截图宽度' },
          height: { type: 'number', description: '截图高度' },
          storeBase64: { type: 'boolean', description: '是否返回base64格式' },
          fullPage: { type: 'boolean', description: '是否截取完整页面' },
          savePng: { type: 'boolean', description: '是否保存为PNG文件' },
          maxHeight: { type: 'number', description: '最大截图高度（像素）' }
        }
      },
      'browser_web_fetcher': {
        type: 'object',
        properties: {
          htmlContent: { type: 'boolean', description: '获取HTML内容' },
          textContent: { type: 'boolean', description: '获取文本内容' },
          url: { type: 'string', description: '要获取内容的URL（可选）' },
          selector: { type: 'string', description: 'CSS选择器，获取特定元素的内容' }
        }
      },
      'browser_click_element': {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS选择器' },
          button: { type: 'string', enum: ['left', 'right', 'middle'], description: '鼠标按钮' },
          clickCount: { type: 'number', description: '点击次数' }
        },
        required: ['selector']
      },
      'browser_fill_input': {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS选择器' },
          text: { type: 'string', description: '要填入的文本' },
          clearFirst: { type: 'boolean', description: '是否先清空输入框' }
        },
        required: ['selector', 'text']
      }
      // Add more schemas as needed...
    };

    return schemas[toolName] || {
      type: 'object',
      properties: {},
      description: '工具参数'
    };
  }

  private async callTool(name: string, args: any): Promise<CallToolResult> {
    try {
      console.log(`[BackgroundMCPServer] 调用工具: ${name}`, args);
      
      // Use existing tool handler
      const result = await handleCallTool({ name, args });
      
      // Convert to MCP CallToolResult format
      const mcpResult: CallToolResult = {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result)
          }
        ],
        isError: result?.isError || false
      };

      return mcpResult;
    } catch (error) {
      console.error(`[BackgroundMCPServer] 工具调用失败: ${name}`, error);
      
      return {
        content: [
          {
            type: 'text',
            text: `工具调用失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ],
        isError: true
      };
    }
  }
}

// Create and export singleton instance
export const backgroundMCPServer = new BackgroundMCPServer();
