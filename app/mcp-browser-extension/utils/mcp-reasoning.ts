// MCP 智能推理系统 - 类似 Cursor 的实现
// 自动选择工具并结合大模型进行推理

interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

interface ToolCall {
  tool: string;
  args: any;
  reasoning: string;
}

interface ReasoningResult {
  toolCalls: ToolCall[];
  finalResponse: string;
  confidence: number;
}

export class MCPReasoningEngine {
  private tools: Tool[] = [];
  private ollamaBaseUrl: string = 'http://localhost:11434';
  private ollamaModel: string = 'deepseek-r1:1.5b';

  constructor() {
    this.loadTools();
  }

  // 加载可用工具
  private async loadTools() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'MCP_LIST_TOOLS' });
      if (response.success) {
        this.tools = response.tools;
        console.log('[Reasoning] 已加载工具:', this.tools);
      }
    } catch (error) {
      console.error('[Reasoning] 加载工具失败:', error);
    }
  }

  // 智能推理主函数
  async reason(userInput: string): Promise<ReasoningResult> {
    console.log('[Reasoning] 开始推理:', userInput);

    try {
      // 第一步：分析用户意图并选择工具
      const toolAnalysis = await this.analyzeAndSelectTools(userInput);
      console.log('[Reasoning] 工具分析结果:', toolAnalysis);

      // 第二步：执行选中的工具
      const toolResults = await this.executeTools(toolAnalysis.toolCalls);
      console.log('[Reasoning] 工具执行结果:', toolResults);

      // 第三步：将工具结果交给大模型进行最终推理
      const finalResponse = await this.synthesizeResponse(userInput, toolResults);
      console.log('[Reasoning] 最终响应:', finalResponse);

      return {
        toolCalls: toolAnalysis.toolCalls,
        finalResponse,
        confidence: toolAnalysis.confidence,
      };
    } catch (error) {
      console.error('[Reasoning] 推理失败:', error);
      return {
        toolCalls: [],
        finalResponse: `推理过程中出现错误: ${error instanceof Error ? error.message : error}`,
        confidence: 0,
      };
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
      return this.fallbackToolSelection(userInput);
    }
  }

  // 降级工具选择（基于关键词匹配）
  private fallbackToolSelection(userInput: string): { toolCalls: ToolCall[]; confidence: number } {
    const lowerInput = userInput.toLowerCase();
    const toolCalls: ToolCall[] = [];

    // 简单的关键词匹配
    if (lowerInput.includes('回显') || lowerInput.includes('echo')) {
      const text = userInput.replace(/.*?回显|.*?echo/i, '').trim();
      toolCalls.push({
        tool: 'echo',
        args: { text },
        reasoning: '检测到回显关键词',
      });
    }

    if (lowerInput.includes('计算') || lowerInput.includes('算')) {
      const mathRegex = /[\d+\-*/.() ]+/;
      const match = userInput.match(mathRegex);
      if (match) {
        toolCalls.push({
          tool: 'calculate',
          args: { expression: match[0].trim() },
          reasoning: '检测到数学表达式',
        });
      }
    }

    if (lowerInput.includes('时间') || lowerInput.includes('现在几点')) {
      toolCalls.push({
        tool: 'get_time',
        args: {},
        reasoning: '检测到时间查询',
      });
    }

    if (lowerInput.includes('页面') || lowerInput.includes('网页') || lowerInput.includes('page')) {
      toolCalls.push({
        tool: 'get_page_info',
        args: {},
        reasoning: '检测到页面信息查询',
      });
    }

    if (lowerInput.includes('滚动') || lowerInput.includes('scroll')) {
      const direction = lowerInput.includes('上') || lowerInput.includes('up') ? 'up' :
                      lowerInput.includes('下') || lowerInput.includes('down') ? 'down' :
                      lowerInput.includes('顶部') || lowerInput.includes('top') ? 'top' :
                      lowerInput.includes('底部') || lowerInput.includes('bottom') ? 'bottom' : 'down';
      toolCalls.push({
        tool: 'scroll_page',
        args: { direction },
        reasoning: '检测到页面滚动请求',
      });
    }

    return {
      toolCalls,
      confidence: toolCalls.length > 0 ? 0.7 : 0.1,
    };
  }

  // 执行选中的工具
  private async executeTools(toolCalls: ToolCall[]): Promise<Array<{ call: ToolCall; result: any; success: boolean }>> {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        console.log('[Reasoning] 执行工具:', toolCall);
        const response = await chrome.runtime.sendMessage({
          type: 'MCP_CALL_TOOL',
          name: toolCall.tool,
          args: toolCall.args,
        });

        results.push({
          call: toolCall,
          result: response.success ? response.result : { error: response.error },
          success: response.success,
        });
      } catch (error) {
        results.push({
          call: toolCall,
          result: { error: error instanceof Error ? error.message : '工具执行失败' },
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
}
