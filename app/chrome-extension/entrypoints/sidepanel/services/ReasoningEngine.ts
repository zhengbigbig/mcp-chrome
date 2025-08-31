// Chrome Extension Reasoning Engine - adapted from mcp-browser-extension
import { ChromeMCPClient } from '../../../utils/mcp/mcp-client';
import { MultiMCPClient } from '../../../utils/mcp/multi-mcp-client';
import { ServerRegistry, ServerConfig } from '../../../utils/mcp/server-registry';
import { UserInteractionManager, UserInteraction, InteractionResult } from '../../../utils/mcp/user-interaction';
import { ToolCall, ExecutionPlanner, ToolExecutionPlan } from '../../../utils/mcp/tool-definitions';

export interface ReasoningStepType {
  type: 'thinking' | 'tool_selection' | 'tool_execution' | 'user_interaction' | 'synthesis';
  content: string;
  data?: any;
}

export interface ReasoningResult {
  steps: ReasoningStepType[];
  response: string;
  toolCalls: ToolCall[];
  success: boolean;
  error?: string;
}

/**
 * Chrome Extension Reasoning Engine
 * Provides intelligent tool selection and execution with LLM reasoning
 */
export class ChromeReasoningEngine {
  private mcpClient: MultiMCPClient;
  private serverRegistry: ServerRegistry;
  private userInteractionManager: UserInteractionManager;
  private executionPlanner: ExecutionPlanner;
  private tools: any[] = [];
  private ollamaEndpoint: string = 'http://localhost:11434';
  private defaultModel: string = 'llama3.2:3b';
  private currentExecutionPlan: ToolExecutionPlan | null = null;
  private isExecuting: boolean = false;

  constructor() {
    // Initialize components
    this.serverRegistry = new ServerRegistry();
    this.mcpClient = new MultiMCPClient(this.serverRegistry);
    this.userInteractionManager = new UserInteractionManager();
    this.executionPlanner = new ExecutionPlanner();

    this.initialize();
  }

  private async initialize() {
    try {
      // Load settings
      await this.loadSettings();
      
      // Add builtin server
      await this.addBuiltinServer();
      
      // Load tools
      await this.loadTools();
      
      console.log('[ReasoningEngine] 初始化完成');
    } catch (error) {
      console.error('[ReasoningEngine] 初始化失败:', error);
    }
  }

  private async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('extensionSettings');
      if (result.extensionSettings) {
        this.ollamaEndpoint = result.extensionSettings.ollamaEndpoint || 'http://localhost:11434';
        this.defaultModel = result.extensionSettings.defaultModel || 'llama3.2:3b';
      }
    } catch (error) {
      console.error('[ReasoningEngine] 加载设置失败:', error);
    }
  }

  private async addBuiltinServer() {
    // Add builtin server
    const builtinConfig: ServerConfig = {
      name: 'builtin',
      displayName: '内置服务器',
      type: 'builtin',
      priority: 1
    };
    
    await this.serverRegistry.addServer(builtinConfig, new ChromeMCPClient());
  }

  private async loadTools() {
    try {
      this.tools = this.mcpClient.getAllTools();
      console.log(`[ReasoningEngine] 已加载 ${this.tools.length} 个工具`);
    } catch (error) {
      console.error('[ReasoningEngine] 加载工具失败:', error);
    }
  }

  /**
   * Main reasoning method - analyzes user input and executes appropriate tools
   */
  async reason(userInput: string): Promise<ReasoningResult> {
    console.log(`[ReasoningEngine] 开始推理: ${userInput}`);
    
    const steps: ReasoningStepType[] = [];
    
    try {
      this.isExecuting = true;

      // Step 1: Thinking
      steps.push({
        type: 'thinking',
        content: '分析用户输入，理解意图...'
      });

      // Step 2: Tool Selection
      steps.push({
        type: 'tool_selection',
        content: '智能选择合适的工具...'
      });

      const toolCalls = await this.selectToolsWithLLM(userInput);
      
      if (toolCalls.length === 0) {
        return {
          steps,
          response: '抱歉，我无法理解您的请求或找到合适的工具来处理。请尝试更具体的描述。',
          toolCalls: [],
          success: false
        };
      }

      // Step 3: Create execution plan
      this.currentExecutionPlan = this.executionPlanner.createExecutionPlan(toolCalls);
      
      steps.push({
        type: 'tool_execution',
        content: `准备执行 ${toolCalls.length} 个工具...`,
        data: { plan: this.currentExecutionPlan }
      });

      // Step 4: Execute tools
      const executionResults = await this.executeExecutionPlan(this.currentExecutionPlan);
      
      // Step 5: Synthesis
      steps.push({
        type: 'synthesis',
        content: '整合工具执行结果，生成回复...'
      });

      const response = await this.synthesizeResponse(userInput, executionResults);

      return {
        steps,
        response,
        toolCalls,
        success: true
      };

    } catch (error) {
      console.error('[ReasoningEngine] 推理失败:', error);
      
      return {
        steps,
        response: `推理执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        toolCalls: [],
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    } finally {
      this.isExecuting = false;
      this.currentExecutionPlan = null;
    }
  }

  private async selectToolsWithLLM(userInput: string): Promise<ToolCall[]> {
    try {
      // Get available tools description
      const toolsDescription = this.tools.map(tool => 
        `${tool.serverName}.${tool.name}: ${tool.description || '无描述'}`
      ).join('\n');

      const prompt = `
你是一个智能浏览器助手，可以调用各种工具来帮助用户完成浏览器相关的任务。

可用工具列表：
${toolsDescription}

用户请求: "${userInput}"

请分析用户意图并选择合适的工具。回复格式为JSON：
{
  "needsTools": boolean,
  "reasoning": "分析推理过程",
  "toolCalls": [
    {
      "tool": "工具名称",
      "server": "服务器名称（可选）",
      "args": {"参数": "值"},
      "reasoning": "为什么选择这个工具"
    }
  ]
}
`;

      const response = await this.callOllama(prompt);
      const result = JSON.parse(response);
      
      if (result.needsTools && result.toolCalls) {
        return result.toolCalls.map((tc: any) => ({
          tool: tc.tool,
          server: tc.server,
          args: tc.args || {},
          reasoning: tc.reasoning || '自动选择'
        }));
      }
      
      return [];
    } catch (error) {
      console.error('[ReasoningEngine] LLM 工具选择失败，回退到关键词匹配:', error);
      return this.fallbackToolSelection(userInput);
    }
  }

  private fallbackToolSelection(userInput: string): ToolCall[] {
    const input = userInput.toLowerCase();
    const toolCalls: ToolCall[] = [];

    // Simple keyword matching for fallback
    if (input.includes('截图') || input.includes('screenshot')) {
      toolCalls.push({
        tool: 'browser_screenshot',
        server: 'builtin',
        args: { fullPage: input.includes('全页') },
        reasoning: '检测到截图关键词'
      });
    }

    if (input.includes('打开') || input.includes('访问') || input.includes('导航')) {
      const urlMatch = input.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        toolCalls.push({
          tool: 'browser_navigate',
          server: 'builtin',
          args: { url: urlMatch[0] },
          reasoning: '检测到URL导航请求'
        });
      }
    }

    if (input.includes('页面内容') || input.includes('文本')) {
      toolCalls.push({
        tool: 'browser_web_fetcher',
        server: 'builtin',
        args: { textContent: true },
        reasoning: '检测到页面内容请求'
      });
    }

    return toolCalls;
  }

  private async executeExecutionPlan(plan: ToolExecutionPlan): Promise<any[]> {
    const results: any[] = [];

    for (const phase of plan.phases) {
      console.log(`[ReasoningEngine] 执行阶段: ${phase.name}`);
      
      // Execute tools in this phase
      const phaseResults = await Promise.all(
        phase.tools.map(async (toolCall) => {
          try {
            const response = await this.mcpClient.callTool({
              tool: toolCall.tool,
              server: toolCall.server,
              args: toolCall.args
            });
            
            return {
              call: toolCall,
              result: response.result,
              success: response.success
            };
          } catch (error) {
            return {
              call: toolCall,
              result: { error: error instanceof Error ? error.message : '执行失败' },
              success: false
            };
          }
        })
      );

      results.push(...phaseResults);
    }

    return results;
  }

  private async synthesizeResponse(userInput: string, toolResults: any[]): Promise<string> {
    try {
      const resultsText = toolResults.map(r => 
        `工具 ${r.call.tool}: ${r.success ? '成功' : '失败'} - ${JSON.stringify(r.result)}`
      ).join('\n');

      const prompt = `
用户请求: "${userInput}"

工具执行结果:
${resultsText}

请基于工具执行结果生成一个友好、有用的回复给用户。回复应该：
1. 总结执行的操作
2. 提供相关的结果信息
3. 如果有失败，说明原因
4. 用自然、友好的语言

请直接回复内容，不要JSON格式：
`;

      return await this.callOllama(prompt);
    } catch (error) {
      console.error('[ReasoningEngine] 结果合成失败:', error);
      
      // Fallback to simple result summary
      const successCount = toolResults.filter(r => r.success).length;
      return `执行了 ${toolResults.length} 个工具，其中 ${successCount} 个成功。${successCount === toolResults.length ? '所有操作都已完成。' : '部分操作可能失败，请检查具体结果。'}`;
    }
  }

  private async callOllama(prompt: string): Promise<string> {
    const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        prompt: prompt,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama 调用失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  // Public methods for UI integration
  setInteractionHandler(handler: (interaction: UserInteraction) => Promise<InteractionResult>) {
    this.userInteractionManager.setInteractionHandler(handler);
  }

  getCurrentExecutionPlan(): ToolExecutionPlan | null {
    return this.currentExecutionPlan;
  }

  isCurrentlyExecuting(): boolean {
    return this.isExecuting;
  }

  getAvailableTools() {
    return this.tools;
  }

  async addServer(config: ServerConfig) {
    // This would need to be implemented based on server type
    console.log('[ReasoningEngine] 添加服务器功能待实现:', config);
  }

  async removeServer(serverName: string) {
    await this.serverRegistry.removeServer(serverName);
    await this.loadTools();
  }

  getAllServers() {
    return this.serverRegistry.getAllServers();
  }
}

// Export singleton instance
export const reasoningEngine = new ChromeReasoningEngine();
