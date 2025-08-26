// 浏览器环境下的 MCP Client 实现
// 使用 @modelcontextprotocol/sdk 的 Client 类

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  CallToolResult,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';

// 浏览器消息传递 Transport 实现
class BrowserClientTransport {
  private client: Client;

  constructor() {
    this.client = new Client(
      {
        name: 'mcp-browser-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  // 发送消息到 background script
  private async sendMessage(type: string, data: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        
        resolve(response);
      });
    });
  }

  // 获取可用工具列表
  async listTools(): Promise<Tool[]> {
    try {
      const response = await this.sendMessage('MCP_LIST_TOOLS');
      return response.tools || [];
    } catch (error) {
      console.error('[MCP Client] 获取工具列表失败:', error);
      throw error;
    }
  }

  // 调用工具
  async callTool(name: string, args: any = {}): Promise<CallToolResult> {
    try {
      const response = await this.sendMessage('MCP_CALL_TOOL', { name, args });
      return response;
    } catch (error) {
      console.error('[MCP Client] 工具调用失败:', error);
      throw error;
    }
  }

  // 使用 MCP SDK 的标准请求方法
  async request(method: string, params: any = {}): Promise<any> {
    switch (method) {
      case 'tools/list':
        return { tools: await this.listTools() };
      case 'tools/call':
        return await this.callTool(params.name, params.arguments);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  // 兼容旧的接口
  async getAvailableTools(): Promise<Tool[]> {
    return await this.listTools();
  }

  // 简化的工具调用接口
  async callToolSimple(name: string, args: any = {}): Promise<string> {
    try {
      const result = await this.callTool(name, args);
      
      if (result.content && result.content.length > 0) {
        const firstContent = result.content[0];
        if (firstContent.type === 'text') {
          return firstContent.text || '工具执行完成，但没有返回内容';
        }
      }
      
      return '工具执行完成';
    } catch (error) {
      throw new Error(`调用工具失败: ${error instanceof Error ? error.message : error}`);
    }
  }
}

export { BrowserClientTransport };
export type { Tool, CallToolResult };
