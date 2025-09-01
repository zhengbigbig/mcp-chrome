import {
  ToolExecutionPlan,
  ExecutionContext,
  ToolExecutionResult,
} from './intelligent-tool-orchestrator';
import { ChromeMCPClient } from './mcp-client';
import { createMCPClient, ExternalMCPClient } from './external-mcp-client';

export interface TaskExecutionOptions {
  maxRetries?: number;
  timeout?: number;
  parallelExecution?: boolean;
  userConfirmationRequired?: boolean;
}

export interface TaskExecutionStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_confirmation';
  progress: number;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  retryCount: number;
}

export class TaskExecutionEngine {
  private internalMCPClient: ChromeMCPClient;
  private externalMCPClients: Map<string, ExternalMCPClient> = new Map();
  private executionStatuses: Map<string, TaskExecutionStatus> = new Map();
  private runningTasks: Set<string> = new Set();

  constructor() {
    this.internalMCPClient = new ChromeMCPClient();
  }

  /**
   * 注册外部 MCP 客户端
   */
  public registerExternalClient(endpoint: string, client: ExternalMCPClient): void {
    this.externalMCPClients.set(endpoint, client);
  }

  /**
   * 执行任务编排
   */
  public async executeTasks(
    context: ExecutionContext,
    options: TaskExecutionOptions = {},
  ): Promise<Map<string, ToolExecutionResult>> {
    const {
      maxRetries = 3,
      timeout = 30000,
      parallelExecution = true,
      userConfirmationRequired = true,
    } = options;

    const results = new Map<string, ToolExecutionResult>();

    try {
      // 初始化任务状态
      this.initializeTaskStatuses(context.executionPlan);

      // 执行任务
      if (parallelExecution) {
        await this.executeTasksInParallel(context, options);
      } else {
        await this.executeTasksSequentially(context, options);
      }

      // 收集结果
      for (const task of context.executionPlan) {
        const status = this.executionStatuses.get(task.id);
        if (status && status.status === 'completed') {
          results.set(task.toolName, {
            toolName: task.toolName,
            success: true,
            result: status.result,
            executionTime: (status.endTime || 0) - (status.startTime || 0),
          });
        } else if (status && status.status === 'failed') {
          results.set(task.toolName, {
            toolName: task.toolName,
            success: false,
            error: status.error,
            executionTime: (status.endTime || 0) - (status.startTime || 0),
          });
        }
      }
    } catch (error) {
      console.error('Task execution failed:', error);
    }

    return results;
  }

  /**
   * 初始化任务状态
   */
  private initializeTaskStatuses(executionPlan: ToolExecutionPlan[]): void {
    this.executionStatuses.clear();

    for (const task of executionPlan) {
      this.executionStatuses.set(task.id, {
        taskId: task.id,
        status: 'pending',
        progress: 0,
        retryCount: 0,
      });
    }
  }

  /**
   * 并行执行任务
   */
  private async executeTasksInParallel(
    context: ExecutionContext,
    options: TaskExecutionOptions,
  ): Promise<void> {
    const executableTasks = this.getExecutableTasks(context.executionPlan);

    if (executableTasks.length === 0) return;

    // 并行执行可执行的任务
    const executionPromises = executableTasks.map((task) =>
      this.executeSingleTask(task, context, options),
    );

    await Promise.allSettled(executionPromises);

    // 检查是否有新任务可以执行
    const remainingTasks = context.executionPlan.filter(
      (task) => this.executionStatuses.get(task.id)?.status === 'pending',
    );

    if (remainingTasks.length > 0) {
      // 递归执行剩余任务
      await this.executeTasksInParallel(context, options);
    }
  }

  /**
   * 顺序执行任务
   */
  private async executeTasksSequentially(
    context: ExecutionContext,
    options: TaskExecutionOptions,
  ): Promise<void> {
    for (const task of context.executionPlan) {
      await this.executeSingleTask(task, context, options);

      // 检查任务是否成功
      const status = this.executionStatuses.get(task.id);
      if (status?.status === 'failed') {
        break; // 任务失败，停止执行
      }
    }
  }

  /**
   * 执行单个任务
   */
  private async executeSingleTask(
    task: ToolExecutionPlan,
    context: ExecutionContext,
    options: TaskExecutionOptions,
  ): Promise<void> {
    const status = this.executionStatuses.get(task.id);
    if (!status || status.status !== 'pending') return;

    // 检查依赖是否完成
    if (!this.checkDependencies(task, context)) {
      return;
    }

    // 检查是否需要用户确认
    if (task.requiresUserConfirmation && options.userConfirmationRequired) {
      status.status = 'waiting_confirmation';
      return;
    }

    // 开始执行任务
    status.status = 'running';
    status.startTime = Date.now();
    this.runningTasks.add(task.id);

    try {
      // 执行工具调用
      const result = await this.executeToolCall(task, context);

      // 更新状态
      status.status = 'completed';
      status.result = result;
      status.progress = 100;
      status.endTime = Date.now();
    } catch (error) {
      // 处理执行失败
      await this.handleTaskFailure(task, error, options);
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * 检查任务依赖是否完成
   */
  private checkDependencies(task: ToolExecutionPlan, context: ExecutionContext): boolean {
    if (task.dependencies.length === 0) return true;

    for (const depToolName of task.dependencies) {
      const depTask = context.executionPlan.find((t) => t.toolName === depToolName);
      if (!depTask) continue;

      const depStatus = this.executionStatuses.get(depTask.id);
      if (!depStatus || depStatus.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取可执行的任务
   */
  private getExecutableTasks(executionPlan: ToolExecutionPlan[]): ToolExecutionPlan[] {
    return executionPlan.filter((task) => {
      const status = this.executionStatuses.get(task.id);
      if (!status || status.status !== 'pending') return false;

      // 检查依赖
      return this.checkDependencies(task, { executionPlan } as ExecutionContext);
    });
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(task: ToolExecutionPlan, context: ExecutionContext): Promise<any> {
    const { toolName, parameters } = task;

    try {
      // 判断工具类型并调用相应的客户端
      if (toolName.startsWith('@browser/')) {
        // 内部浏览器工具
        return await this.executeInternalTool(toolName, parameters);
      } else {
        // 外部 MCP 工具
        return await this.executeExternalTool(toolName, parameters);
      }
    } catch (error) {
      console.error(`Tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * 执行内部浏览器工具
   */
  private async executeInternalTool(toolName: string, parameters: any): Promise<any> {
    // 从工具名称中提取实际的方法名
    const methodName = toolName.split('/').pop();

    if (!methodName) {
      throw new Error(`Invalid tool name: ${toolName}`);
    }

    // 调用内部 MCP 客户端
    return await this.internalMCPClient.callTool(methodName, parameters);
  }

  /**
   * 执行外部 MCP 工具
   */
  private async executeExternalTool(toolName: string, parameters: any): Promise<any> {
    // 这里需要根据工具名称找到对应的外部 MCP 客户端
    // 暂时返回错误，需要实现外部客户端的路由逻辑
    throw new Error(`External tool execution not implemented: ${toolName}`);
  }

  /**
   * 处理任务失败
   */
  private async handleTaskFailure(
    task: ToolExecutionPlan,
    error: any,
    options: TaskExecutionOptions,
  ): Promise<void> {
    const status = this.executionStatuses.get(task.id);
    if (!status) return;

    status.retryCount++;

    if (status.retryCount < (options.maxRetries || 3)) {
      // 重试任务
      status.status = 'pending';
      status.progress = 0;
      status.error = undefined;

      // 延迟重试
      setTimeout(() => {
        this.executeSingleTask(task, {} as ExecutionContext, options);
      }, 1000 * status.retryCount); // 递增延迟
    } else {
      // 重试次数用完，标记为失败
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : String(error);
      status.endTime = Date.now();
    }
  }

  /**
   * 获取任务执行状态
   */
  public getTaskStatus(taskId: string): TaskExecutionStatus | undefined {
    return this.executionStatuses.get(taskId);
  }

  /**
   * 获取所有任务状态
   */
  public getAllTaskStatuses(): Map<string, TaskExecutionStatus> {
    return new Map(this.executionStatuses);
  }

  /**
   * 确认用户操作
   */
  public confirmUserAction(taskId: string): void {
    const status = this.executionStatuses.get(taskId);
    if (status && status.status === 'waiting_confirmation') {
      status.status = 'pending';
    }
  }

  /**
   * 取消任务
   */
  public cancelTask(taskId: string): void {
    const status = this.executionStatuses.get(taskId);
    if (status) {
      status.status = 'failed';
      status.error = 'Task cancelled by user';
      status.endTime = Date.now();
    }

    this.runningTasks.delete(taskId);
  }

  /**
   * 获取执行进度
   */
  public getExecutionProgress(context: ExecutionContext): {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    running: number;
    waitingConfirmation: number;
  } {
    let completed = 0;
    let failed = 0;
    let pending = 0;
    let running = 0;
    let waitingConfirmation = 0;

    for (const task of context.executionPlan) {
      const status = this.executionStatuses.get(task.id);
      if (!status) {
        pending++;
        continue;
      }

      switch (status.status) {
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'pending':
          pending++;
          break;
        case 'running':
          running++;
          break;
        case 'waiting_confirmation':
          waitingConfirmation++;
          break;
      }
    }

    return {
      total: context.executionPlan.length,
      completed,
      failed,
      pending,
      running,
      waitingConfirmation,
    };
  }

  /**
   * 清理执行状态
   */
  public cleanup(): void {
    this.executionStatuses.clear();
    this.runningTasks.clear();
  }
}
