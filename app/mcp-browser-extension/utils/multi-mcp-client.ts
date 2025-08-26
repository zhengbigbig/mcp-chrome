// 多 MCP Server 客户端管理器
import { BrowserClientTransport, Tool, CallToolResult } from './mcp-client';
import { ServerRegistry, ServerConfig, ServerTool, BUILTIN_SERVER_CONFIG } from './server-registry';

export interface ToolCallRequest {
  server?: string; // 可选的指定 server
  tool: string;
  args: any;
}

export interface ToolCallResponse {
  result: CallToolResult;
  serverName: string;
  latency: number;
  success: boolean;
  error?: string;
}

// HTTP/WebSocket Client Transport（用于外部 server）
class HTTPClientTransport {
  constructor(private endpoint: string, private auth?: any) {}

  async listTools(): Promise<Tool[]> {
    console.log(`[HTTPClientTransport] 正在从 ${this.endpoint} 获取工具列表`);
    
    const response = await fetch(`${this.endpoint}/tools/list`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ method: 'tools/list' }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HTTPClientTransport] HTTP 错误: ${response.status}, 响应: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const tools = data.tools || data.result?.tools || [];
    console.log(`[HTTPClientTransport] 从 ${this.endpoint} 获取到 ${tools.length} 个工具:`, tools.map(t => t.name));
    return tools;
  }

  async callTool(toolName: string, args: any): Promise<CallToolResult> {
    const response = await fetch(`${this.endpoint}/tools/call`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: toolName,
        arguments: args,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    return data; // 直接返回数据，因为测试服务器直接返回结果
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.auth?.type === 'bearer' && this.auth.token) {
      headers['Authorization'] = `Bearer ${this.auth.token}`;
    } else if (this.auth?.type === 'basic' && this.auth.username && this.auth.password) {
      const credentials = btoa(`${this.auth.username}:${this.auth.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    return headers;
  }
}

// WebSocket Client Transport
class WebSocketClientTransport {
  private ws?: WebSocket;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  constructor(private endpoint: string, private auth?: any) {}

  private async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.endpoint);
      
      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const request = this.pendingRequests.get(data.id);
          if (request) {
            this.pendingRequests.delete(data.id);
            if (data.error) {
              request.reject(new Error(data.error.message || 'WebSocket error'));
            } else {
              request.resolve(data.result);
            }
          }
        } catch (error) {
          console.error('[WebSocket] 消息解析失败:', error);
        }
      };
    });
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    await this.connect();
    
    const id = ++this.requestId;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(message));
      
      // 30秒超时
      setTimeout(() => {
        const request = this.pendingRequests.get(id);
        if (request) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async listTools(): Promise<Tool[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools || [];
  }

  async callTool(toolName: string, args: any): Promise<CallToolResult> {
    return await this.sendRequest('tools/call', { name: toolName, arguments: args });
  }
}

// 多 MCP 客户端管理器
export class MultiMCPClient {
  private registry: ServerRegistry;
  private builtinClient?: BrowserClientTransport;

  constructor() {
    this.registry = new ServerRegistry();
  }

  // 初始化，注册内置 server
  async initialize(): Promise<void> {
    // 注册内置 server
    this.builtinClient = new BrowserClientTransport();
    await this.registry.register(BUILTIN_SERVER_CONFIG, this.builtinClient);
    
    console.log('[MultiMCPClient] 初始化完成');
  }

  // 添加外部 server
  async addServer(config: ServerConfig): Promise<boolean> {
    try {
      let client: any;

      switch (config.type) {
        case 'http':
          if (!config.endpoint) throw new Error('HTTP server 需要 endpoint');
          client = new HTTPClientTransport(config.endpoint, config.auth);
          break;

        case 'websocket':
          if (!config.endpoint) throw new Error('WebSocket server 需要 endpoint');
          client = new WebSocketClientTransport(config.endpoint, config.auth);
          break;

        case 'stdio':
          // 在浏览器环境中，stdio 需要通过 background 代理
          throw new Error('浏览器环境暂不支持 stdio transport');

        default:
          throw new Error(`不支持的 transport 类型: ${config.type}`);
      }

      const success = await this.registry.register(config, client);
      if (success) {
        // 保存到本地存储
        await this.saveServerConfigs();
      }
      return success;
    } catch (error) {
      console.error('[MultiMCPClient] 添加 server 失败:', error);
      return false;
    }
  }

  // 移除 server
  async removeServer(name: string): Promise<boolean> {
    if (name === 'builtin') {
      throw new Error('不能移除内置 server');
    }

    const success = this.registry.unregister(name);
    if (success) {
      await this.saveServerConfigs();
    }
    return success;
  }

  // 获取所有 server
  getAllServers() {
    return this.registry.getAllServers().map(conn => ({
      config: conn.config,
      status: conn.status,
    }));
  }

  // 获取所有工具
  getAllTools(): ServerTool[] {
    return this.registry.getAllTools();
  }

  // 调用工具
  async callTool(request: ToolCallRequest): Promise<ToolCallResponse> {
    try {
      console.log(`[MultiMCPClient] 调用工具: ${request.tool}, 指定服务器: ${request.server || 'auto'}`);
      console.log(`[MultiMCPClient] 可用工具:`, this.getAllTools().map(t => `${t.serverName}.${t.name}`));
      
      const result = await this.registry.callTool(
        request.tool, 
        request.args, 
        request.server
      );

      return {
        result: result.result,
        serverName: result.serverName,
        latency: result.latency,
        success: true,
      };
    } catch (error) {
      return {
        result: {
          content: [
            {
              type: 'text' as const,
              text: `工具调用失败: ${error instanceof Error ? error.message : error}`,
            },
          ],
          isError: true,
        },
        serverName: request.server || 'unknown',
        latency: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // 批量调用工具
  async callTools(requests: ToolCallRequest[]): Promise<ToolCallResponse[]> {
    const promises = requests.map(request => this.callTool(request));
    return await Promise.all(promises);
  }

  // 并行调用工具
  async callToolsParallel(requests: ToolCallRequest[]): Promise<ToolCallResponse[]> {
    return await this.callTools(requests);
  }

  // 串行调用工具
  async callToolsSerial(requests: ToolCallRequest[]): Promise<ToolCallResponse[]> {
    const results: ToolCallResponse[] = [];
    for (const request of requests) {
      const result = await this.callTool(request);
      results.push(result);
    }
    return results;
  }

  // 获取统计信息
  getStats() {
    return this.registry.getStats();
  }

  // 健康检查
  async healthCheck(): Promise<{ [serverName: string]: boolean }> {
    const results: { [serverName: string]: boolean } = {};
    const servers = this.registry.getAllServers();

    for (const server of servers) {
      try {
        await server.ping();
        results[server.config.name] = true;
      } catch (error) {
        results[server.config.name] = false;
      }
    }

    return results;
  }

  // 保存 server 配置到本地存储
  private async saveServerConfigs(): Promise<void> {
    try {
      const configs = this.registry.getAllServers()
        .filter(conn => conn.config.name !== 'builtin') // 不保存内置 server
        .map(conn => conn.config);

      await chrome.storage.local.set({ mcpServerConfigs: configs });
    } catch (error) {
      console.error('[MultiMCPClient] 保存配置失败:', error);
    }
  }

  // 从本地存储恢复 server 配置
  async restoreServerConfigs(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['mcpServerConfigs']);
      const configs: ServerConfig[] = result.mcpServerConfigs || [];

      for (const config of configs) {
        if (config.enabled !== false) {
          await this.addServer(config);
        }
      }

      console.log(`[MultiMCPClient] 已恢复 ${configs.length} 个 server 配置`);
    } catch (error) {
      console.error('[MultiMCPClient] 恢复配置失败:', error);
    }
  }

  // 销毁
  destroy(): void {
    this.registry.destroy();
  }
}

// 导出单例
export const multiMCPClient = new MultiMCPClient();
