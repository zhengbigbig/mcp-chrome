import {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPToolCall {
  name: string;
  arguments: any;
}

export interface MCPToolResult {
  content: any;
  isError?: boolean;
}

/**
 * Chrome扩展专用的MCP客户端服务
 * 通过Chrome扩展的消息传递机制与MCP服务器通信
 */
export class MCPClientService {
  private isInitialized = false;
  private availableTools: MCPTool[] = [];
  private requestId = 1;

  constructor() {
    this.setupMessageListener();
  }

  /**
   * 初始化MCP客户端服务
   */
  async initialize(): Promise<boolean> {
    try {
      // 检查MCP服务器状态
      const serverStatus = await this.getServerStatus();
      if (!serverStatus.connected || !serverStatus.serverStatus.isRunning) {
        console.log('MCP服务器未运行，尝试连接...');
        await this.connectToServer();
      }

      // 发送初始化请求
      await this.sendInitializeRequest();

      // 获取可用工具列表
      await this.loadAvailableToolsFromServer();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('MCP客户端初始化失败:', error);
      return false;
    }
  }

  /**
   * 发送MCP初始化请求
   */
  private async sendInitializeRequest(): Promise<void> {
    const initRequest: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'chrome-mcp-client',
          version: '1.0.0',
        },
      },
    };

    await this.sendMCPRequest(initRequest);
  }

  /**
   * 设置消息监听器
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // 处理来自background script的消息
      if (message.type === BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED) {
        console.log('MCP服务器状态变更:', message.payload);
      }
    });
  }

  /**
   * 获取服务器状态
   */
  private async getServerStatus(): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS }, resolve);
    });
  }

  /**
   * 连接到MCP服务器
   */
  private async connectToServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CONNECT_NATIVE', port: 8080 }, (response) => {
        if (response?.success) {
          resolve();
        } else {
          reject(new Error('无法连接到MCP服务器'));
        }
      });
    });
  }

  /**
   * 从MCP服务器加载可用工具列表
   */
  private async loadAvailableToolsFromServer(): Promise<void> {
    try {
      const listToolsRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'tools/list',
        params: {},
      };

      const response = await this.sendMCPRequest(listToolsRequest);
      if (
        response &&
        response.result &&
        response.result.tools &&
        Array.isArray(response.result.tools)
      ) {
        this.availableTools = response.result.tools.map((tool: Tool) => ({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
        }));
        console.log('从MCP服务器加载了工具:', this.availableTools);
      } else {
        // 如果无法从服务器获取工具，使用默认工具列表
        await this.loadDefaultTools();
      }
    } catch (error) {
      console.error('从MCP服务器加载工具失败:', error);
      // 使用默认工具列表作为后备
      await this.loadDefaultTools();
    }
  }

  /**
   * 加载默认工具列表（后备方案）
   */
  private async loadDefaultTools(): Promise<void> {
    this.availableTools = [
      {
        name: 'browser_screenshot',
        description: '截取当前浏览器标签页的屏幕截图',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: { type: 'boolean', description: '是否截取完整页面' },
          },
        },
      },
      {
        name: 'browser_get_tabs',
        description: '获取所有打开的浏览器标签页信息',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_navigate',
        description: '导航到指定URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '要导航到的URL' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_get_page_content',
        description: '获取当前页面的文本内容',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS选择器（可选）' },
          },
        },
      },
      {
        name: 'browser_click_element',
        description: '点击页面上的元素',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS选择器' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_type_text',
        description: '在指定元素中输入文本',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS选择器' },
            text: { type: 'string', description: '要输入的文本' },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'browser_get_console_logs',
        description: '获取浏览器控制台日志',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_get_network_logs',
        description: '获取网络请求日志',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }

  /**
   * 调用MCP工具
   */
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.isInitialized) {
      throw new Error('MCP客户端未初始化');
    }

    try {
      // 构造MCP工具调用请求
      const callToolRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments || {},
        },
      };

      const response = await this.sendMCPRequest(callToolRequest);

      if (response && 'result' in response && response.result) {
        return {
          content: response.result.content || response.result,
          isError: false,
        };
      } else if (response && 'error' in response && response.error) {
        return {
          content: response.error.message || '工具调用失败',
          isError: true,
        };
      } else {
        throw new Error('无效的MCP响应');
      }
    } catch (error) {
      return {
        content: error instanceof Error ? error.message : '工具调用失败',
        isError: true,
      };
    }
  }

  /**
   * 发送MCP请求到background script
   */
  private async sendMCPRequest(request: JSONRPCRequest): Promise<JSONRPCResponse | null> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'MCP_REQUEST',
          payload: request,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'MCP请求失败'));
          }
        },
      );
    });
  }

  /**
   * 生成下一个请求ID
   */
  private getNextRequestId(): number {
    return this.requestId++;
  }

  /**
   * 发送工具调用请求到background script
   */
  private async sendToolCall(toolCall: MCPToolCall): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'CALL_TOOL',
          payload: {
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || '工具调用失败'));
          }
        },
      );
    });
  }

  /**
   * 处理用户请求，智能选择合适的工具
   */
  async processRequest(userMessage: string): Promise<string> {
    try {
      // 分析用户消息，确定需要使用的工具
      const toolCalls = await this.analyzeUserMessage(userMessage);

      if (toolCalls.length === 0) {
        return '抱歉，我无法理解您的请求或找到合适的工具来处理。';
      }

      const results: string[] = [];

      // 执行工具调用
      for (const toolCall of toolCalls) {
        try {
          const result = await this.callTool(toolCall);
          if (result.isError) {
            results.push(`执行${toolCall.name}时出错: ${result.content}`);
          } else {
            results.push(this.formatToolResult(toolCall.name, result.content));
          }
        } catch (error) {
          results.push(
            `执行${toolCall.name}时出错: ${error instanceof Error ? error.message : '未知错误'}`,
          );
        }
      }

      return results.join('\n\n');
    } catch (error) {
      console.error('处理用户请求失败:', error);
      return `处理请求时出错: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 分析用户消息，确定需要使用的工具
   */
  private async analyzeUserMessage(message: string): Promise<MCPToolCall[]> {
    const toolCalls: MCPToolCall[] = [];
    const lowerMessage = message.toLowerCase();

    // 截图相关
    if (
      lowerMessage.includes('截图') ||
      lowerMessage.includes('屏幕截图') ||
      lowerMessage.includes('screenshot')
    ) {
      toolCalls.push({
        name: 'browser_screenshot',
        arguments: { fullPage: lowerMessage.includes('完整') || lowerMessage.includes('全页') },
      });
    }

    // 标签页相关
    if (
      lowerMessage.includes('标签页') ||
      lowerMessage.includes('tab') ||
      lowerMessage.includes('打开的页面')
    ) {
      toolCalls.push({
        name: 'browser_get_tabs',
        arguments: {},
      });
    }

    // 导航相关
    const urlMatch = message.match(/(?:打开|访问|导航到|跳转到)\s*(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      toolCalls.push({
        name: 'browser_navigate',
        arguments: { url: urlMatch[1] },
      });
    }

    // 页面内容相关
    if (
      lowerMessage.includes('页面内容') ||
      lowerMessage.includes('网页内容') ||
      lowerMessage.includes('文本内容')
    ) {
      toolCalls.push({
        name: 'browser_get_page_content',
        arguments: {},
      });
    }

    // 控制台日志相关
    if (
      lowerMessage.includes('控制台') ||
      lowerMessage.includes('console') ||
      lowerMessage.includes('日志')
    ) {
      toolCalls.push({
        name: 'browser_get_console_logs',
        arguments: {},
      });
    }

    // 网络请求相关
    if (
      lowerMessage.includes('网络') ||
      lowerMessage.includes('请求') ||
      lowerMessage.includes('network')
    ) {
      toolCalls.push({
        name: 'browser_get_network_logs',
        arguments: {},
      });
    }

    return toolCalls;
  }

  /**
   * 格式化工具执行结果
   */
  private formatToolResult(toolName: string, result: any): string {
    switch (toolName) {
      case 'browser_screenshot':
        return '✅ 截图已完成';

      case 'browser_get_tabs':
        if (Array.isArray(result)) {
          const tabList = result
            .map((tab: any, index: number) => `${index + 1}. ${tab.title} (${tab.url})`)
            .join('\n');
          return `📋 当前打开的标签页 (${result.length}个):\n${tabList}`;
        }
        return '📋 获取标签页信息失败';

      case 'browser_navigate':
        return `✅ 已导航到: ${result?.url || '指定页面'}`;

      case 'browser_get_page_content':
        return `📄 页面内容:\n${result?.content || result || '无内容'}`;

      case 'browser_get_console_logs':
        if (Array.isArray(result) && result.length > 0) {
          const logs = result
            .slice(-10)
            .map((log: any) => `[${log.level}] ${log.text}`)
            .join('\n');
          return `🔍 控制台日志 (最近10条):\n${logs}`;
        }
        return '🔍 控制台日志为空';

      case 'browser_get_network_logs':
        if (Array.isArray(result) && result.length > 0) {
          const requests = result
            .slice(-5)
            .map((req: any) => `${req.method} ${req.url} - ${req.status}`)
            .join('\n');
          return `🌐 网络请求 (最近5个):\n${requests}`;
        }
        return '🌐 无网络请求记录';

      default:
        return `✅ ${toolName} 执行完成: ${JSON.stringify(result)}`;
    }
  }
}
