import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface ExternalMCPClient {
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: any): Promise<any>;
  testConnection(): Promise<boolean>;
}

/**
 * HTTP 传输的 MCP 客户端
 */
export class HTTPMCPClient implements ExternalMCPClient {
  private endpoint: string;
  private timeout: number;

  constructor(endpoint: string, timeout: number = 30000) {
    this.endpoint = endpoint;
    this.timeout = timeout;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });
      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async listTools(): Promise<Tool[]> {
    try {
      // 首先尝试标准的 MCP 端点
      const response = await fetch(`${this.endpoint}/tools`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.ok) {
        const tools = await response.json();
        return Array.isArray(tools) ? tools : [];
      }

      // 如果标准端点失败，尝试 MCP 协议
      return await this.listToolsViaMCP();
    } catch (error) {
      console.error('Failed to list tools:', error);
      // 回退到 MCP 协议
      return await this.listToolsViaMCP();
    }
  }

  async callTool(name: string, args: any): Promise<any> {
    try {
      // 首先尝试标准的 MCP 端点
      const response = await fetch(`${this.endpoint}/tools/call`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          params: {
            name,
            arguments: args,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.ok) {
        return await response.json();
      }

      // 如果标准端点失败，尝试 MCP 协议
      return await this.callToolViaMCP(name, args);
    } catch (error) {
      console.error('Failed to call tool:', error);
      // 回退到 MCP 协议
      return await this.callToolViaMCP(name, args);
    }
  }

  private async listToolsViaMCP(): Promise<Tool[]> {
    try {
      const response = await fetch(`${this.endpoint}`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.result?.tools) {
          return result.result.tools;
        }
      }
    } catch (error) {
      console.error('MCP protocol failed:', error);
    }

    return [];
  }

  private async callToolViaMCP(name: string, args: any): Promise<any> {
    try {
      const response = await fetch(`${this.endpoint}`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name,
            arguments: args,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.result) {
          return result.result;
        }
        if (result.error) {
          throw new Error(result.error.message || 'Tool call failed');
        }
      }
    } catch (error) {
      console.error('MCP protocol failed:', error);
      throw error;
    }

    throw new Error('Tool call failed');
  }
}

/**
 * WebSocket 传输的 MCP 客户端
 */
export class WebSocketMCPClient implements ExternalMCPClient {
  private endpoint: string;
  private timeout: number;
  private ws: WebSocket | null = null;
  private messageQueue: Map<string, { resolve: Function; reject: Function }> = new Map();
  private messageId = 0;

  constructor(endpoint: string, timeout: number = 30000) {
    this.endpoint = endpoint;
    this.timeout = timeout;
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.endpoint);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.id && this.messageQueue.has(message.id)) {
              const { resolve, reject } = this.messageQueue.get(message.id)!;
              this.messageQueue.delete(message.id);
              
              if (message.error) {
                reject(new Error(message.error.message || 'Request failed'));
              } else {
                resolve(message.result);
              }
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.ws = null;
        };

        // 设置连接超时
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch (error) {
      return false;
    } finally {
      this.ws?.close();
    }
  }

  async listTools(): Promise<Tool[]> {
    try {
      await this.connect();
      
      return new Promise((resolve, reject) => {
        const id = `req_${++this.messageId}`;
        
        const timeout = setTimeout(() => {
          this.messageQueue.delete(id);
          reject(new Error('Request timeout'));
        }, this.timeout);

        this.messageQueue.set(id, {
          resolve: (result: any) => {
            clearTimeout(timeout);
            resolve(result?.tools || []);
          },
          reject: (error: any) => {
            clearTimeout(timeout);
            reject(error);
          },
        });

        this.ws!.send(JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/list',
          params: {},
        }));
      });
    } finally {
      this.ws?.close();
    }
  }

  async callTool(name: string, args: any): Promise<any> {
    try {
      await this.connect();
      
      return new Promise((resolve, reject) => {
        const id = `req_${++this.messageId}`;
        
        const timeout = setTimeout(() => {
          this.messageQueue.delete(id);
          reject(new Error('Request timeout'));
        }, this.timeout);

        this.messageQueue.set(id, {
          resolve: (result: any) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error: any) => {
            clearTimeout(timeout);
            reject(error);
          },
        });

        this.ws!.send(JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: {
            name,
            arguments: args,
          },
        }));
      });
    } finally {
      this.ws?.close();
    }
  }
}

/**
 * 工厂函数：根据服务器类型创建相应的 MCP 客户端
 */
export function createMCPClient(
  serverType: 'http' | 'websocket' | 'stdio',
  endpoint: string,
  options?: { timeout?: number }
): ExternalMCPClient {
  const timeout = options?.timeout || 30000;

  switch (serverType) {
    case 'http':
      return new HTTPMCPClient(endpoint, timeout);
    case 'websocket':
      return new WebSocketMCPClient(endpoint, timeout);
    case 'stdio':
      // STDIO 传输在浏览器环境中不支持，返回 HTTP 客户端作为回退
      console.warn('STDIO transport not supported in browser, falling back to HTTP');
      return new HTTPMCPClient(endpoint, timeout);
    default:
      throw new Error(`Unsupported server type: ${serverType}`);
  }
}
