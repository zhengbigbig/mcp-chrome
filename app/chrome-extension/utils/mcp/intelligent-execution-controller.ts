import { IntelligentToolOrchestrator } from './intelligent-tool-orchestrator';
import { TaskExecutionEngine } from './task-execution-engine';
import { ChromeMCPClient } from './mcp-client';
import { createMCPClient, ExternalMCPClient } from './external-mcp-client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS } from 'chrome-mcp-shared';

export interface ExecutionRequest {
  sessionId: string;
  userInput: string;
  options?: {
    maxRetries?: number;
    timeout?: number;
    parallelExecution?: boolean;
    userConfirmationRequired?: boolean;
  };
}

export interface ExecutionResponse {
  sessionId: string;
  containsBrowserTools: boolean;
  detectedTools: string[];
  confidence: number;
  executionPlan?: any;
  taskListPrompt?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  results?: Map<string, any>;
  progress?: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    running: number;
    waitingConfirmation: number;
  };
}

export class IntelligentExecutionController {
  private orchestrator: IntelligentToolOrchestrator;
  private executionEngine: TaskExecutionEngine;
  private internalMCPClient: ChromeMCPClient;
  private externalMCPClients: Map<string, ExternalMCPClient> = new Map();
  private activeSessions: Map<string, ExecutionResponse> = new Map();

  constructor() {
    // 初始化内部 MCP 客户端
    this.internalMCPClient = new ChromeMCPClient();

    // 初始化工具编排器
    this.orchestrator = new IntelligentToolOrchestrator(TOOL_SCHEMAS);

    // 初始化任务执行引擎
    this.executionEngine = new TaskExecutionEngine();
  }

  /**
   * 注册外部 MCP 服务器
   */
  public async registerExternalMCPServer(
    endpoint: string,
    serverType: 'http' | 'websocket' | 'stdio',
  ): Promise<void> {
    try {
      const client = createMCPClient(serverType, endpoint);

      // 测试连接
      const isConnected = await client.testConnection();
      if (!isConnected) {
        throw new Error(`Failed to connect to external MCP server: ${endpoint}`);
      }

      // 注册客户端
      this.externalMCPClients.set(endpoint, client);
      this.executionEngine.registerExternalClient(endpoint, client);

      console.log(`External MCP server registered: ${endpoint}`);
    } catch (error) {
      console.error(`Failed to register external MCP server: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * 处理用户输入并执行智能编排
   */
  public async processUserInput(request: ExecutionRequest): Promise<ExecutionResponse> {
    const { sessionId, userInput, options = {} } = request;

    try {
      // 1. 分析用户输入
      const analysis = this.orchestrator.analyzeUserInput(userInput);

      // 创建响应对象
      const response: ExecutionResponse = {
        sessionId,
        containsBrowserTools: analysis.containsBrowserTools,
        detectedTools: analysis.detectedTools,
        confidence: analysis.confidence,
        status: 'pending',
      };

      // 2. 如果不包含浏览器工具，直接返回
      if (!analysis.containsBrowserTools) {
        response.status = 'completed';
        this.activeSessions.set(sessionId, response);
        return response;
      }

      // 3. 生成执行计划
      const executionContext = await this.orchestrator.executeOrchestration(sessionId, userInput);

      // 4. 生成任务清单提示词
      const taskListPrompt = this.orchestrator.generateTaskListPrompt(
        userInput,
        analysis.detectedTools,
      );

      response.executionPlan = executionContext.executionPlan;
      response.taskListPrompt = taskListPrompt;
      response.status = 'executing';

      // 5. 执行任务编排
      const results = await this.executionEngine.executeTasks(executionContext, options);
      response.results = results;

      // 6. 获取执行进度
      response.progress = this.executionEngine.getExecutionProgress(executionContext);

      // 7. 更新状态
      if (response.progress.failed > 0) {
        response.status = 'failed';
      } else if (response.progress.completed === response.progress.total) {
        response.status = 'completed';
      }

      // 保存会话状态
      this.activeSessions.set(sessionId, response);

      return response;
    } catch (error) {
      console.error('Process user input failed:', error);

      const errorResponse: ExecutionResponse = {
        sessionId,
        containsBrowserTools: false,
        detectedTools: [],
        confidence: 0,
        status: 'failed',
      };

      this.activeSessions.set(sessionId, errorResponse);
      return errorResponse;
    }
  }

  /**
   * 获取执行状态
   */
  public getExecutionStatus(sessionId: string): ExecutionResponse | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 获取所有活跃会话
   */
  public getAllActiveSessions(): Map<string, ExecutionResponse> {
    return new Map(this.activeSessions);
  }

  /**
   * 确认用户操作
   */
  public confirmUserAction(sessionId: string, taskId: string): void {
    this.executionEngine.confirmUserAction(taskId);

    // 更新会话状态
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'executing';
      this.activeSessions.set(sessionId, session);
    }
  }

  /**
   * 取消任务
   */
  public cancelTask(sessionId: string, taskId: string): void {
    this.executionEngine.cancelTask(taskId);

    // 更新会话状态
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.progress = this.executionEngine.getExecutionProgress({
        executionPlan: session.executionPlan || [],
      } as any);

      if (session.progress?.failed && session.progress.failed > 0) {
        session.status = 'failed';
      }

      this.activeSessions.set(sessionId, session);
    }
  }

  /**
   * 继续执行会话
   */
  public async continueExecution(sessionId: string): Promise<ExecutionResponse | undefined> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'pending') {
      return session;
    }

    try {
      // 重新执行任务编排
      const executionContext = this.orchestrator.getExecutionContext(sessionId);
      if (!executionContext) {
        throw new Error('Execution context not found');
      }

      // 执行任务
      const results = await this.executionEngine.executeTasks(executionContext);
      session.results = results;

      // 更新进度
      session.progress = this.executionEngine.getExecutionProgress(executionContext);

      // 更新状态
      if (session.progress?.failed && session.progress.failed > 0) {
        session.status = 'failed';
      } else if (session.progress?.completed === session.progress?.total) {
        session.status = 'completed';
      } else {
        session.status = 'executing';
      }

      this.activeSessions.set(sessionId, session);
      return session;
    } catch (error) {
      console.error('Continue execution failed:', error);
      session.status = 'failed';
      this.activeSessions.set(sessionId, session);
      return session;
    }
  }

  /**
   * 清理会话
   */
  public cleanupSession(sessionId: string): void {
    // 清理编排器状态
    this.orchestrator.cleanupExecutionContext(sessionId);

    // 清理执行引擎状态
    this.executionEngine.cleanup();

    // 清理会话状态
    this.activeSessions.delete(sessionId);
  }

  /**
   * 获取可用工具列表
   */
  public getAvailableTools(): Tool[] {
    return TOOL_SCHEMAS;
  }

  /**
   * 获取外部 MCP 服务器列表
   */
  public getExternalMCPServers(): string[] {
    return Array.from(this.externalMCPClients.keys());
  }

  /**
   * 测试外部 MCP 服务器连接
   */
  public async testExternalMCPServer(endpoint: string): Promise<boolean> {
    const client = this.externalMCPClients.get(endpoint);
    if (!client) return false;

    try {
      return await client.testConnection();
    } catch (error) {
      console.error(`Test external MCP server failed: ${endpoint}`, error);
      return false;
    }
  }

  /**
   * 获取工具执行统计
   */
  public getToolExecutionStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    failedSessions: number;
  } {
    let activeSessions = 0;
    let completedSessions = 0;
    let failedSessions = 0;

    for (const session of this.activeSessions.values()) {
      switch (session.status) {
        case 'executing':
        case 'pending':
          activeSessions++;
          break;
        case 'completed':
          completedSessions++;
          break;
        case 'failed':
          failedSessions++;
          break;
      }
    }

    return {
      totalSessions: this.activeSessions.size,
      activeSessions,
      completedSessions,
      failedSessions,
    };
  }
}
