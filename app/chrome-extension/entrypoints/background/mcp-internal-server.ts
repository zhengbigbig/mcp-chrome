import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  JSONRPCRequest,
  JSONRPCResponse,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS } from 'chrome-mcp-shared';
import { handleCallTool } from './tools';

/**
 * Runtime Transport for Chrome Extension internal MCP communication
 * 基于 chrome.runtime 消息通道的 MCP 传输适配器
 */
export class RuntimeTransport {
  private messageHandlers = new Map<string, (request: any) => Promise<any>>();
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

  constructor() {
    this.setupMessageListener();
  }

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'MCP_INTERNAL_REQUEST') {
        this.handleInternalRequest(message.payload)
          .then(response => {
            sendResponse({ success: true, data: response });
          })
          .catch(error => {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          });
        return true; // Keep message channel open for async response
      }

      if (message.type === 'MCP_INTERNAL_RESPONSE' && message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.requestId);
          if (message.success) {
            pending.resolve(message.data);
          } else {
            pending.reject(new Error(message.error));
          }
        }
        return false;
      }
    });
  }

  private async handleInternalRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const handler = this.messageHandlers.get(request.method);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`
        }
      };
    }

    try {
      const result = await handler(request);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
    }
  }

  /**
   * 发送请求到指定target (用于client端)
   */
  async sendRequest(method: string, params?: any, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `req_${++this.requestId}`;
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      chrome.runtime.sendMessage({
        type: 'MCP_INTERNAL_REQUEST',
        payload: request
      }).catch(error => {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  /**
   * 注册消息处理器 (用于server端)
   */
  onRequest(method: string, handler: (request: any) => Promise<any>) {
    this.messageHandlers.set(method, handler);
  }

  /**
   * 关闭传输层
   */
  close() {
    // 清理所有pending请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport closed'));
    }
    this.pendingRequests.clear();
    this.messageHandlers.clear();
  }
}

/**
 * Internal MCP Server 
 * 插件内部的 MCP Server，供插件内 MCP Client 调用
 */
export class InternalMCPServer {
  private server: Server;
  private transport: RuntimeTransport;
  private isConnected = false;

  constructor() {
    this.transport = new RuntimeTransport();
    this.server = new Server(
      {
        name: 'chrome-extension-internal-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupServer();
  }

  private setupServer() {
    // 设置工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log('[InternalMCPServer] 处理 tools/list 请求');
      return { tools: TOOL_SCHEMAS };
    });

    // 设置工具调用处理器  
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log(`[InternalMCPServer] 处理工具调用: ${name}`, args);
      
      try {
        const result = await this.callTool(name, args || {});
        return result;
      } catch (error) {
        console.error(`[InternalMCPServer] 工具调用失败: ${name}`, error);
        throw error;
      }
    });

    // 设置传输层处理器
    this.transport.onRequest('initialize', async (request) => {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: 'chrome-extension-internal-mcp-server',
          version: '1.0.0',
        },
      };
    });

    this.transport.onRequest('tools/list', async () => {
      const response = await this.server.request(
        { method: 'tools/list', params: {} },
        ListToolsRequestSchema,
      );
      return response;
    });

    this.transport.onRequest('tools/call', async (request) => {
      const response = await this.server.request(
        { method: 'tools/call', params: request.params },
        CallToolRequestSchema,
      );
      return response;
    });
  }

  private async callTool(name: string, args: any): Promise<CallToolResult> {
    try {
      // 使用现有的工具处理器
      const result = await handleCallTool({ name, args });
      
      // 转换为 MCP CallToolResult 格式
      let content: any[];
      
      if (typeof result === 'string') {
        content = [{ type: 'text', text: result }];
      } else if (result && typeof result === 'object') {
        // 检查是否已经是正确的格式
        if (result.content && Array.isArray(result.content)) {
          return result as CallToolResult;
        }
        
        // 处理包含base64图片的情况
        if (result.base64Image) {
          content = [
            { type: 'text', text: result.message || `工具 ${name} 执行成功` },
            { 
              type: 'image', 
              data: result.base64Image,
              mimeType: 'image/png'
            }
          ];
        } else {
          content = [{ 
            type: 'text', 
            text: JSON.stringify(result, null, 2) 
          }];
        }
      } else {
        content = [{ type: 'text', text: String(result) }];
      }

      return {
        content,
        isError: result?.isError || false,
      };
    } catch (error) {
      console.error(`[InternalMCPServer] 工具执行错误: ${name}`, error);
      
      return {
        content: [
          {
            type: 'text',
            text: `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 启动服务器（连接传输层）
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      console.log('[InternalMCPServer] 服务器已启动');
      return;
    }

    try {
      // MCP SDK 的 Server 不需要显式连接传输层
      // 我们的 RuntimeTransport 已经设置好了消息处理
      this.isConnected = true;
      console.log('[InternalMCPServer] Internal MCP Server 启动成功');
    } catch (error) {
      console.error('[InternalMCPServer] 启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      this.transport.close();
      this.isConnected = false;
      console.log('[InternalMCPServer] Internal MCP Server 已停止');
    } catch (error) {
      console.error('[InternalMCPServer] 停止失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务器状态
   */
  isRunning(): boolean {
    return this.isConnected;
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): Tool[] {
    return TOOL_SCHEMAS;
  }

  /**
   * 获取传输层实例（用于客户端连接）
   */
  getTransport(): RuntimeTransport {
    return this.transport;
  }
}

// 创建全局单例实例
export const internalMCPServer = new InternalMCPServer();

// 自动启动服务器
internalMCPServer.start().catch(error => {
  console.error('[InternalMCPServer] 自动启动失败:', error);
});
