// 增强的推理引擎 - 集成智能提示词系统和用户确认机制

import { PromptSystem, TaskAnalysis, ToolCall } from './PromptSystem';
import { SimpleMCPHelper, SimpleTool, ToolCallResult } from '../utils/SimpleMCPHelper';
import { UserInteraction, InteractionResult } from '../../../utils/mcp/user-interaction';

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
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
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
  private ollamaEndpoint: string = 'http://localhost:11434';
  private defaultModel: string = 'deepseek-r1:1.5b';
  private interactionHandler?: (interaction: UserInteraction) => Promise<InteractionResult>;
  private isExecuting: boolean = false;
  private currentContext?: ExecutionContext;

  constructor() {
    this.promptSystem = new PromptSystem();
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
  }

  /**
   * 主推理方法 - 分析用户输入并执行任务
   */
  async reason(userInput: string): Promise<ReasoningResult> {
    console.log(`[EnhancedReasoningEngine] 开始推理: ${userInput}`);
    
    const steps: ReasoningStepType[] = [];
    
    try {
      this.isExecuting = true;

      // Step 1: 获取可用工具
      const tools = await SimpleMCPHelper.getAvailableTools();
      this.promptSystem.setAvailableTools(tools);

      // Step 2: 智能分析用户输入
      steps.push({
        type: 'thinking',
        content: '🤔 正在分析您的需求，理解任务意图...'
      });

      const analysis = await this.promptSystem.analyzeUserInput(
        userInput, 
        this.ollamaEndpoint, 
        this.defaultModel
      );

      steps.push({
        type: 'tool_selection',
        content: `✅ 任务分析完成！
        
**意图**: ${analysis.intent}
**复杂度**: ${analysis.complexity}
**风险等级**: ${analysis.riskLevel}
**工具数量**: ${analysis.toolCalls.length}个

${analysis.reasoning}`,
        data: analysis
      });

      // Step 3: 检查是否需要用户确认
      if (analysis.confirmationRequired) {
        const confirmationMessage = this.promptSystem.generateConfirmationMessage(analysis);
        
        steps.push({
          type: 'user_interaction',
          content: '⏳ 等待用户确认操作...'
        });

        return {
          steps,
          response: '任务已分析完成，需要您的确认',
          toolCalls: analysis.toolCalls,
          success: false,
          requiresConfirmation: true,
          confirmationMessage
        };
      }

      // Step 4: 直接执行（低风险任务）
      return await this.executeTaskPlan(analysis, steps);

    } catch (error) {
      console.error('[EnhancedReasoningEngine] 推理失败:', error);
      
      steps.push({
        type: 'synthesis',
        content: `❌ 推理失败: ${error instanceof Error ? error.message : '未知错误'}`
      });

      return {
        steps,
        response: '抱歉，处理您的请求时出现了错误。请尝试重新描述您的需求。',
        toolCalls: [],
        success: false
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 执行已确认的任务计划
   */
  async executeConfirmedTask(analysis: TaskAnalysis): Promise<ReasoningResult> {
    console.log('[EnhancedReasoningEngine] 执行已确认的任务');

    const steps: ReasoningStepType[] = [{
      type: 'user_interaction',
      content: '✅ 用户已确认，开始执行任务...'
    }];

    try {
      this.isExecuting = true;
      return await this.executeTaskPlan(analysis, steps);
    } catch (error) {
      console.error('[EnhancedReasoningEngine] 执行确认任务失败:', error);
      
      steps.push({
        type: 'synthesis',
        content: `❌ 执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      });

      return {
        steps,
        response: '任务执行过程中出现错误，请检查具体步骤。',
        toolCalls: analysis.toolCalls,
        success: false
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 执行任务计划
   */
  private async executeTaskPlan(analysis: TaskAnalysis, steps: ReasoningStepType[]): Promise<ReasoningResult> {
    const { toolCalls } = analysis;
    const results: ToolCallResult[] = [];

    // 创建执行上下文
    this.currentContext = {
      userInput: analysis.intent,
      analysis,
      executionPlan: toolCalls,
      results,
      currentStep: 0
    };

    // Step: 开始执行工具
    steps.push({
      type: 'tool_execution',
      content: `🔧 开始执行 ${toolCalls.length} 个工具...`
    });

    // 逐个执行工具
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      this.currentContext.currentStep = i;

      console.log(`[EnhancedReasoningEngine] 执行工具 ${i + 1}/${toolCalls.length}: ${toolCall.tool}`);

      try {
        // 检查是否需要额外确认（针对中风险操作）
        if (toolCall.requiresConfirmation && this.interactionHandler) {
          const interaction: UserInteraction = {
            id: `confirm_${Date.now()}`,
            type: 'confirmation',
            message: `即将执行: ${toolCall.tool}\n原因: ${toolCall.reasoning}\n是否继续？`,
            options: ['确认', '跳过', '取消'],
            data: { toolCall }
          };

          const interactionResult = await this.interactionHandler(interaction);
          
          if (!interactionResult.confirmed) {
            steps.push({
              type: 'user_interaction',
              content: `⏭️ 用户选择跳过工具: ${toolCall.tool}`
            });
            continue;
          }
        }

        // 执行工具
        const result = await SimpleMCPHelper.callTool(toolCall.tool, toolCall.args);
        results.push(result);

        steps.push({
          type: 'tool_execution',
          content: `${result.success ? '✅' : '❌'} ${toolCall.tool}: ${result.success ? '执行成功' : result.error}`,
          data: { toolCall, result }
        });

        // 如果是关键工具失败，考虑是否继续
        if (!result.success && toolCall.riskLevel === 'high') {
          console.warn(`[EnhancedReasoningEngine] 关键工具失败: ${toolCall.tool}`);
          break;
        }

      } catch (error) {
        console.error(`[EnhancedReasoningEngine] 工具执行异常: ${toolCall.tool}`, error);
        
        const errorResult: ToolCallResult = {
          success: false,
          content: '',
          error: error instanceof Error ? error.message : '执行异常'
        };
        results.push(errorResult);

        steps.push({
          type: 'tool_execution',
          content: `❌ ${toolCall.tool}: 执行异常 - ${errorResult.error}`,
          data: { toolCall, result: errorResult }
        });
      }
    }

    // Step: 结果合成
    steps.push({
      type: 'synthesis',
      content: '📋 正在整理执行结果...'
    });

    const response = await this.synthesizeResults(results, toolCalls, analysis);
    
    steps.push({
      type: 'synthesis',
      content: '✨ 任务执行完成！'
    });

    const successCount = results.filter(r => r.success).length;
    const overallSuccess = successCount > 0 && successCount >= Math.ceil(toolCalls.length * 0.6); // 60%成功率阈值

    return {
      steps,
      response,
      toolCalls,
      success: overallSuccess
    };
  }

  /**
   * 合成执行结果 - 借鉴prompt中的结果整理思路
   */
  private async synthesizeResults(
    results: ToolCallResult[], 
    toolCalls: ToolCall[], 
    analysis: TaskAnalysis
  ): Promise<string> {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    // 简单情况：只有一个工具
    if (totalCount === 1) {
      const result = results[0];
      const toolCall = toolCalls[0];
      
      if (result.success) {
        return `✅ ${toolCall.reasoning}\n\n**结果**:\n${result.content}`;
      } else {
        return `❌ 执行失败: ${result.error}`;
      }
    }

    // 复杂情况：多个工具，使用LLM合成结果
    try {
      const prompt = `请根据以下信息生成一个简洁、清晰的任务执行总结：

**用户意图**: ${analysis.intent}
**执行情况**: ${successCount}/${totalCount} 个工具成功执行

**详细结果**:
${results.map((result, index) => {
  const toolCall = toolCalls[index];
  return `${index + 1}. **${toolCall.tool}** (${toolCall.reasoning})
   状态: ${result.success ? '✅ 成功' : '❌ 失败'}
   ${result.success ? `结果: ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}` : `错误: ${result.error}`}`;
}).join('\n\n')}

请生成一个用户友好的总结，包括：
1. 整体执行状况
2. 主要完成的任务
3. 如有失败，简要说明原因
4. 给用户的下一步建议（如果需要）

请用自然、友好的语言回复，不要使用JSON格式：`;

      const response = await this.callOllama(prompt);
      return response;

    } catch (error) {
      console.error('[EnhancedReasoningEngine] 结果合成失败:', error);
      
      // 后备合成策略
      let summary = `📊 **执行总结**\n\n`;
      summary += `✅ 成功: ${successCount} 个\n`;
      summary += `❌ 失败: ${totalCount - successCount} 个\n\n`;
      
      if (successCount === totalCount) {
        summary += `🎉 所有任务都已成功完成！`;
      } else if (successCount > 0) {
        summary += `⚠️ 部分任务完成，请检查失败的操作是否需要重试。`;
      } else {
        summary += `💥 所有任务都失败了，请检查网络连接和页面状态。`;
      }

      return summary;
    }
  }

  /**
   * 调用Ollama生成响应
   */
  private async callOllama(prompt: string): Promise<string> {
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
          num_predict: 1024
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API调用失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '无法生成响应';
  }

  /**
   * 获取可用工具
   */
  async getAvailableTools(): Promise<SimpleTool[]> {
    return await SimpleMCPHelper.getAvailableTools();
  }

  /**
   * 检查是否正在执行
   */
  isCurrentlyExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * 获取当前执行上下文
   */
  getCurrentContext(): ExecutionContext | undefined {
    return this.currentContext;
  }

  /**
   * 取消当前执行
   */
  cancelExecution(): void {
    this.isExecuting = false;
    this.currentContext = undefined;
  }
}
