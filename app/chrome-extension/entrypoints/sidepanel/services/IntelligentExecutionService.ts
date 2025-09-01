// 智能执行服务 - 集成智能工具编排和任务式决策调用链路

import {
  IntelligentExecutionController,
  ExecutionRequest,
  ExecutionResponse,
} from '../../../utils/mcp/intelligent-execution-controller';
import { TaskAnalysis, ToolCall } from './PromptSystem';
import { SimpleMCPHelper, ToolCallResult } from '../utils/SimpleMCPHelper';
import { UserInteraction, InteractionResult } from '../../../utils/mcp/user-interaction';

export interface IntelligentExecutionResult {
  success: boolean;
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
  nextAction?: 'continue' | 'wait_confirmation' | 'complete' | 'error';
  message?: string;
}

export interface TaskExecutionStep {
  stepId: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_confirmation';
  parameters: any;
  result?: any;
  error?: string;
  requiresConfirmation: boolean;
  dependencies: string[];
  canExecuteInParallel: boolean;
}

export class IntelligentExecutionService {
  private executionController: IntelligentExecutionController;
  private interactionHandler?: (interaction: UserInteraction) => Promise<InteractionResult>;
  private activeSessions: Map<string, IntelligentExecutionResult> = new Map();
  private taskSteps: Map<string, TaskExecutionStep[]> = new Map();

  constructor() {
    this.executionController = new IntelligentExecutionController();
    this.initializeService();
  }

  /**
   * 初始化服务
   */
  private async initializeService() {
    try {
      // 获取可用工具
      const tools = await SimpleMCPHelper.getAvailableTools();
      console.log('[IntelligentExecutionService] 可用工具数量:', tools.length);

      // 注册外部 MCP 服务器（如果有配置的话）
      // 这里可以从配置中读取外部服务器信息
    } catch (error) {
      console.error('[IntelligentExecutionService] 初始化失败:', error);
    }
  }

  /**
   * 设置用户交互处理器
   */
  setInteractionHandler(handler: (interaction: UserInteraction) => Promise<InteractionResult>) {
    this.interactionHandler = handler;
  }

  /**
   * 主执行方法 - 智能分析用户输入并执行任务
   */
  async executeUserRequest(
    userInput: string,
    sessionId: string,
  ): Promise<IntelligentExecutionResult> {
    console.log(`[IntelligentExecutionService] 开始执行用户请求: ${userInput}`);

    try {
      // 1. 使用智能执行控制器处理用户输入
      const request: ExecutionRequest = {
        sessionId,
        userInput,
        options: {
          maxRetries: 3,
          timeout: 30000,
          parallelExecution: true,
          userConfirmationRequired: true,
        },
      };

      const response = await this.executionController.processUserInput(request);

      // 2. 创建执行结果
      const result: IntelligentExecutionResult = {
        success: response.status !== 'failed',
        containsBrowserTools: response.containsBrowserTools,
        detectedTools: response.detectedTools,
        confidence: response.confidence,
        executionPlan: response.executionPlan,
        taskListPrompt: response.taskListPrompt,
        status: response.status,
        results: response.results,
        progress: response.progress,
      };

      // 3. 如果不包含浏览器工具，直接返回
      if (!response.containsBrowserTools) {
        result.nextAction = 'complete';
        result.message = '未检测到浏览器工具，请直接使用大模型处理';
        this.activeSessions.set(sessionId, result);
        return result;
      }

      // 4. 如果包含浏览器工具，生成任务清单提示词
      if (response.taskListPrompt) {
        result.nextAction = 'wait_confirmation';
        result.message = '检测到浏览器工具，已生成任务清单，请查看并确认执行计划';

        // 解析执行计划，创建任务步骤
        if (response.executionPlan) {
          const taskSteps = this.createTaskSteps(response.executionPlan);
          this.taskSteps.set(sessionId, taskSteps);
        }
      }

      // 5. 保存会话状态
      this.activeSessions.set(sessionId, result);

      return result;
    } catch (error) {
      console.error('[IntelligentExecutionService] 执行失败:', error);

      const errorResult: IntelligentExecutionResult = {
        success: false,
        containsBrowserTools: false,
        detectedTools: [],
        confidence: 0,
        status: 'failed',
        nextAction: 'error',
        message: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };

      this.activeSessions.set(sessionId, errorResult);
      return errorResult;
    }
  }

  /**
   * 创建任务步骤
   */
  private createTaskSteps(executionPlan: any[]): TaskExecutionStep[] {
    return executionPlan.map((task, index) => ({
      stepId: task.id,
      toolName: task.toolName,
      status: 'pending',
      parameters: task.parameters,
      requiresConfirmation: task.requiresUserConfirmation,
      dependencies: task.dependencies,
      canExecuteInParallel: task.canExecuteInParallel,
    }));
  }

  /**
   * 获取任务清单提示词
   */
  getTaskListPrompt(sessionId: string): string | undefined {
    const session = this.activeSessions.get(sessionId);
    return session?.taskListPrompt;
  }

  /**
   * 获取执行计划
   */
  getExecutionPlan(sessionId: string): any[] | undefined {
    const session = this.activeSessions.get(sessionId);
    return session?.executionPlan;
  }

  /**
   * 获取任务步骤
   */
  getTaskSteps(sessionId: string): TaskExecutionStep[] | undefined {
    return this.taskSteps.get(sessionId);
  }

  /**
   * 确认执行任务
   */
  async confirmTaskExecution(sessionId: string): Promise<IntelligentExecutionResult> {
    console.log(`[IntelligentExecutionService] 确认执行任务: ${sessionId}`);

    try {
      // 继续执行会话
      const response = await this.executionController.continueExecution(sessionId);

      if (response) {
        // 更新会话状态
        const session = this.activeSessions.get(sessionId);
        if (session) {
          session.status = response.status;
          session.results = response.results;
          session.progress = response.progress;

          if (response.status === 'completed') {
            session.nextAction = 'complete';
            session.message = '任务执行完成';
          } else if (response.status === 'failed') {
            session.nextAction = 'error';
            session.message = '任务执行失败';
          } else {
            session.nextAction = 'continue';
            session.message = '任务执行中...';
          }

          this.activeSessions.set(sessionId, session);
        }

        return session || this.createDefaultResult();
      }

      return this.createDefaultResult();
    } catch (error) {
      console.error('[IntelligentExecutionService] 确认执行失败:', error);

      const errorResult = this.createDefaultResult();
      errorResult.success = false;
      errorResult.nextAction = 'error';
      errorResult.message = `确认执行失败: ${error instanceof Error ? error.message : '未知错误'}`;

      return errorResult;
    }
  }

  /**
   * 取消任务执行
   */
  cancelTaskExecution(sessionId: string, taskId: string): void {
    console.log(`[IntelligentExecutionService] 取消任务: ${sessionId} - ${taskId}`);

    this.executionController.cancelTask(sessionId, taskId);

    // 更新会话状态
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.nextAction = 'error';
      session.message = '任务已被用户取消';
      this.activeSessions.set(sessionId, session);
    }
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(sessionId: string): IntelligentExecutionResult | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 获取所有活跃会话
   */
  getAllActiveSessions(): Map<string, IntelligentExecutionResult> {
    return new Map(this.activeSessions);
  }

  /**
   * 清理会话
   */
  cleanupSession(sessionId: string): void {
    this.executionController.cleanupSession(sessionId);
    this.activeSessions.delete(sessionId);
    this.taskSteps.delete(sessionId);
  }

  /**
   * 获取可用工具列表
   */
  async getAvailableTools(): Promise<any[]> {
    return await SimpleMCPHelper.getAvailableTools();
  }

  /**
   * 创建默认结果
   */
  private createDefaultResult(): IntelligentExecutionResult {
    return {
      success: false,
      containsBrowserTools: false,
      detectedTools: [],
      confidence: 0,
      status: 'pending',
      nextAction: 'error',
      message: '未知状态',
    };
  }

  /**
   * 生成任务执行报告
   */
  generateExecutionReport(sessionId: string): string {
    const session = this.activeSessions.get(sessionId);
    const steps = this.taskSteps.get(sessionId);

    if (!session || !steps) {
      return '无法生成执行报告：会话不存在';
    }

    let report = `# 任务执行报告\n\n`;
    report += `**会话ID**: ${sessionId}\n`;
    report += `**状态**: ${session.status}\n`;
    report += `**检测到的工具**: ${session.detectedTools.join(', ')}\n`;
    report += `**置信度**: ${(session.confidence * 100).toFixed(1)}%\n\n`;

    if (session.progress) {
      report += `## 执行进度\n`;
      report += `- 总计: ${session.progress.total}\n`;
      report += `- 已完成: ${session.progress.completed}\n`;
      report += `- 执行中: ${session.progress.running}\n`;
      report += `- 等待中: ${session.progress.pending}\n`;
      report += `- 等待确认: ${session.progress.waitingConfirmation}\n`;
      report += `- 失败: ${session.progress.failed}\n\n`;
    }

    if (steps) {
      report += `## 任务步骤\n`;
      steps.forEach((step, index) => {
        report += `### 步骤 ${index + 1}: ${step.toolName}\n`;
        report += `- 状态: ${step.status}\n`;
        report += `- 需要确认: ${step.requiresConfirmation ? '是' : '否'}\n`;
        report += `- 可并行: ${step.canExecuteInParallel ? '是' : '否'}\n`;
        if (step.dependencies.length > 0) {
          report += `- 依赖: ${step.dependencies.join(', ')}\n`;
        }
        if (step.result) {
          report += `- 结果: ${JSON.stringify(step.result, null, 2)}\n`;
        }
        if (step.error) {
          report += `- 错误: ${step.error}\n`;
        }
        report += '\n';
      });
    }

    return report;
  }
}
