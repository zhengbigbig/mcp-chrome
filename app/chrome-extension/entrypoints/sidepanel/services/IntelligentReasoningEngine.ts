// 智能推理引擎 - 实现类似Cursor的推理调用过程
// 工具执行和大模型推理穿插进行，支持中间确认和动态决策

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SimpleMCPHelper, ToolCallResult } from '../utils/SimpleMCPHelper';
import { UserInteraction, InteractionResult } from '../../../utils/mcp/user-interaction';

export interface ReasoningStep {
  id: string;
  type:
    | 'thinking'
    | 'tool_execution'
    | 'user_confirmation'
    | 'synthesis'
    | 'task_planning'
    | 'task_execution';
  content: string;
  toolName?: string;
  parameters?: any;
  result?: any;
  requiresConfirmation?: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_confirmation';
  timestamp: Date;
  taskChain?: TaskChainItem[];
}

export interface TaskChainItem {
  id: string;
  type: 'tool_call' | 'model_call' | 'user_confirmation';
  name: string;
  parameters?: any;
  description: string;
  dependsOn?: string[]; // 依赖的任务ID
  requiresConfirmation?: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_confirmation';
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
  taskChain: TaskChainItem[]; // 任务链条
  currentTaskIndex: number; // 当前执行的任务索引
}

export interface ReasoningResult {
  success: boolean;
  content: string;
  steps: ReasoningStep[];
  nextAction: 'continue' | 'wait_confirmation' | 'complete' | 'error';
  contextData?: Map<string, any>;
  taskChain?: TaskChainItem[];
  todoList?: string[];
}

export class IntelligentReasoningEngine {
  private availableTools: Map<string, any> = new Map();
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
      const tools = await SimpleMCPHelper.getAvailableTools();
      tools.forEach((tool) => {
        this.availableTools.set(tool.name, tool);
      });
      console.log('[IntelligentReasoningEngine] 可用工具数量:', this.availableTools.size);
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
   * 检测浏览器工具
   */
  private detectBrowserTools(userInput: string): string[] {
    const browserToolPattern = /@browser\/[a-zA-Z0-9_/]+/g;
    return userInput.match(browserToolPattern) || [];
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
        taskChain: [],
        currentTaskIndex: 0,
      };

      this.executionContexts.set(sessionId, context);

      // 3. 生成任务总结和TODO LIST
      return await this.generateTaskSummary(context);
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
   * 生成任务总结和TODO LIST
   */
  private async generateTaskSummary(context: ExecutionContext): Promise<ReasoningResult> {
    const summaryStep = this.createStep('task_planning', '分析用户任务，生成执行计划');
    context.steps.push(summaryStep);

    // 获取工具的详细信息
    const toolDescriptions = await this.getToolDescriptions(context.detectedTools);

    const prompt = `分析以下用户输入，生成任务总结和TODO LIST：

用户输入: ${context.userInput}

检测到的工具及其详细信息:
${toolDescriptions}

请按照以下格式回复：

## 任务总结
[用1-2句话总结本次任务的目标]

## TODO LIST
1. [第一个任务]
2. [第二个任务]
3. [第三个任务]
...

## 任务链条 (JSON格式)
[
  {
    "id": "task_1",
    "type": "tool_call",
    "name": "@browser/content/web_fetcher",
    "parameters": {"selector": "body"},
    "description": "获取页面内容",
    "dependsOn": []
  },
  {
    "id": "task_2", 
    "type": "model_call",
    "name": "analyze_content",
    "parameters": {"content": "{{task_1.result}}"},
    "description": "分析页面内容",
    "dependsOn": ["task_1"]
  }
]

请确保任务链条中的参数能够正确引用前面任务的结果。`;

    try {
      const response = await this.callOllama(prompt);
      summaryStep.content = response;
      summaryStep.status = 'completed';

      // 解析TODO LIST和任务链条
      const { todoList, taskChain } = this.parseTaskSummary(response);
      context.taskChain = taskChain;

      // 开始执行任务链条
      return await this.executeTaskChain(context);
    } catch (error) {
      summaryStep.status = 'failed';
      summaryStep.content = '任务分析失败';

      return {
        success: false,
        content: '任务分析失败',
        steps: context.steps,
        nextAction: 'error',
      };
    }
  }

  /**
   * 解析任务总结，提取TODO LIST和任务链条
   */
  private parseTaskSummary(response: string): { todoList: string[]; taskChain: TaskChainItem[] } {
    const todoList: string[] = [];
    const taskChain: TaskChainItem[] = [];

    // 提取TODO LIST
    const todoMatch = response.match(/## TODO LIST\n([\s\S]*?)(?=\n##|$)/);
    if (todoMatch) {
      const todoLines = todoMatch[1].split('\n').filter((line) => line.trim());
      todoLines.forEach((line) => {
        const match = line.match(/^\d+\.\s*(.+)/);
        if (match) {
          todoList.push(match[1].trim());
        }
      });
    }

    // 提取任务链条
    const chainMatch = response.match(/## 任务链条 \(JSON格式\)\n```json\n([\s\S]*?)\n```/);
    if (chainMatch) {
      try {
        const chainData = JSON.parse(chainMatch[1]);
        chainData.forEach((item: any, index: number) => {
          taskChain.push({
            id: item.id || `task_${index + 1}`,
            type: item.type || 'tool_call',
            name: item.name,
            parameters: item.parameters || {},
            description: item.description || '',
            dependsOn: item.dependsOn || [],
            requiresConfirmation: this.requiresUserConfirmation(item.name),
            status: 'pending',
          });
        });
      } catch (error) {
        console.error('[IntelligentReasoningEngine] 任务链条解析失败:', error);
      }
    }

    return { todoList, taskChain };
  }

  /**
   * 执行任务链条
   */
  private async executeTaskChain(context: ExecutionContext): Promise<ReasoningResult> {
    const { taskChain, currentTaskIndex } = context;

    // 如果所有任务都完成了，进行最终总结
    if (currentTaskIndex >= taskChain.length) {
      return await this.generateFinalSummary(context);
    }

    const currentTask = taskChain[currentTaskIndex];

    // 检查依赖关系
    if (!this.checkDependencies(currentTask, context)) {
      // 依赖未满足，跳过当前任务
      context.currentTaskIndex++;
      return await this.executeTaskChain(context);
    }

    // 1. 添加任务执行步骤
    const executionStep = this.createStep(
      'task_execution',
      `执行任务 ${currentTaskIndex + 1}: ${currentTask.description}`,
    );
    executionStep.taskChain = [currentTask];
    context.steps.push(executionStep);

    // 2. 检查是否需要用户确认
    if (currentTask.requiresConfirmation) {
      currentTask.status = 'waiting_confirmation';
      executionStep.status = 'waiting_confirmation';

      return {
        success: true,
        content: `请确认是否执行: ${currentTask.description}`,
        steps: context.steps,
        nextAction: 'wait_confirmation',
        contextData: context.contextData,
        taskChain: taskChain,
      };
    }

    // 3. 执行任务
    return await this.executeTask(context, currentTask);
  }

  /**
   * 检查任务依赖关系
   */
  private checkDependencies(task: TaskChainItem, context: ExecutionContext): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) {
      return true;
    }

    return task.dependsOn.every((depId) => {
      const depTask = context.taskChain.find((t) => t.id === depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    context: ExecutionContext,
    task: TaskChainItem,
  ): Promise<ReasoningResult> {
    task.status = 'running';

    try {
      if (task.type === 'tool_call') {
        // 执行工具调用
        const result = await this.executeToolCall(context, task);
        task.status = 'completed';

        // 存储结果
        context.results.set(task.id, result);
        context.contextData.set(`${task.id}_result`, result);
      } else if (task.type === 'model_call') {
        // 执行模型调用
        const result = await this.executeModelCall(context, task);
        task.status = 'completed';

        // 存储结果
        context.results.set(task.id, result);
        context.contextData.set(`${task.id}_result`, result);
      }

      // 移动到下一个任务
      context.currentTaskIndex++;

      // 继续执行任务链条
      return await this.executeTaskChain(context);
    } catch (error) {
      task.status = 'failed';

      return {
        success: false,
        content: `任务执行失败: ${task.description}`,
        steps: context.steps,
        nextAction: 'error',
        contextData: context.contextData,
      };
    }
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(context: ExecutionContext, task: TaskChainItem): Promise<any> {
    // 处理参数中的变量引用
    const parameters = this.resolveParameters(task.parameters, context);

    return await SimpleMCPHelper.callTool(task.name, parameters);
  }

  /**
   * 执行模型调用
   */
  private async executeModelCall(context: ExecutionContext, task: TaskChainItem): Promise<any> {
    // 处理参数中的变量引用
    const parameters = this.resolveParameters(task.parameters, context);

    const prompt = `执行模型调用: ${task.description}

参数: ${JSON.stringify(parameters)}
上下文数据: ${Array.from(context.contextData.entries())
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n')}

请根据参数和上下文执行相应的分析或处理。`;

    const result = await this.callOllama(prompt);
    return { success: true, result };
  }

  /**
   * 解析参数中的变量引用
   */
  private resolveParameters(parameters: any, context: ExecutionContext): any {
    if (typeof parameters === 'string') {
      return this.resolveStringVariables(parameters, context);
    } else if (typeof parameters === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(parameters)) {
        resolved[key] = this.resolveParameters(value, context);
      }
      return resolved;
    }
    return parameters;
  }

  /**
   * 解析字符串中的变量引用
   */
  private resolveStringVariables(str: string, context: ExecutionContext): string {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const result = context.results.get(varName);
      return result ? JSON.stringify(result) : match;
    });
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

    // 找到等待确认的任务
    const waitingTask = context.taskChain[context.currentTaskIndex];
    if (waitingTask) {
      waitingTask.status = 'completed';
    }

    // 继续执行任务链条
    return await this.executeTaskChain(context);
  }

  /**
   * 生成最终总结
   */
  private async generateFinalSummary(context: ExecutionContext): Promise<ReasoningResult> {
    const summaryStep = this.createStep('synthesis', '生成执行总结');
    context.steps.push(summaryStep);

    const prompt = `基于以下执行过程，生成一个简洁的总结：

用户输入: ${context.userInput}
执行任务: ${context.taskChain.map((t) => `${t.id}: ${t.description} (${t.status})`).join('\n')}
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
        taskChain: context.taskChain,
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
   * 获取工具的详细信息
   */
  private async getToolDescriptions(toolNames: string[]): Promise<string> {
    const descriptions: string[] = [];

    for (const toolName of toolNames) {
      const tool = this.availableTools.get(toolName);
      if (tool) {
        let description = `工具名称: ${toolName}\n`;
        description += `描述: ${tool.description || '无描述'}\n`;

        if (tool.inputSchema && tool.inputSchema.properties) {
          description += `参数说明:\n`;
          for (const [paramName, paramInfo] of Object.entries(tool.inputSchema.properties)) {
            const param = paramInfo as any;
            description += `  - ${paramName}: ${param.type || 'unknown'}${param.description ? ` (${param.description})` : ''}\n`;
          }

          if (tool.inputSchema.required) {
            description += `必需参数: ${tool.inputSchema.required.join(', ')}\n`;
          }
        }

        if (tool.outputSchema) {
          description += `输出说明: ${JSON.stringify(tool.outputSchema)}\n`;
        }

        descriptions.push(description);
      } else {
        descriptions.push(`工具名称: ${toolName}\n描述: 工具未找到或不可用\n`);
      }
    }

    return descriptions.join('\n---\n');
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
