// 智能推理引擎 - 实现类似Cursor的推理调用过程
// 工具执行和大模型推理穿插进行，支持中间确认和动态决策

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SimpleMCPHelper, ToolCallResult } from '../utils/SimpleMCPHelper';
import { UserInteraction, InteractionResult } from '../../../utils/mcp/user-interaction';

export interface ReasoningStep {
  id: string;
  type: 'thinking' | 'tool_execution' | 'user_confirmation' | 'synthesis';
  content: string;
  toolName?: string;
  parameters?: any;
  result?: any;
  requiresConfirmation?: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_confirmation';
  timestamp: Date;
}

export interface ExecutionContext {
  sessionId: string;
  userInput: string;
  detectedTools: string[];
  currentStep: number;
  steps: ReasoningStep[];
  results: Map<string, any>;
  status: 'running' | 'paused' | 'completed' | 'failed';
  contextData: Map<string, any>; // 存储中间结果供后续步骤使用
}

export interface ReasoningResult {
  success: boolean;
  content: string;
  steps: ReasoningStep[];
  nextAction: 'continue' | 'wait_confirmation' | 'complete' | 'error';
  contextData?: Map<string, any>;
}

export class IntelligentReasoningEngine {
  private availableTools: Tool[] = [];
  private executionContexts: Map<string, ExecutionContext> = new Map();
  private interactionHandler?: (interaction: UserInteraction) => Promise<InteractionResult>;
  private ollamaEndpoint: string = 'http://localhost:11434';
  private defaultModel: string = 'qwen2.5:1.5b';

  constructor() {
    this.initializeEngine();
  }

  /**
   * 初始化引擎
   */
  private async initializeEngine() {
    try {
      this.availableTools = await SimpleMCPHelper.getAvailableTools();
      console.log('[IntelligentReasoningEngine] 可用工具数量:', this.availableTools.length);
    } catch (error) {
      console.error('[IntelligentReasoningEngine] 初始化失败:', error);
    }
  }

  /**
   * 设置用户交互处理器
   */
  setInteractionHandler(handler: (interaction: UserInteraction) => Promise<InteractionResult>) {
    this.interactionHandler = handler;
  }

  /**
   * 主推理方法 - 开始智能推理过程
   */
  async startReasoning(userInput: string, sessionId: string): Promise<ReasoningResult> {
    console.log(`[IntelligentReasoningEngine] 开始推理: ${userInput}`);

    try {
      // 1. 检测浏览器工具
      const detectedTools = this.detectBrowserTools(userInput);

      // 2. 创建执行上下文
      const context: ExecutionContext = {
        sessionId,
        userInput,
        detectedTools,
        currentStep: 0,
        steps: [],
        results: new Map(),
        status: 'running',
        contextData: new Map(),
      };

      this.executionContexts.set(sessionId, context);

      // 3. 开始第一步推理
      return await this.executeNextStep(context);
    } catch (error) {
      console.error('[IntelligentReasoningEngine] 推理失败:', error);
      return {
        success: false,
        content: `推理失败: ${error instanceof Error ? error.message : '未知错误'}`,
        steps: [],
        nextAction: 'error',
      };
    }
  }

  /**
   * 检测浏览器工具
   */
  private detectBrowserTools(userInput: string): string[] {
    const browserToolPattern = /@browser\/[a-zA-Z0-9_/]+/g;
    return userInput.match(browserToolPattern) || [];
  }

  /**
   * 执行下一步推理
   */
  private async executeNextStep(context: ExecutionContext): Promise<ReasoningResult> {
    const { detectedTools, currentStep, steps } = context;

    // 如果所有工具都已执行完成，进行最终总结
    if (currentStep >= detectedTools.length) {
      return await this.generateFinalSummary(context);
    }

    const currentTool = detectedTools[currentStep];

    // 1. 添加思考步骤
    const thinkingStep = this.createStep(
      'thinking',
      `正在分析第 ${currentStep + 1} 步: ${currentTool}`,
    );
    context.steps.push(thinkingStep);

    // 2. 生成工具执行参数
    const parameters = await this.generateToolParameters(context, currentTool);

    // 3. 检查是否需要用户确认
    if (this.requiresUserConfirmation(currentTool)) {
      const confirmationStep = this.createStep(
        'user_confirmation',
        `需要用户确认执行: ${currentTool}`,
        currentTool,
        parameters,
      );
      confirmationStep.requiresConfirmation = true;
      confirmationStep.status = 'waiting_confirmation';
      context.steps.push(confirmationStep);

      return {
        success: true,
        content: `请确认是否执行: ${currentTool}`,
        steps: context.steps,
        nextAction: 'wait_confirmation',
        contextData: context.contextData,
      };
    }

    // 4. 执行工具
    return await this.executeTool(context, currentTool, parameters);
  }

  /**
   * 生成工具执行参数
   */
  private async generateToolParameters(context: ExecutionContext, toolName: string): Promise<any> {
    const prompt = `基于以下上下文，为工具 ${toolName} 生成执行参数：

用户输入: ${context.userInput}
已执行步骤: ${context.steps.map((s) => `${s.type}: ${s.content}`).join('\n')}
当前工具: ${toolName}
可用上下文数据: ${Array.from(context.contextData.entries())
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n')}

请生成合适的参数，返回JSON格式：
{
  "参数名": "参数值",
  "reasoning": "参数选择的原因"
}`;

    try {
      const response = await this.callOllama(prompt);
      // 尝试解析JSON响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('[IntelligentReasoningEngine] 参数生成失败:', error);
      return {};
    }
  }

  /**
   * 执行工具
   */
  private async executeTool(
    context: ExecutionContext,
    toolName: string,
    parameters: any,
  ): Promise<ReasoningResult> {
    const executionStep = this.createStep(
      'tool_execution',
      `执行工具: ${toolName}`,
      toolName,
      parameters,
    );
    executionStep.status = 'running';
    context.steps.push(executionStep);

    try {
      // 1. 添加执行开始消息
      executionStep.content = `开始执行 ${toolName}，参数: ${JSON.stringify(parameters)}`;

      // 2. 实际执行工具
      const result = await SimpleMCPHelper.callTool(toolName, parameters);

      // 3. 更新步骤状态
      executionStep.status = 'completed';
      executionStep.result = result;
      executionStep.content = `工具 ${toolName} 执行完成，结果: ${result.success ? '成功' : '失败'}`;

      // 4. 存储结果到上下文
      context.results.set(toolName, result);
      context.contextData.set(`${toolName}_result`, result);

      // 5. 添加推理步骤
      const reasoningStep = this.createStep(
        'thinking',
        `分析 ${toolName} 的执行结果，准备下一步操作`,
      );
      context.steps.push(reasoningStep);

      // 6. 移动到下一步
      context.currentStep++;

      // 7. 继续执行下一步
      return await this.executeNextStep(context);
    } catch (error) {
      executionStep.status = 'failed';
      executionStep.content = `工具 ${toolName} 执行失败: ${error instanceof Error ? error.message : '未知错误'}`;

      return {
        success: false,
        content: `工具执行失败: ${toolName}`,
        steps: context.steps,
        nextAction: 'error',
        contextData: context.contextData,
      };
    }
  }

  /**
   * 用户确认后继续执行
   */
  async continueAfterConfirmation(sessionId: string, confirmed: boolean): Promise<ReasoningResult> {
    const context = this.executionContexts.get(sessionId);
    if (!context) {
      return {
        success: false,
        content: '会话不存在',
        steps: [],
        nextAction: 'error',
      };
    }

    if (!confirmed) {
      context.status = 'failed';
      return {
        success: false,
        content: '用户取消了操作',
        steps: context.steps,
        nextAction: 'complete',
        contextData: context.contextData,
      };
    }

    // 找到等待确认的步骤并标记为完成
    const waitingStep = context.steps.find((s) => s.status === 'waiting_confirmation');
    if (waitingStep) {
      waitingStep.status = 'completed';
      waitingStep.content = `用户已确认: ${waitingStep.content}`;
    }

    // 继续执行下一步
    return await this.executeNextStep(context);
  }

  /**
   * 生成最终总结
   */
  private async generateFinalSummary(context: ExecutionContext): Promise<ReasoningResult> {
    const summaryStep = this.createStep('synthesis', '生成执行总结');
    context.steps.push(summaryStep);

    const prompt = `基于以下执行过程，生成一个简洁的总结：

用户输入: ${context.userInput}
执行步骤: ${context.steps.map((s) => `${s.type}: ${s.content}`).join('\n')}
执行结果: ${Array.from(context.results.entries())
      .map(([k, v]) => `${k}: ${v.success ? '成功' : '失败'}`)
      .join('\n')}

请总结整个执行过程，包括：
1. 完成了哪些任务
2. 执行结果如何
3. 是否有需要注意的地方

请用自然语言回复，简洁明了。`;

    try {
      const summary = await this.callOllama(prompt);
      summaryStep.content = summary;
      summaryStep.status = 'completed';

      context.status = 'completed';

      return {
        success: true,
        content: summary,
        steps: context.steps,
        nextAction: 'complete',
        contextData: context.contextData,
      };
    } catch (error) {
      summaryStep.status = 'failed';
      summaryStep.content = '总结生成失败';

      return {
        success: false,
        content: '总结生成失败',
        steps: context.steps,
        nextAction: 'error',
        contextData: context.contextData,
      };
    }
  }

  /**
   * 检查工具是否需要用户确认
   */
  private requiresUserConfirmation(toolName: string): boolean {
    const confirmationRequired = [
      '/navigation/navigate',
      '/window/close_tabs',
      '/interaction/click',
      '/interaction/fill',
      '/script/inject_script',
    ];

    return confirmationRequired.some((pattern) => toolName.includes(pattern));
  }

  /**
   * 创建执行步骤
   */
  private createStep(
    type: ReasoningStep['type'],
    content: string,
    toolName?: string,
    parameters?: any,
  ): ReasoningStep {
    return {
      id: `step_${Date.now()}_${Math.random()}`,
      type,
      content,
      toolName,
      parameters,
      status: 'pending',
      timestamp: new Date(),
    };
  }

  /**
   * 调用Ollama模型
   */
  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || '无法生成响应';
    } catch (error) {
      console.error('[IntelligentReasoningEngine] Ollama调用失败:', error);
      throw error;
    }
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(sessionId: string): ExecutionContext | undefined {
    return this.executionContexts.get(sessionId);
  }

  /**
   * 清理会话
   */
  cleanupSession(sessionId: string): void {
    this.executionContexts.delete(sessionId);
  }
}
