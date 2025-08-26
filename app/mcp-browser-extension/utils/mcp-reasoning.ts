// MCP 智能推理系统 - 优化版实现
// 支持交互式工具、并行/串行执行控制、上下文管理

import { BrowserClientTransport, Tool, CallToolResult } from './mcp-client';
import { 
  ToolRegistry, 
  ExecutionPlanner, 
  EnhancedTool, 
  ToolExecutionPlan, 
  ToolExecutionPhase,
  ToolCall 
} from './tool-definitions';
import { 
  UserInteractionManager, 
  ScrollInteractionManager,
  InteractionResult,
  UserInteraction 
} from './user-interaction';
import { 
  MultiMCPClient, 
  ToolCallRequest, 
  ToolCallResponse,
  multiMCPClient
} from './multi-mcp-client';
import { ServerTool } from './server-registry';

// 推理结果接口
interface ReasoningResult {
  executionPlan: ToolExecutionPlan;
  finalResponse: string;
  confidence: number;
  totalTime: number;
  interactionCount: number;
}

// 上下文管理接口
interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: any[];
    timestamp: number;
  }>;
  selectedTools: Set<string>;
  lastUsedArgs: Map<string, any>;
  userPreferences: Map<string, any>;
}

// 推理步骤类型
export type ReasoningStepType = 
  | 'start' 
  | 'analysis' 
  | 'tool_selection' 
  | 'execution_plan' 
  | 'user_interaction' 
  | 'phase_start' 
  | 'tool_executing' 
  | 'tool_result' 
  | 'phase_complete' 
  | 'synthesis' 
  | 'complete' 
  | 'error';

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  parameter_size: string;
  family: string;
}

export class MCPReasoningEngine {
  private tools: ServerTool[] = []; // 改为 ServerTool[]
  private ollamaBaseUrl: string = 'http://localhost:11434';
  private ollamaModel: string = 'deepseek-r1:1.5b';
  private availableModels: OllamaModel[] = [];
  private mcpClient: MultiMCPClient; // 改为 MultiMCPClient
  
  // 新增组件
  private toolRegistry: ToolRegistry;
  private executionPlanner: ExecutionPlanner;
  private userInteraction: UserInteractionManager;
  private scrollInteraction: ScrollInteractionManager;
  private context: ConversationContext;

  // 运行时状态
  private isExecuting = false;
  private currentExecutionPlan?: ToolExecutionPlan;

  constructor() {
    this.mcpClient = multiMCPClient; // 使用单例
    this.toolRegistry = new ToolRegistry();
    this.executionPlanner = new ExecutionPlanner(this.toolRegistry);
    this.userInteraction = new UserInteractionManager();
    this.scrollInteraction = new ScrollInteractionManager(this.userInteraction);
    
    // 初始化上下文
    this.context = {
      messages: [],
      selectedTools: new Set(),
      lastUsedArgs: new Map(),
      userPreferences: new Map(),
    };

    this.initializeMultiMCP();
  }

  // 初始化多 MCP 客户端
  private async initializeMultiMCP() {
    try {
      await this.mcpClient.initialize();
      await this.mcpClient.restoreServerConfigs();
      await this.loadTools();
      await this.loadAvailableModels();
      console.log('[Reasoning] MultiMCP 初始化完成');
    } catch (error) {
      console.error('[Reasoning] MultiMCP 初始化失败:', error);
    }
  }

  // 设置用户交互处理器
  setInteractionHandler(handler: (interaction: UserInteraction) => Promise<InteractionResult>) {
    this.userInteraction.setInteractionHandler(handler);
  }

  // 获取可用模型列表
  async loadAvailableModels(): Promise<OllamaModel[]> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'OLLAMA_LIST_MODELS' });
      if (response.success) {
        this.availableModels = response.models;
        console.log('[Reasoning] 已加载可用模型:', this.availableModels);
        return this.availableModels;
      } else {
        console.error('[Reasoning] 获取模型列表失败:', response.error);
        return [];
      }
    } catch (error) {
      console.error('[Reasoning] 加载模型列表失败:', error);
      return [];
    }
  }

  // 获取可用模型列表
  getAvailableModels(): OllamaModel[] {
    return this.availableModels;
  }

  // 获取当前模型
  getCurrentModel(): string {
    return this.ollamaModel;
  }

  // 切换模型
  async switchModel(modelName: string): Promise<boolean> {
    const model = this.availableModels.find(m => m.name === modelName);
    if (!model) {
      console.error('[Reasoning] 模型不存在:', modelName);
      return false;
    }

    this.ollamaModel = modelName;
    console.log('[Reasoning] 已切换到模型:', modelName);
    
    // 保存到 Chrome Storage
    try {
      await chrome.storage.local.set({ selectedOllamaModel: modelName });
    } catch (error) {
      console.error('[Reasoning] 保存模型选择失败:', error);
    }
    
    return true;
  }

  // 从存储中恢复模型选择
  async restoreModelChoice(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['selectedOllamaModel']);
      if (result.selectedOllamaModel) {
        const savedModel = result.selectedOllamaModel;
        // 确保保存的模型在可用列表中
        if (this.availableModels.some(m => m.name === savedModel)) {
          this.ollamaModel = savedModel;
          console.log('[Reasoning] 已恢复模型选择:', savedModel);
        }
      }
    } catch (error) {
      console.error('[Reasoning] 恢复模型选择失败:', error);
    }
  }

  // 加载可用工具 - 从所有 MCP Server
  private async loadTools() {
    try {
      this.tools = this.mcpClient.getAllTools();
      console.log(`[Reasoning] 已加载 ${this.tools.length} 个工具，来自 ${this.mcpClient.getAllServers().length} 个 server:`);
      this.tools.forEach(tool => {
        console.log(`  - ${tool.serverName}.${tool.name}: ${tool.description}`);
      });
    } catch (error) {
      console.error('[Reasoning] 加载工具失败:', error);
    }
  }

  // 智能推理主函数 - 优化版本
  async reason(userInput: string): Promise<ReasoningResult> {
    if (this.isExecuting) {
      throw new Error('已有推理任务在执行中，请等待完成');
    }

    this.isExecuting = true;
    const startTime = Date.now();
    let interactionCount = 0;

    try {
      console.log('[Reasoning] 开始推理:', userInput);

      // 1. 更新上下文
      this.updateContext({
        role: 'user',
        content: userInput,
        timestamp: Date.now(),
      });

      // 2. 分析用户输入并选择工具
      const toolCalls = await this.selectToolsWithLLM(userInput);
      console.log('[Reasoning] 工具选择结果:', toolCalls);

      // 3. 生成执行计划
      const executionPlan = this.executionPlanner.generateExecutionPlan(toolCalls);
      this.currentExecutionPlan = executionPlan;
      console.log('[Reasoning] 执行计划:', executionPlan);

      // 4. 执行计划
      const toolResults = await this.executeExecutionPlan(executionPlan);
      
      // 统计交互次数
      interactionCount = executionPlan.phases.reduce((count, phase) => 
        count + (phase.requiresUserConfirmation ? 1 : 0), 0
      );

      // 5. 综合结果
      const finalResponse = await this.synthesizeResponse(userInput, toolResults);
      console.log('[Reasoning] 最终回复:', finalResponse);

      // 6. 更新上下文
      this.updateContext({
        role: 'assistant',
        content: finalResponse,
        toolCalls,
        toolResults,
        timestamp: Date.now(),
      });

      const totalTime = Date.now() - startTime;

      return {
        executionPlan,
        finalResponse,
        confidence: toolCalls.length > 0 ? 0.8 : 0.6,
        totalTime,
        interactionCount,
      };
    } catch (error) {
      console.error('[Reasoning] 推理失败:', error);
      
      const totalTime = Date.now() - startTime;
      return {
        executionPlan: { phases: [], totalEstimatedTime: 0, requiresUserInteraction: false },
        finalResponse: `推理过程中发生错误: ${error instanceof Error ? error.message : error}`,
        confidence: 0.1,
        totalTime,
        interactionCount,
      };
    } finally {
      this.isExecuting = false;
      this.currentExecutionPlan = undefined;
    }
  }

  // 分析用户输入并选择合适的工具
  private async analyzeAndSelectTools(userInput: string): Promise<{ toolCalls: ToolCall[]; confidence: number }> {
    const toolsDescription = this.tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    const analysisPrompt = `
你是一个智能工具选择助手。用户提出了一个问题或请求，你需要分析是否需要使用工具来帮助回答。

可用工具列表：
${toolsDescription}

用户输入: "${userInput}"

请分析用户的意图，并决定是否需要使用工具。如果需要，请选择合适的工具并生成调用参数。

请以 JSON 格式回复，包含以下字段：
{
  "needsTools": boolean,
  "reasoning": "分析推理过程",
  "toolCalls": [
    {
      "tool": "工具名称",
      "args": {"参数": "值"},
      "reasoning": "为什么选择这个工具"
    }
  ],
  "confidence": 0.0-1.0
}

如果不需要工具，toolCalls 设为空数组。
`;

    try {
      const response = await this.callOllama(analysisPrompt);
      const analysis = this.parseJSONResponse(response);
      
      return {
        toolCalls: analysis.toolCalls || [],
        confidence: analysis.confidence || 0.5,
      };
    } catch (error) {
      console.error('[Reasoning] 工具分析失败:', error);
      // 降级到基于关键词的简单分析
      const fallbackTools = this.fallbackToolSelection(userInput);
      return { toolCalls: fallbackTools, confidence: 0.5 };
    }
  }



  // 执行选中的工具 - 使用真正的 MCP Client
  private async executeTools(toolCalls: ToolCall[]): Promise<Array<{ call: ToolCall; result: CallToolResult; success: boolean }>> {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        console.log('[Reasoning] 执行工具:', toolCall);
        const result = await this.mcpClient.callTool({
          tool: toolCall.tool,
          server: toolCall.server,
          args: toolCall.args,
        });

        results.push({
          call: toolCall,
          result: result.result,
          success: result.success,
        });
      } catch (error) {
        results.push({
          call: toolCall,
          result: {
            content: [
              {
                type: 'text' as const,
                text: `错误: ${error instanceof Error ? error.message : '工具执行失败'}`,
              },
            ],
            isError: true,
          } as CallToolResult,
          success: false,
        });
      }
    }

    return results;
  }

  // 综合工具结果，生成最终回复
  private async synthesizeResponse(
    userInput: string, 
    toolResults: Array<{ call: ToolCall; result: any; success: boolean }>
  ): Promise<string> {
    if (toolResults.length === 0) {
      // 没有工具调用，直接用大模型回答
      return await this.callOllama(`用户问题: "${userInput}"\n\n请直接回答用户的问题。`);
    }

    // 构建包含工具结果的提示
    const toolResultsText = toolResults.map(({ call, result, success }) => {
      const resultText = success 
        ? (result.content ? result.content[0]?.text : JSON.stringify(result))
        : `错误: ${result.error}`;
      
      return `工具: ${call.tool}
参数: ${JSON.stringify(call.args)}
结果: ${resultText}`;
    }).join('\n\n');

    const synthesisPrompt = `
用户原始问题: "${userInput}"

为了回答这个问题，我调用了以下工具并获得了结果：

${toolResultsText}

请基于这些工具的执行结果，为用户提供一个完整、准确、有用的回答。请：
1. 整合所有相关信息
2. 用自然语言表达
3. 如果有错误，请说明并尝试给出替代建议
4. 保持回答简洁明了
`;

    try {
      return await this.callOllama(synthesisPrompt);
    } catch (error) {
      // 如果大模型调用失败，提供基础的工具结果汇总
      const successfulResults = toolResults.filter(r => r.success);
      if (successfulResults.length > 0) {
        return successfulResults.map(r => 
          r.result.content ? r.result.content[0]?.text : JSON.stringify(r.result)
        ).join('\n\n');
      } else {
        return '工具执行失败，无法获取结果。';
      }
    }
  }

  // 调用 Ollama 大模型
  private async callOllama(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'OLLAMA_REQUEST',
        url: `${this.ollamaBaseUrl}/api/generate`,
        data: {
          model: this.ollamaModel,
          prompt,
          stream: false,
        },
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.success) {
          resolve(response.result.response || '模型没有返回响应');
        } else {
          reject(new Error(response.error || 'Ollama 请求失败'));
        }
      });
    });
  }

  // 解析 JSON 响应
  private parseJSONResponse(response: string): any {
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // 如果没有找到 JSON，返回默认结构
      return {
        needsTools: false,
        reasoning: '无法解析 JSON 响应',
        toolCalls: [],
        confidence: 0.1,
      };
    } catch (error) {
      console.error('[Reasoning] JSON 解析失败:', error);
      return {
        needsTools: false,
        reasoning: 'JSON 解析错误',
        toolCalls: [],
        confidence: 0.1,
      };
    }
  }

  // 流式推理（用于实时显示推理过程）
  async *reasonStream(userInput: string): AsyncGenerator<{ type: string; content: any }> {
    yield { type: 'start', content: '开始分析用户输入...' };

    try {
      // 工具分析阶段
      yield { type: 'analysis', content: '正在分析需要使用的工具...' };
      const toolAnalysis = await this.analyzeAndSelectTools(userInput);
      
      if (toolAnalysis.toolCalls.length > 0) {
        yield { 
          type: 'tools_selected', 
          content: {
            message: `选择了 ${toolAnalysis.toolCalls.length} 个工具`,
            tools: toolAnalysis.toolCalls,
          }
        };

        // 工具执行阶段
        const toolResults = [];
        for (const toolCall of toolAnalysis.toolCalls) {
          yield { 
            type: 'tool_executing', 
            content: `正在执行工具: ${toolCall.tool}...` 
          };
          
          const result = await this.executeTools([toolCall]);
          toolResults.push(...result);
          
          yield { 
            type: 'tool_result', 
            content: {
              tool: toolCall.tool,
              result: result[0],
            }
          };
        }

        // 最终推理阶段
        yield { type: 'synthesis', content: '正在整合结果并生成回答...' };
        const finalResponse = await this.synthesizeResponse(userInput, toolResults);
        
        yield { 
          type: 'complete', 
          content: {
            finalResponse,
            toolCalls: toolAnalysis.toolCalls,
            confidence: toolAnalysis.confidence,
          }
        };
      } else {
        // 直接回答
        yield { type: 'direct_answer', content: '无需工具，直接回答...' };
        const directResponse = await this.callOllama(`用户问题: "${userInput}"\n\n请直接回答用户的问题。`);
        
        yield { 
          type: 'complete', 
          content: {
            finalResponse: directResponse,
            toolCalls: [],
            confidence: 0.8,
          }
        };
      }
    } catch (error) {
      yield { 
        type: 'error', 
        content: `推理过程中出现错误: ${error instanceof Error ? error.message : error}` 
      };
    }
  }

  // === 新增方法：优化版本的核心功能 ===

  // 上下文管理
  private updateContext(message: ConversationContext['messages'][0]) {
    this.context.messages.push(message);
    if (this.context.messages.length > 20) { // 保持上下文窗口大小
      this.context.messages.shift();
    }
  }

  private getContextualPrompt(userInput: string): string {
    const recentContext = this.context.messages
      .slice(-5)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `
最近的对话历史：
${recentContext}

当前用户输入：
${userInput}

请基于上下文历史和当前输入来分析和选择工具。
`;
  }

  // LLM 驱动的工具选择 - 支持多 Server
  private async selectToolsWithLLM(userInput: string): Promise<ToolCall[]> {
    const availableTools = this.tools; // 使用来自所有 server 的工具
    const serverStats = this.mcpClient.getStats();
    
    const toolsDescription = availableTools.map(tool => 
      `- ${tool.serverName}.${tool.name}: ${tool.description}
        服务器: ${tool.serverDisplayName} (优先级: ${tool.serverPriority})
        成功率: ${((tool.successRate || 1.0) * 100).toFixed(1)}%
        最后使用: ${tool.lastUsed ? new Date(tool.lastUsed).toLocaleString() : '从未'}`
    ).join('\n');

    const serverInfo = this.mcpClient.getAllServers().map(s => 
      `- ${s.config.name}: ${s.status.status} (延迟: ${s.status.latency || 'N/A'}ms)`
    ).join('\n');

    const contextualPrompt = this.getContextualPrompt(userInput);
    
    const analysisPrompt = `
${contextualPrompt}

可用服务器状态：
${serverInfo}
总计: ${serverStats.totalServers} 个服务器，${serverStats.healthyServers} 个健康，平均延迟 ${serverStats.avgLatency}ms

可用工具列表（格式: 服务器.工具名）：
${toolsDescription}

请分析用户意图并选择合适的工具。注意：
- 优先选择健康、成功率高、延迟低的服务器
- 交互式工具需要用户确认
- 某些工具之间有冲突，不能并行执行
- 考虑工具的执行时间和优先级
- 可以选择多个工具进行组合

请以 JSON 格式回复：
{
  "needsTools": boolean,
  "reasoning": "分析推理过程",
  "toolCalls": [
    {
      "tool": "工具名称",
      "server": "服务器名称（可选，留空自动选择最佳服务器）",
      "args": {"参数": "值"},
      "reasoning": "为什么选择这个工具和服务器",
      "confirmationMessage": "需要用户确认时的消息（可选）"
    }
  ]
}
`;

    try {
      const response = await this.callOllama(analysisPrompt);
      console.log('[Reasoning] LLM 原始响应:', response);
      
      const result = JSON.parse(response);
      console.log('[Reasoning] LLM 解析结果:', result);
      
      if (result.needsTools && result.toolCalls) {
        const toolCalls = result.toolCalls.map((tc: any, index: number) => {
          console.log(`[Reasoning] 处理工具调用 ${index}:`, tc);
          
          // 验证工具对象
          if (!tc.tool) {
            console.error(`[Reasoning] 工具 ${index} 缺少 tool 属性:`, tc);
          }
          
          const toolCall = {
            tool: tc.tool,
            server: tc.server, // 添加 server 支持
            args: tc.args || {},
            reasoning: tc.reasoning || '自动选择',
            confirmationMessage: tc.confirmationMessage,
          };
          
          console.log(`[Reasoning] 映射后的工具调用 ${index}:`, toolCall);
          return toolCall;
        });
        console.log('[Reasoning] 最终工具调用列表:', toolCalls);
        return toolCalls;
      }
      
      return [];
    } catch (error) {
      console.error('[Reasoning] LLM 工具选择失败，回退到关键词匹配:', error);
      return this.fallbackToolSelection(userInput);
    }
  }

  // 回退的关键词匹配工具选择
  private fallbackToolSelection(userInput: string): ToolCall[] {
    const lowerInput = userInput.toLowerCase();
    const toolCalls: ToolCall[] = [];

    // 测试服务器工具
    if (lowerInput.includes('随机数') || lowerInput.includes('random')) {
      toolCalls.push({
        tool: 'random_number',
        server: 'test-server',
        args: { min: 1, max: 100 },
        reasoning: '检测到随机数生成请求',
      });
    }

    if (lowerInput.includes('天气') || lowerInput.includes('weather')) {
      const cityMatch = userInput.match(/[^\s]+(?=天气|的天气)/);
      const city = cityMatch ? cityMatch[0] : '北京';
      toolCalls.push({
        tool: 'weather',
        server: 'test-server',
        args: { city },
        reasoning: '检测到天气查询',
      });
    }

    if (lowerInput.includes('编码') || lowerInput.includes('base64')) {
      const textMatch = userInput.match(/['"]([^'"]+)['"]|编码\s*([^\s]+)/);
      const text = textMatch ? (textMatch[1] || textMatch[2]) : 'Hello World';
      toolCalls.push({
        tool: 'base64_encode',
        server: 'test-server',
        args: { text },
        reasoning: '检测到 Base64 编码请求',
      });
    }

    if (lowerInput.includes('系统信息') || lowerInput.includes('system')) {
      toolCalls.push({
        tool: 'system_info',
        server: 'test-server',
        args: {},
        reasoning: '检测到系统信息查询',
      });
    }

    // 内置工具
    if (lowerInput.includes('计算') || lowerInput.includes('算')) {
      const mathRegex = /[\d+\-*/.() ]+/;
      const match = userInput.match(mathRegex);
      if (match) {
        toolCalls.push({
          tool: 'calculate',
          server: 'builtin',
          args: { expression: match[0].trim() },
          reasoning: '检测到数学表达式',
        });
      }
    }

    if (lowerInput.includes('时间') || lowerInput.includes('现在几点')) {
      toolCalls.push({
        tool: 'get_time',
        server: 'builtin',
        args: {},
        reasoning: '检测到时间查询',
      });
    }

    if (lowerInput.includes('页面') || lowerInput.includes('网页')) {
      toolCalls.push({
        tool: 'get_page_info',
        server: 'builtin',
        args: {},
        reasoning: '检测到页面信息查询',
      });
    }

    if (lowerInput.includes('滚动') || lowerInput.includes('scroll')) {
      const direction = lowerInput.includes('上') ? 'up' :
                      lowerInput.includes('下') ? 'down' :
                      lowerInput.includes('顶部') ? 'top' :
                      lowerInput.includes('底部') ? 'bottom' : 'down';
      toolCalls.push({
        tool: 'scroll_page',
        args: { direction },
        reasoning: '检测到页面滚动请求',
        confirmationMessage: `即将${direction === 'up' ? '向上' : direction === 'down' ? '向下' : direction === 'top' ? '到顶部' : '到底部'}滚动页面`,
      });
    }

    return toolCalls;
  }

  // 执行执行计划
  private async executeExecutionPlan(plan: ToolExecutionPlan): Promise<Array<{ call: ToolCall; result: CallToolResult; success: boolean }>> {
    const allResults: Array<{ call: ToolCall; result: CallToolResult; success: boolean }> = [];

    for (const phase of plan.phases) {
      console.log(`[Reasoning] 开始执行阶段: ${phase.name}`);

      // 用户确认
      if (phase.requiresUserConfirmation) {
        const confirmed = await this.requestPhaseConfirmation(phase);
        if (!confirmed) {
          console.log(`[Reasoning] 用户取消了阶段: ${phase.name}`);
          continue;
        }
      }

      // 执行阶段中的工具
      let phaseResults: Array<{ call: ToolCall; result: CallToolResult; success: boolean }>;
      
      if (phase.executionMode === 'parallel') {
        phaseResults = await this.executeToolsParallel(phase.tools);
      } else {
        phaseResults = await this.executeToolsSerial(phase.tools);
      }

      allResults.push(...phaseResults);
      console.log(`[Reasoning] 阶段 ${phase.name} 执行完成`);
    }

    return allResults;
  }

  // 请求阶段确认
  private async requestPhaseConfirmation(phase: ToolExecutionPhase): Promise<boolean> {
    const toolNames = phase.tools.map(tc => tc.tool).join(', ');
    const message = `即将执行 ${phase.executionMode === 'parallel' ? '并行' : '串行'} 工具: ${toolNames}`;
    
    return await this.userInteraction.requestConfirmation(
      '执行确认',
      message,
      30000
    );
  }

  // 并行执行工具
  private async executeToolsParallel(toolCalls: ToolCall[]): Promise<Array<{ call: ToolCall; result: CallToolResult; success: boolean }>> {
    console.log(`[Reasoning] 开始并行执行 ${toolCalls.length} 个工具`);
    toolCalls.forEach((toolCall, index) => {
      console.log(`[Reasoning] 工具 ${index}: `, toolCall);
    });

    const promises = toolCalls.map(async toolCall => {
      try {
        console.log(`[Reasoning] 执行工具:`, toolCall);
        
        // 验证工具调用对象
        if (!toolCall.tool) {
          throw new Error(`工具名称为空: ${JSON.stringify(toolCall)}`);
        }

        // 检查是否需要特殊的交互处理
        if (toolCall.tool === 'scroll_page') {
          return await this.executeScrollTool(toolCall);
        }

        // 详细调试调用参数
        const callParams = {
          tool: toolCall.tool,
          server: toolCall.server,
          args: toolCall.args,
        };
        console.log(`[Reasoning] 调用参数:`, callParams);
        console.log(`[Reasoning] toolCall.tool 值:`, toolCall.tool);
        console.log(`[Reasoning] toolCall 完整对象:`, toolCall);

        const response = await this.mcpClient.callTool(callParams);
        
        return {
          call: toolCall,
          result: response.result,
          success: response.success,
        };
      } catch (error) {
        return {
          call: toolCall,
          result: {
            content: [{ type: 'text' as const, text: `错误: ${error}` }],
            isError: true,
          } as CallToolResult,
          success: false,
        };
      }
    });

    return await Promise.all(promises);
  }

  // 串行执行工具
  private async executeToolsSerial(toolCalls: ToolCall[]): Promise<Array<{ call: ToolCall; result: CallToolResult; success: boolean }>> {
    const results: Array<{ call: ToolCall; result: CallToolResult; success: boolean }> = [];
    
    console.log(`[Reasoning] 开始串行执行 ${toolCalls.length} 个工具`);
    toolCalls.forEach((toolCall, index) => {
      console.log(`[Reasoning] 串行工具 ${index}: `, toolCall);
    });

    for (const toolCall of toolCalls) {
      try {
        console.log(`[Reasoning] 串行执行工具:`, toolCall);
        
        // 验证工具调用对象
        if (!toolCall.tool) {
          throw new Error(`工具名称为空: ${JSON.stringify(toolCall)}`);
        }

        // 检查是否需要特殊的交互处理
        if (toolCall.tool === 'scroll_page') {
          const result = await this.executeScrollTool(toolCall);
          results.push(result);
          continue;
        }

        // 详细调试调用参数
        const callParams = {
          tool: toolCall.tool,
          server: toolCall.server,
          args: toolCall.args,
        };
        console.log(`[Reasoning] 串行调用参数:`, callParams);
        console.log(`[Reasoning] 串行 toolCall.tool 值:`, toolCall.tool);
        console.log(`[Reasoning] 串行 toolCall 完整对象:`, toolCall);

        const response = await this.mcpClient.callTool(callParams);
        
        results.push({
          call: toolCall,
          result: response.result,
          success: response.success,
        });
      } catch (error) {
        results.push({
          call: toolCall,
          result: {
            content: [{ type: 'text' as const, text: `错误: ${error}` }],
            isError: true,
          } as CallToolResult,
          success: false,
        });
      }
    }

    return results;
  }

  // 执行滚动工具（特殊交互处理）
  private async executeScrollTool(toolCall: ToolCall): Promise<{ call: ToolCall; result: CallToolResult; success: boolean }> {
    try {
      const direction = toolCall.args.direction || 'down';
      
      // 1. 请求用户确认
      const confirmed = await this.scrollInteraction.confirmScrollStart(direction);
      if (!confirmed) {
        return {
          call: toolCall,
          result: {
            content: [{ type: 'text' as const, text: '用户取消了滚动操作' }],
          } as CallToolResult,
          success: false,
        };
      }

      // 2. 显示滚动进度
      await this.scrollInteraction.showScrollProgress(direction);

      // 3. 执行滚动
      const response = await this.mcpClient.callTool({
        tool: toolCall.tool,
        server: toolCall.server,
        args: toolCall.args,
      });
      const result = response.result;

      // 4. 请求停止确认
      const stopConfirmed = await this.scrollInteraction.confirmScrollStop();
      
      return {
        call: toolCall,
        result: {
          content: [{ 
            type: 'text' as const, 
            text: `滚动完成。方向: ${direction}，用户${stopConfirmed ? '确认' : '未确认'}停止。` 
          }],
        } as CallToolResult,
        success: true,
      };
    } catch (error) {
      return {
        call: toolCall,
        result: {
          content: [{ type: 'text' as const, text: `滚动执行失败: ${error}` }],
          isError: true,
        } as CallToolResult,
        success: false,
      };
    }
  }

  // 获取当前执行状态
  getExecutionState() {
    return {
      isExecuting: this.isExecuting,
      currentPlan: this.currentExecutionPlan,
      pendingInteractions: this.userInteraction.getPendingInteractions(),
      contextSize: this.context.messages.length,
    };
  }

  // 取消当前执行
  cancelExecution(): boolean {
    if (this.isExecuting) {
      this.isExecuting = false;
      this.currentExecutionPlan = undefined;
      
      // 取消所有待处理的交互
      const pending = this.userInteraction.getPendingInteractions();
      pending.forEach(interaction => {
        this.userInteraction.cancelInteraction(interaction.id);
      });
      
      return true;
    }
    return false;
  }

  // === Server 管理方法 ===

  // 添加新的 MCP Server
  async addServer(config: any): Promise<boolean> {
    const success = await this.mcpClient.addServer(config);
    if (success) {
      await this.loadTools(); // 重新加载工具
    }
    return success;
  }

  // 移除 MCP Server
  async removeServer(name: string): Promise<boolean> {
    const success = await this.mcpClient.removeServer(name);
    if (success) {
      await this.loadTools(); // 重新加载工具
    }
    return success;
  }

  // 获取所有 Server
  getAllServers() {
    return this.mcpClient.getAllServers();
  }

  // 获取 Server 统计信息
  getServerStats() {
    return this.mcpClient.getStats();
  }

  // 执行健康检查
  async healthCheckServers() {
    return await this.mcpClient.healthCheck();
  }

  // 刷新工具列表
  async refreshTools() {
    await this.loadTools();
  }

  // 获取可用工具（供 UI 使用）
  getAvailableTools() {
    return this.tools;
  }

  // 直接调用工具（供手动调用使用）
  async callToolDirectly(toolName: string, args: any, preferredServer?: string) {
    try {
      console.log(`[Reasoning] 直接调用工具: ${toolName}, 服务器: ${preferredServer || 'auto'}`);
      console.log(`[Reasoning] 参数:`, args);
      console.log(`[Reasoning] 可用工具:`, this.tools.map(t => `${t.serverName}.${t.name}`));
      
      // 验证工具名称不为空
      if (!toolName || toolName === 'undefined') {
        throw new Error(`工具名称无效: ${toolName}`);
      }
      
      const response = await this.mcpClient.callTool({
        tool: toolName,
        server: preferredServer,
        args: args,
      });

      console.log(`[Reasoning] 工具调用响应:`, response);
      return response;
    } catch (error) {
      console.error(`[Reasoning] 直接工具调用失败:`, error);
      return {
        result: {
          content: [{ type: 'text' as const, text: `工具调用失败: ${error instanceof Error ? error.message : error}` }],
          isError: true,
        },
        serverName: 'unknown',
        latency: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
