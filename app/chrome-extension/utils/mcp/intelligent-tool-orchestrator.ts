import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEPENDENCIES, TOOL_PRIORITIES } from 'chrome-mcp-shared';

export interface ToolExecutionPlan {
  id: string;
  toolName: string;
  priority: number;
  dependencies: string[];
  requiresUserConfirmation: boolean;
  canExecuteInParallel: boolean;
  estimatedDuration: number;
  parameters: any;
}

export interface ExecutionContext {
  sessionId: string;
  userInput: string;
  detectedTools: string[];
  executionPlan: ToolExecutionPlan[];
  currentStep: number;
  results: Map<string, any>;
  status: 'pending' | 'executing' | 'waiting_confirmation' | 'completed' | 'failed';
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

export class IntelligentToolOrchestrator {
  private availableTools: Map<string, Tool> = new Map();
  private executionContexts: Map<string, ExecutionContext> = new Map();

  constructor(tools: Tool[]) {
    this.initializeTools(tools);
  }

  /**
   * 初始化可用工具
   */
  private initializeTools(tools: Tool[]) {
    tools.forEach((tool) => {
      this.availableTools.set(tool.name, tool);
    });
  }

  /**
   * 分析用户输入，检测是否包含浏览器工具
   */
  public analyzeUserInput(userInput: string): {
    containsBrowserTools: boolean;
    detectedTools: string[];
    confidence: number;
  } {
    const browserToolPattern = /@browser\/[a-zA-Z0-9_/]+/g;
    const detectedTools = userInput.match(browserToolPattern) || [];

    const containsBrowserTools = detectedTools.length > 0;
    const confidence = this.calculateConfidence(userInput, detectedTools);

    return {
      containsBrowserTools,
      detectedTools,
      confidence,
    };
  }

  /**
   * 计算工具检测的置信度
   */
  private calculateConfidence(userInput: string, detectedTools: string[]): number {
    if (detectedTools.length === 0) return 0;

    // 检查工具是否真实存在
    const validTools = detectedTools.filter((tool) => this.availableTools.has(tool));
    const toolValidityScore = validTools.length / detectedTools.length;

    // 检查输入长度和工具数量的比例
    const inputLengthScore = Math.min(detectedTools.length / 5, 1); // 最多5个工具

    // 检查工具名称的完整性
    const toolCompletenessScore =
      detectedTools.filter((tool) => tool.split('/').length >= 3).length / detectedTools.length;

    return (toolValidityScore + inputLengthScore + toolCompletenessScore) / 3;
  }

  /**
   * 生成任务执行计划
   */
  public async generateExecutionPlan(
    sessionId: string,
    userInput: string,
    detectedTools: string[],
  ): Promise<ExecutionContext> {
    const executionPlan: ToolExecutionPlan[] = [];

    // 为每个检测到的工具创建执行计划
    for (const toolName of detectedTools) {
      const tool = this.availableTools.get(toolName);
      if (!tool) continue;

      const plan: ToolExecutionPlan = {
        id: `${sessionId}_${toolName}_${Date.now()}`,
        toolName,
        priority: this.calculateToolPriority(toolName),
        dependencies: this.getToolDependencies(toolName),
        requiresUserConfirmation: this.requiresUserConfirmation(toolName),
        canExecuteInParallel: this.canExecuteInParallel(toolName),
        estimatedDuration: this.estimateToolDuration(toolName),
        parameters: this.extractToolParameters(userInput, toolName),
      };

      executionPlan.push(plan);
    }

    // 排序执行计划
    executionPlan.sort((a, b) => a.priority - b.priority);

    const context: ExecutionContext = {
      sessionId,
      userInput,
      detectedTools,
      executionPlan,
      currentStep: 0,
      results: new Map(),
      status: 'pending',
    };

    this.executionContexts.set(sessionId, context);
    return context;
  }

  /**
   * 计算工具执行优先级
   */
  private calculateToolPriority(toolName: string): number {
    // 基础优先级
    let priority: number = TOOL_PRIORITIES.MEDIUM;

    // 根据工具类型调整优先级
    if (toolName.includes('/navigation/')) {
      priority = TOOL_PRIORITIES.HIGH; // 导航工具优先级高
    } else if (toolName.includes('/content/')) {
      priority = TOOL_PRIORITIES.LOW; // 内容获取工具可以并行
    } else if (toolName.includes('/interaction/')) {
      priority = TOOL_PRIORITIES.MEDIUM; // 交互工具需要等待内容
    }

    return priority;
  }

  /**
   * 获取工具依赖关系
   */
  private getToolDependencies(toolName: string): string[] {
    const deps = TOOL_DEPENDENCIES[toolName as keyof typeof TOOL_DEPENDENCIES];
    return deps ? [...deps] : []; // 转换为可变数组
  }

  /**
   * 判断工具是否需要用户确认
   */
  private requiresUserConfirmation(toolName: string): boolean {
    // 需要用户确认的工具类型
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
   * 判断工具是否可以并行执行
   */
  private canExecuteInParallel(toolName: string): boolean {
    // 可以并行执行的工具类型
    const parallelTools = [
      '/content/web_fetcher',
      '/content/screenshot',
      '/data/history',
      '/data/bookmark_search',
      '/debug/console',
    ];

    return parallelTools.some((pattern) => toolName.includes(pattern));
  }

  /**
   * 估算工具执行时间
   */
  private estimateToolDuration(toolName: string): number {
    // 基础执行时间估算（毫秒）
    const baseDurations: Record<string, number> = {
      '/navigation/navigate': 2000,
      '/content/web_fetcher': 1000,
      '/content/screenshot': 1500,
      '/interaction/click': 500,
      '/interaction/fill': 300,
      '/network/request': 3000,
      '/data/history': 800,
      '/data/bookmark_search': 600,
    };

    for (const [pattern, duration] of Object.entries(baseDurations)) {
      if (toolName.includes(pattern)) {
        return duration;
      }
    }

    return 1000; // 默认1秒
  }

  /**
   * 从用户输入中提取工具参数
   */
  private extractToolParameters(userInput: string, toolName: string): any {
    const params: any = {};

    // 根据工具类型提取常见参数
    if (toolName.includes('/navigation/navigate')) {
      const urlMatch = userInput.match(/https?:\/\/[^\s]+/);
      if (urlMatch) params.url = urlMatch[0];
    }

    if (toolName.includes('/interaction/click')) {
      const selectorMatch = userInput.match(/点击\s*([^\s]+)/);
      if (selectorMatch) params.selector = selectorMatch[1];
    }

    if (toolName.includes('/interaction/fill')) {
      const fillMatch = userInput.match(/填写\s*([^\s]+)\s*为\s*([^\s]+)/);
      if (fillMatch) {
        params.selector = fillMatch[1];
        params.value = fillMatch[2];
      }
    }

    if (toolName.includes('/content/screenshot')) {
      const screenshotMatch = userInput.match(/截图\s*([^\s]+)/);
      if (screenshotMatch) params.selector = screenshotMatch[1];
    }

    return params;
  }

  /**
   * 生成任务清单提示词
   */
  public generateTaskListPrompt(userInput: string, detectedTools: string[]): string {
    const toolDescriptions = detectedTools
      .map((tool) => {
        const toolInfo = this.availableTools.get(tool);
        return `- ${tool}: ${toolInfo?.description || '无描述'}`;
      })
      .join('\n');

    return `用户输入: "${userInput}"

检测到的浏览器工具:
${toolDescriptions}

请根据用户意图，列出需要执行的任务清单，包括：
1. 任务执行顺序
2. 哪些任务需要用户确认
3. 哪些任务可以并行执行
4. 任务之间的依赖关系
5. 每个任务的预期结果

请以JSON格式返回任务清单：
{
  "tasks": [
    {
      "id": "task_1",
      "tool": "@browser/xxx/xxx",
      "description": "任务描述",
      "requiresConfirmation": true/false,
      "canExecuteInParallel": true/false,
      "dependencies": ["task_id"],
      "expectedResult": "预期结果描述"
    }
  ]
}`;
  }

  /**
   * 执行工具编排流程
   */
  public async executeOrchestration(
    sessionId: string,
    userInput: string,
  ): Promise<ExecutionContext> {
    // 1. 分析用户输入
    const analysis = this.analyzeUserInput(userInput);

    if (!analysis.containsBrowserTools) {
      // 不包含浏览器工具，直接返回
      return {
        sessionId,
        userInput,
        detectedTools: [],
        executionPlan: [],
        currentStep: 0,
        results: new Map(),
        status: 'completed',
      };
    }

    // 2. 生成执行计划
    const context = await this.generateExecutionPlan(sessionId, userInput, analysis.detectedTools);

    // 3. 更新状态
    context.status = 'executing';
    this.executionContexts.set(sessionId, context);

    return context;
  }

  /**
   * 获取执行上下文
   */
  public getExecutionContext(sessionId: string): ExecutionContext | undefined {
    return this.executionContexts.get(sessionId);
  }

  /**
   * 更新执行结果
   */
  public updateExecutionResult(
    sessionId: string,
    toolName: string,
    result: ToolExecutionResult,
  ): void {
    const context = this.executionContexts.get(sessionId);
    if (context) {
      context.results.set(toolName, result);

      // 检查是否所有任务都完成了
      const completedTasks = Array.from(context.results.keys());
      if (completedTasks.length === context.executionPlan.length) {
        context.status = 'completed';
      }
    }
  }

  /**
   * 等待用户确认
   */
  public waitForUserConfirmation(sessionId: string): void {
    const context = this.executionContexts.get(sessionId);
    if (context) {
      context.status = 'waiting_confirmation';
    }
  }

  /**
   * 继续执行
   */
  public continueExecution(sessionId: string): void {
    const context = this.executionContexts.get(sessionId);
    if (context) {
      context.status = 'executing';
    }
  }

  /**
   * 清理执行上下文
   */
  public cleanupExecutionContext(sessionId: string): void {
    this.executionContexts.delete(sessionId);
  }
}
