// 增强的推理引擎 - 集成智能提示词系统和用户确认机制

import { PromptSystem, TaskAnalysis, ToolCall } from './PromptSystem';
import { SimpleMCPHelper, SimpleTool, ToolCallResult } from '../utils/SimpleMCPHelper';
import { UserInteraction, InteractionResult } from '../../../utils/mcp/user-interaction';
import {
  IntelligentExecutionService,
  IntelligentExecutionResult,
} from './IntelligentExecutionService';

export interface ReasoningStepType {
  type:
    | 'thinking'
    | 'tool_selection'
    | 'tool_execution'
    | 'user_interaction'
    | 'synthesis'
    | 'intelligent_analysis';
  content: string;
  data?: any;
}

export interface ReasoningResult {
  steps: ReasoningStepType[];
  response: string;
  toolCalls: ToolCall[];
  success: boolean;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  intelligentExecution?: IntelligentExecutionResult;
}

export interface ExecutionContext {
  userInput: string;
  analysis: TaskAnalysis;
  executionPlan: ToolCall[];
  results: ToolCallResult[];
  currentStep: number;
}

export class EnhancedReasoningEngine {
  private promptSystem: PromptSystem;
  private intelligentExecutionService: IntelligentExecutionService;
  private ollamaEndpoint: string = 'http://localhost:11434';
  private defaultModel: string = 'deepseek-r1:1.5b';
  private interactionHandler?: (interaction: UserInteraction) => Promise<InteractionResult>;
  private isExecuting: boolean = false;
  private currentContext?: ExecutionContext;

  constructor() {
    this.promptSystem = new PromptSystem();
    this.intelligentExecutionService = new IntelligentExecutionService();
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('extensionSettings');
      if (result.extensionSettings) {
        this.ollamaEndpoint = result.extensionSettings.ollamaEndpoint || 'http://localhost:11434';
        this.defaultModel = result.extensionSettings.defaultModel || 'deepseek-r1:1.5b';
      }
    } catch (error) {
      console.error('[EnhancedReasoningEngine] 加载设置失败:', error);
    }
  }

  /**
   * 设置用户交互处理器
   */
  setInteractionHandler(handler: (interaction: UserInteraction) => Promise<InteractionResult>) {
    this.interactionHandler = handler;
    this.intelligentExecutionService.setInteractionHandler(handler);
  }

  /**
   * 主推理方法 - 分析用户输入并执行任务
   */
  async reason(userInput: string): Promise<ReasoningResult> {
    console.log(`[EnhancedReasoningEngine] 开始推理: ${userInput}`);

    const steps: ReasoningStepType[] = [];

    try {
      this.isExecuting = true;

      // Step 1: 智能分析用户输入，检测是否包含浏览器工具
      steps.push({
        type: 'intelligent_analysis',
        content: '🤖 正在使用智能工具编排系统分析您的需求...',
      });

      const sessionId = `session_${Date.now()}`;
      const intelligentResult = await this.intelligentExecutionService.executeUserRequest(
        userInput,
        sessionId,
      );

      steps.push({
        type: 'intelligent_analysis',
        content: `✅ 智能分析完成！
        
**检测结果**: ${intelligentResult.containsBrowserTools ? '包含浏览器工具' : '不包含浏览器工具'}
**检测到的工具**: ${intelligentResult.detectedTools.join(', ') || '无'}
**置信度**: ${(intelligentResult.confidence * 100).toFixed(1)}%
**状态**: ${intelligentResult.status}`,
        data: intelligentResult,
      });

      // Step 2: 如果不包含浏览器工具，使用传统方式处理
      if (!intelligentResult.containsBrowserTools) {
        steps.push({
          type: 'thinking',
          content: '📝 未检测到浏览器工具，使用传统推理方式处理...',
        });

        return await this.processWithTraditionalReasoning(userInput, steps);
      }

      // Step 3: 如果包含浏览器工具，使用智能编排系统
      if (intelligentResult.taskListPrompt) {
        steps.push({
          type: 'tool_selection',
          content: `🔧 检测到浏览器工具，已生成智能执行计划！
          
**任务清单提示词**:
${intelligentResult.taskListPrompt}

**执行计划**: ${intelligentResult.executionPlan?.length || 0} 个任务
**下一步**: 等待用户确认执行计划`,
          data: intelligentResult,
        });

        return {
          steps,
          response: '已生成智能执行计划，请查看并确认',
          toolCalls: [],
          success: true,
          requiresConfirmation: true,
          confirmationMessage: '请确认是否执行以下任务计划？',
          intelligentExecution: intelligentResult,
        };
      }

      // Step 4: 如果智能编排失败，回退到传统方式
      steps.push({
        type: 'thinking',
        content: '⚠️ 智能编排系统未生成执行计划，回退到传统推理方式...',
      });

      return await this.processWithTraditionalReasoning(userInput, steps);
    } catch (error) {
      console.error('[EnhancedReasoningEngine] 推理失败:', error);

      steps.push({
        type: 'synthesis',
        content: `❌ 推理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });

      return {
        steps,
        response: '抱歉，处理您的请求时出现了错误。请尝试重新描述您的需求。',
        toolCalls: [],
        success: false,
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 使用传统推理方式处理
   */
  private async processWithTraditionalReasoning(
    userInput: string,
    steps: ReasoningStepType[],
  ): Promise<ReasoningResult> {
    try {
      // 获取可用工具
      const tools = await SimpleMCPHelper.getAvailableTools();
      this.promptSystem.setAvailableTools(tools);

      // 智能分析用户输入
      steps.push({
        type: 'thinking',
        content: '🤔 正在分析您的需求，理解任务意图...',
      });

      const analysis = await this.promptSystem.analyzeUserInput(
        userInput,
        this.ollamaEndpoint,
        this.defaultModel,
      );

      steps.push({
        type: 'tool_selection',
        content: `✅ 任务分析完成！
        
**意图**: ${analysis.intent}
**复杂度**: ${analysis.complexity}
**风险等级**: ${analysis.riskLevel}
**工具数量**: ${analysis.toolCalls.length}个

${analysis.reasoning}`,
        data: analysis,
      });

      // 检查是否需要用户确认
      if (analysis.confirmationRequired) {
        const confirmationMessage = this.promptSystem.generateConfirmationMessage(analysis);

        steps.push({
          type: 'user_interaction',
          content: '⏳ 等待用户确认操作...',
        });

        return {
          steps,
          response: '任务已分析完成，需要您的确认',
          toolCalls: analysis.toolCalls,
          success: false,
          requiresConfirmation: true,
          confirmationMessage,
        };
      }

      // 直接执行（低风险任务）
      return await this.executeTaskPlan(analysis, steps);
    } catch (error) {
      console.error('[EnhancedReasoningEngine] 传统推理失败:', error);

      steps.push({
        type: 'synthesis',
        content: `❌ 传统推理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });

      return {
        steps,
        response: '抱歉，传统推理方式也失败了。请尝试重新描述您的需求。',
        toolCalls: [],
        success: false,
      };
    }
  }

  /**
   * 执行已确认的任务计划
   */
  async executeConfirmedTask(analysis: TaskAnalysis): Promise<ReasoningResult> {
    console.log('[EnhancedReasoningEngine] 执行已确认的任务');

    const steps: ReasoningStepType[] = [
      {
        type: 'user_interaction',
        content: '✅ 用户已确认，开始执行任务...',
      },
    ];

    try {
      this.isExecuting = true;
      return await this.executeTaskPlan(analysis, steps);
    } catch (error) {
      console.error('[EnhancedReasoningEngine] 执行确认任务失败:', error);

      steps.push({
        type: 'synthesis',
        content: `❌ 执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });

      return {
        steps,
        response: '任务执行过程中出现错误，请检查具体步骤。',
        toolCalls: analysis.toolCalls,
        success: false,
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 执行智能编排任务
   */
  async executeIntelligentTask(sessionId: string): Promise<ReasoningResult> {
    console.log('[EnhancedReasoningEngine] 执行智能编排任务');

    const steps: ReasoningStepType[] = [
      {
        type: 'user_interaction',
        content: '🚀 用户已确认智能执行计划，开始执行...',
      },
    ];

    try {
      this.isExecuting = true;

      // 确认执行任务
      const result = await this.intelligentExecutionService.confirmTaskExecution(sessionId);

      if (result.success) {
        steps.push({
          type: 'tool_execution',
          content: `✅ 智能任务执行完成！
          
**状态**: ${result.status}
**消息**: ${result.message}
**下一步**: ${result.nextAction}`,
          data: result,
        });

        return {
          steps,
          response: result.message || '智能任务执行完成',
          toolCalls: [],
          success: true,
          intelligentExecution: result,
        };
      } else {
        steps.push({
          type: 'synthesis',
          content: `❌ 智能任务执行失败: ${result.message}`,
        });

        return {
          steps,
          response: `智能任务执行失败: ${result.message}`,
          toolCalls: [],
          success: false,
          intelligentExecution: result,
        };
      }
    } catch (error) {
      console.error('[EnhancedReasoningEngine] 执行智能任务失败:', error);

      steps.push({
        type: 'synthesis',
        content: `❌ 执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });

      return {
        steps,
        response: '智能任务执行过程中出现错误，请检查具体步骤。',
        toolCalls: [],
        success: false,
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 执行任务计划
   */
  private async executeTaskPlan(
    analysis: TaskAnalysis,
    steps: ReasoningStepType[],
  ): Promise<ReasoningResult> {
    const { toolCalls } = analysis;
    const results: ToolCallResult[] = [];

    // 创建执行上下文
    this.currentContext = {
      userInput: analysis.intent,
      analysis,
      executionPlan: toolCalls,
      results,
      currentStep: 0,
    };

    // Step: 开始执行工具
    steps.push({
      type: 'tool_execution',
      content: `🔧 开始执行 ${toolCalls.length} 个工具...`,
    });

    // 逐个执行工具
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];

      try {
        steps.push({
          type: 'tool_execution',
          content: `🔄 执行工具 ${i + 1}/${toolCalls.length}: ${toolCall.tool}`,
        });

        const result = await SimpleMCPHelper.callTool(toolCall.tool, toolCall.args);
        results.push(result);

        steps.push({
          type: 'tool_execution',
          content: `✅ 工具执行成功: ${toolCall.tool}`,
        });
      } catch (error) {
        console.error(`[EnhancedReasoningEngine] 工具执行失败: ${toolCall.tool}`, error);

        steps.push({
          type: 'tool_execution',
          content: `❌ 工具执行失败: ${toolCall.tool} - ${error instanceof Error ? error.message : '未知错误'}`,
        });

        return {
          steps,
          response: `工具执行失败: ${toolCall.tool}`,
          toolCalls: toolCalls.slice(0, i + 1),
          success: false,
        };
      }
    }

    // 所有工具执行完成
    steps.push({
      type: 'synthesis',
      content: `🎉 所有工具执行完成！共执行 ${toolCalls.length} 个工具`,
    });

    return {
      steps,
      response: '任务执行完成！',
      toolCalls,
      success: true,
    };
  }

  /**
   * 获取智能执行状态
   */
  getIntelligentExecutionStatus(sessionId: string): IntelligentExecutionResult | undefined {
    return this.intelligentExecutionService.getExecutionStatus(sessionId);
  }

  /**
   * 获取任务清单提示词
   */
  getTaskListPrompt(sessionId: string): string | undefined {
    return this.intelligentExecutionService.getTaskListPrompt(sessionId);
  }

  /**
   * 获取执行计划
   */
  getExecutionPlan(sessionId: string): any[] | undefined {
    return this.intelligentExecutionService.getExecutionPlan(sessionId);
  }

  /**
   * 生成执行报告
   */
  generateExecutionReport(sessionId: string): string {
    return this.intelligentExecutionService.generateExecutionReport(sessionId);
  }

  /**
   * 清理会话
   */
  cleanupSession(sessionId: string): void {
    this.intelligentExecutionService.cleanupSession(sessionId);
  }
}
