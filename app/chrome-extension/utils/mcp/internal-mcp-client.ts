import { 
  Tool, 
  CallToolResult,
  JSONRPCRequest,
  JSONRPCResponse 
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Internal MCP Client
 * 专用于连接插件内部的 Internal MCP Server
 */
export class InternalMCPClient {
  private requestId = 0;
  private isInitialized = false;

  constructor() {
    // 客户端实例化时自动初始化
    this.initialize().catch(error => {
      console.error('[InternalMCPClient] 初始化失败:', error);
    });
  }

  /**
   * 初始化客户端连接
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const response = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: false,
          },
          sampling: {},
        },
        clientInfo: {
          name: 'chrome-extension-internal-mcp-client',
          version: '1.0.0',
        },
      });

      console.log('[InternalMCPClient] 初始化成功:', response);
      this.isInitialized = true;
    } catch (error) {
      console.error('[InternalMCPClient] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用工具列表
   */
  async listTools(): Promise<Tool[]> {
    try {
      const response = await this.sendRequest('tools/list', {});
      return response.tools || [];
    } catch (error) {
      console.error('[InternalMCPClient] 获取工具列表失败:', error);
      throw error;
    }
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args?: any): Promise<CallToolResult> {
    try {
      const response = await this.sendRequest('tools/call', {
        name,
        arguments: args || {},
      });
      return response;
    } catch (error) {
      console.error(`[InternalMCPClient] 工具调用失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 发送请求到 Internal MCP Server
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    const id = `client_${++this.requestId}`;
    
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // 通过 chrome.runtime.sendMessage 发送到 background script
      chrome.runtime.sendMessage({
        type: 'MCP_INTERNAL_REQUEST',
        payload: request,
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error('No response received'));
          return;
        }

        if (!response.success) {
          reject(new Error(response.error || 'Request failed'));
          return;
        }

        // 检查 JSON-RPC 响应格式
        const jsonResponse = response.data as JSONRPCResponse;
        if (jsonResponse.error) {
          reject(new Error(jsonResponse.error.message || 'JSON-RPC error'));
          return;
        }

        resolve(jsonResponse.result);
      });
    });
  }

  /**
   * 检查客户端是否已初始化
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.isInitialized = false;
    console.log('[InternalMCPClient] 已断开连接');
  }
}

// 创建全局单例实例
export const internalMCPClient = new InternalMCPClient();
