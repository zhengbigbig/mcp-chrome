// MCP Server 注册表和多服务器管理
import { Tool } from './mcp-client';
import { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';

export type ServerTransportType = 'builtin' | 'http' | 'websocket' | 'stdio';

export interface ServerConfig {
  name: string;
  displayName: string;
  type: ServerTransportType;
  endpoint?: string; // HTTP/WebSocket endpoint
  command?: string; // stdio command
  args?: string[]; // stdio arguments
  auth?: {
    type: 'none' | 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
  retryCount?: number;
  priority?: number; // 1-10, 10 最高
  enabled?: boolean;
  metadata?: Record<string, any>;
}

export interface ServerStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastSeen?: number;
  latency?: number; // ms
  errorCount?: number;
  successCount?: number;
  tools?: ServerTool[];
  error?: string;
}

export interface ServerTool extends Tool {
  serverName: string;
  serverDisplayName: string;
  serverPriority: number;
  lastUsed?: number;
  successRate?: number;
}

export interface ServerHealth {
  name: string;
  healthy: boolean;
  latency: number;
  errorRate: number;
  lastCheck: number;
}

// Server 连接管理器
export class ServerConnection {
  constructor(
    public config: ServerConfig,
    public client: any, // BrowserClientTransport 或其他
    public status: ServerStatus
  ) {}

  async ping(): Promise<number> {
    const start = Date.now();
    try {
      // 尝试列出工具作为健康检查
      await this.client.listTools();
      const latency = Date.now() - start;
      this.status.latency = latency;
      this.status.lastSeen = Date.now();
      this.status.status = 'connected';
      return latency;
    } catch (error) {
      this.status.status = 'error';
      this.status.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async loadTools(): Promise<ServerTool[]> {
    try {
      const tools = await this.client.listTools();
      const serverTools: ServerTool[] = tools.map((tool: MCPTool) => ({
        ...tool,
        serverName: this.config.name,
        serverDisplayName: this.config.displayName,
        serverPriority: this.config.priority || 5,
        successRate: 1.0, // 初始成功率
      }));
      
      this.status.tools = serverTools;
      return serverTools;
    } catch (error) {
      console.error(`[ServerRegistry] 加载 ${this.config.name} 工具失败:`, error);
      this.status.tools = [];
      return [];
    }
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.client.callTool(toolName, args);
      
      // 更新统计
      this.status.successCount = (this.status.successCount || 0) + 1;
      this.status.latency = Date.now() - start;
      
      // 更新工具成功率
      if (this.status.tools) {
        const tool = this.status.tools.find(t => t.name === toolName);
        if (tool) {
          tool.lastUsed = Date.now();
          tool.successRate = Math.min(1.0, (tool.successRate || 0.5) + 0.1);
        }
      }
      
      return result;
    } catch (error) {
      this.status.errorCount = (this.status.errorCount || 0) + 1;
      
      // 更新工具失败率
      if (this.status.tools) {
        const tool = this.status.tools.find(t => t.name === toolName);
        if (tool) {
          tool.successRate = Math.max(0.0, (tool.successRate || 0.5) - 0.2);
        }
      }
      
      throw error;
    }
  }
}

// MCP Server 注册表
export class ServerRegistry {
  private servers = new Map<string, ServerConnection>();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.startHealthCheck();
  }

  // 注册 server
  async register(config: ServerConfig, client: any): Promise<boolean> {
    try {
      const status: ServerStatus = {
        name: config.name,
        status: 'connecting',
        errorCount: 0,
        successCount: 0,
      };

      const connection = new ServerConnection(config, client, status);
      
      // 测试连接
      await connection.ping();
      await connection.loadTools();
      
      this.servers.set(config.name, connection);
      
      console.log(`[ServerRegistry] 已注册 server: ${config.name}`);
      return true;
    } catch (error) {
      console.error(`[ServerRegistry] 注册 server ${config.name} 失败:`, error);
      return false;
    }
  }

  // 移除 server
  unregister(name: string): boolean {
    const removed = this.servers.delete(name);
    if (removed) {
      console.log(`[ServerRegistry] 已移除 server: ${name}`);
    }
    return removed;
  }

  // 获取所有 server
  getAllServers(): ServerConnection[] {
    return Array.from(this.servers.values());
  }

  // 获取指定 server
  getServer(name: string): ServerConnection | undefined {
    return this.servers.get(name);
  }

  // 获取所有工具（跨 server）
  getAllTools(): ServerTool[] {
    const allTools: ServerTool[] = [];
    
    for (const connection of this.servers.values()) {
      if (connection.status.status === 'connected' && connection.status.tools) {
        allTools.push(...connection.status.tools);
      }
    }
    
    // 按优先级和成功率排序
    return allTools.sort((a, b) => {
      const priorityDiff = b.serverPriority - a.serverPriority;
      if (priorityDiff !== 0) return priorityDiff;
      
      const successRateDiff = (b.successRate || 0) - (a.successRate || 0);
      if (successRateDiff !== 0) return successRateDiff;
      
      return a.name.localeCompare(b.name);
    });
  }

  // 获取可用的 server（健康状态）
  getHealthyServers(): ServerConnection[] {
    return this.getAllServers().filter(conn => 
      conn.status.status === 'connected' && conn.config.enabled !== false
    );
  }

  // 根据工具名查找最佳 server
  findBestServerForTool(toolName: string): ServerConnection | undefined {
    const candidates = this.getHealthyServers().filter(conn => 
      conn.status.tools?.some(tool => tool.name === toolName)
    );

    if (candidates.length === 0) return undefined;

    // 选择优先级最高、延迟最低的 server
    return candidates.sort((a, b) => {
      const priorityDiff = (b.config.priority || 5) - (a.config.priority || 5);
      if (priorityDiff !== 0) return priorityDiff;
      
      const latencyA = a.status.latency || 9999;
      const latencyB = b.status.latency || 9999;
      return latencyA - latencyB;
    })[0];
  }

  // 调用工具（自动选择最佳 server）
  async callTool(toolName: string, args: any, preferredServer?: string): Promise<{
    result: any;
    serverName: string;
    latency: number;
  }> {
    console.log(`[ServerRegistry] 调用工具: ${toolName}, 优选服务器: ${preferredServer || 'auto'}`);
    console.log(`[ServerRegistry] 当前所有工具:`, this.getAllTools().map(t => `${t.serverName}.${t.name}`));
    console.log(`[ServerRegistry] 健康服务器数量:`, this.getHealthyServers().length);
    
    let connection: ServerConnection | undefined;

    // 优先使用指定的 server
    if (preferredServer) {
      connection = this.getServer(preferredServer);
      console.log(`[ServerRegistry] 指定服务器 ${preferredServer} 查找结果:`, connection ? '找到' : '未找到');
      if (!connection || connection.status.status !== 'connected') {
        console.warn(`[ServerRegistry] 指定的 server ${preferredServer} 不可用，尝试其他 server`);
        connection = undefined;
      }
    }

    // 自动选择最佳 server
    if (!connection) {
      connection = this.findBestServerForTool(toolName);
      console.log(`[ServerRegistry] 自动选择服务器结果:`, connection ? connection.config.name : '未找到');
    }

    if (!connection) {
      console.error(`[ServerRegistry] 没有可用的 server 支持工具: ${toolName}`);
      console.error(`[ServerRegistry] 可用工具列表:`, this.getAllTools());
      throw new Error(`没有可用的 server 支持工具: ${toolName}`);
    }

    const start = Date.now();
    try {
      const result = await connection.callTool(toolName, args);
      const latency = Date.now() - start;
      
      return {
        result,
        serverName: connection.config.name,
        latency,
      };
    } catch (error) {
      // 尝试其他 server 作为备选
      const alternatives = this.getHealthyServers().filter(conn => 
        conn.config.name !== connection!.config.name &&
        conn.status.tools?.some(tool => tool.name === toolName)
      );

      if (alternatives.length > 0) {
        console.log(`[ServerRegistry] ${connection.config.name} 失败，尝试备选 server: ${alternatives[0].config.name}`);
        const result = await alternatives[0].callTool(toolName, args);
        return {
          result,
          serverName: alternatives[0].config.name,
          latency: Date.now() - start,
        };
      }

      throw error;
    }
  }

  // 健康检查
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      for (const connection of this.servers.values()) {
        try {
          await connection.ping();
        } catch (error) {
          console.warn(`[ServerRegistry] ${connection.config.name} 健康检查失败:`, error);
        }
      }
    }, 30000); // 30秒检查一次
  }

  // 获取统计信息
  getStats(): {
    totalServers: number;
    healthyServers: number;
    totalTools: number;
    avgLatency: number;
  } {
    const all = this.getAllServers();
    const healthy = this.getHealthyServers();
    const tools = this.getAllTools();
    
    const latencies = healthy
      .map(s => s.status.latency)
      .filter(l => l !== undefined) as number[];
    
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;

    return {
      totalServers: all.length,
      healthyServers: healthy.length,
      totalTools: tools.length,
      avgLatency: Math.round(avgLatency),
    };
  }

  // 销毁
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.servers.clear();
  }
}

// 默认的内置 server 配置
export const BUILTIN_SERVER_CONFIG: ServerConfig = {
  name: 'builtin',
  displayName: '内置服务器',
  type: 'builtin',
  priority: 5,
  enabled: true,
  timeout: 5000,
  retryCount: 2,
  auth: { type: 'none' },
  metadata: {
    description: '浏览器插件内置的 MCP 服务器',
    version: '1.0.0',
  },
};
