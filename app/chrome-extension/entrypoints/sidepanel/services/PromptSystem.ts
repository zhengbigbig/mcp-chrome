// 智能提示词系统 - 借鉴prompt目录中的最佳实践

import { SimpleTool } from '../utils/SimpleMCPHelper';

export interface ToolCall {
  tool: string;
  server?: string;
  args: any;
  reasoning: string;
  requiresConfirmation?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface TaskAnalysis {
  intent: string;
  complexity: 'simple' | 'medium' | 'complex';
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  toolCalls: ToolCall[];
  reasoning: string;
  confirmationRequired: boolean;
}

export class PromptSystem {
  private tools: SimpleTool[] = [];

  setAvailableTools(tools: SimpleTool[]) {
    this.tools = tools;
  }

  /**
   * 系统提示词 - 借鉴 prompt/modify-web.md 的角色定义
   */
  private getSystemPrompt(): string {
    return `# Role:
你是一名顶级的【浏览器自动化与任务执行专家】。

# Profile:
- **背景**: 超过10年的浏览器自动化经验，精通Chrome扩展开发、网页操作和任务分解。
- **核心原则**:
  1. **安全第一 (Security First)**: 绝不执行危险操作，避免数据泄露或系统损害。
  2. **用户确认 (User Confirmation)**: 对于敏感操作必须请求用户确认。
  3. **任务分解 (Task Decomposition)**: 将复杂任务分解为清晰的步骤序列。
  4. **智能选择 (Smart Selection)**: 根据用户意图选择最合适的工具组合。
  5. **错误预防 (Error Prevention)**: 预判可能的问题并提供备选方案。

# Available Tools:
${this.generateToolsDescription()}

# Workflow:
当用户提出任务请求时，你需要：

1. **【任务理解与分析】**
   - 理解用户的真实意图和最终目标
   - 识别任务的复杂度和风险级别
   - 分析需要哪些工具配合完成

2. **【安全评估与确认策略】**
   - 评估操作的安全风险等级
   - 确定哪些步骤需要用户确认
   - 设计安全的执行顺序

3. **【工具选择与参数设计】**
   - 选择最合适的工具组合
   - 设计每个工具的具体参数
   - 提供详细的执行推理

# Risk Assessment Guidelines:
- **Low Risk**: 查看、截图、获取信息等只读操作
- **Medium Risk**: 导航、填写表单、点击按钮等交互操作  
- **High Risk**: 删除、修改重要数据、执行脚本等危险操作

# Response Format:
回复必须是有效的JSON格式：
{
  "intent": "用户意图描述",
  "complexity": "simple|medium|complex",
  "category": "任务类别",
  "riskLevel": "low|medium|high", 
  "toolCalls": [
    {
      "tool": "工具名称",
      "server": "builtin",
      "args": {"参数名": "参数值"},
      "reasoning": "选择此工具的详细原因",
      "requiresConfirmation": true|false,
      "riskLevel": "low|medium|high"
    }
  ],
  "reasoning": "整体任务分析和执行策略",
  "confirmationRequired": true|false
}`;
  }

  /**
   * 生成工具描述 - 借鉴 prompt/excalidraw-prompt.md 的工具说明格式
   */
  private generateToolsDescription(): string {
    const categories = this.categorizeTools();
    
    let description = '';
    for (const [category, tools] of Object.entries(categories)) {
      description += `\n## ${category}\n`;
      tools.forEach(tool => {
        description += `- **${tool.name}**: ${tool.description}\n`;
      });
    }
    
    return description;
  }

  /**
   * 工具分类
   */
  private categorizeTools(): Record<string, SimpleTool[]> {
    const categories: Record<string, SimpleTool[]> = {
      '页面导航': [],
      '内容获取': [],
      '页面交互': [],
      '网络操作': [],
      '数据管理': [],
      '开发工具': [],
      '其他': []
    };

    this.tools.forEach(tool => {
      const name = tool.name.toLowerCase();
      if (name.includes('navigate') || name.includes('close') || name.includes('window') || name.includes('tab')) {
        categories['页面导航'].push(tool);
      } else if (name.includes('screenshot') || name.includes('content') || name.includes('element')) {
        categories['内容获取'].push(tool);
      } else if (name.includes('click') || name.includes('fill') || name.includes('keyboard')) {
        categories['页面交互'].push(tool);
      } else if (name.includes('network') || name.includes('request')) {
        categories['网络操作'].push(tool);
      } else if (name.includes('history') || name.includes('bookmark')) {
        categories['数据管理'].push(tool);
      } else if (name.includes('console') || name.includes('inject') || name.includes('debug')) {
        categories['开发工具'].push(tool);
      } else {
        categories['其他'].push(tool);
      }
    });

    // 移除空分类
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  /**
   * 分析用户输入并生成任务计划
   */
  async analyzeUserInput(userInput: string, ollamaEndpoint: string, model: string): Promise<TaskAnalysis> {
    const prompt = this.getSystemPrompt() + `

# User Request:
"${userInput}"

请分析上述用户请求，并按照指定的JSON格式回复。确保：
1. 准确理解用户意图
2. 选择合适的工具组合
3. 正确评估风险等级
4. 对于中高风险操作设置确认标志`;

    try {
      const response = await this.callOllama(prompt, ollamaEndpoint, model);
      
      // 尝试解析JSON响应
      let result: TaskAnalysis;
      try {
        result = JSON.parse(response);
      } catch (parseError) {
        console.warn('[PromptSystem] JSON解析失败，尝试修复:', parseError);
        // 尝试提取JSON部分
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析LLM响应为JSON格式');
        }
      }

      // 验证和修正结果
      return this.validateAndCorrectAnalysis(result, userInput);

    } catch (error) {
      console.error('[PromptSystem] LLM分析失败，使用后备策略:', error);
      return this.fallbackAnalysis(userInput);
    }
  }

  /**
   * 验证和修正分析结果
   */
  private validateAndCorrectAnalysis(result: any, userInput: string): TaskAnalysis {
    // 确保必需字段存在
    const analysis: TaskAnalysis = {
      intent: result.intent || '用户意图不明确',
      complexity: result.complexity || 'medium',
      category: result.category || '其他',
      riskLevel: result.riskLevel || 'medium',
      toolCalls: [],
      reasoning: result.reasoning || '基于关键词匹配的自动分析',
      confirmationRequired: false
    };

    // 验证工具调用
    if (result.toolCalls && Array.isArray(result.toolCalls)) {
      analysis.toolCalls = result.toolCalls.map((tc: any) => ({
        tool: tc.tool,
        server: tc.server || 'builtin',
        args: tc.args || {},
        reasoning: tc.reasoning || '自动选择',
        requiresConfirmation: tc.requiresConfirmation || false,
        riskLevel: tc.riskLevel || 'medium'
      })).filter((tc: ToolCall) => {
        // 验证工具是否存在
        return this.tools.some(tool => tool.name === tc.tool);
      });
    }

    // 确定是否需要用户确认
    analysis.confirmationRequired = result.confirmationRequired || 
      analysis.riskLevel === 'high' ||
      analysis.toolCalls.some(tc => tc.requiresConfirmation || tc.riskLevel === 'high');

    return analysis;
  }

  /**
   * 后备分析策略 - 基于关键词匹配
   */
  private fallbackAnalysis(userInput: string): TaskAnalysis {
    const input = userInput.toLowerCase();
    const toolCalls: ToolCall[] = [];

    // 截图相关
    if (input.includes('截图') || input.includes('screenshot')) {
      toolCalls.push({
        tool: 'chrome_screenshot',
        server: 'builtin',
        args: { 
          fullPage: input.includes('全页') || input.includes('完整'),
          storeBase64: true,
          savePng: false
        },
        reasoning: '检测到截图关键词',
        riskLevel: 'low'
      });
    }

    // 导航相关
    if (input.includes('打开') || input.includes('访问') || input.includes('导航')) {
      const urlMatch = input.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        toolCalls.push({
          tool: 'chrome_navigate',
          server: 'builtin',
          args: { url: urlMatch[0] },
          reasoning: '检测到URL导航请求',
          riskLevel: 'low'
        });
      }
    }

    // 获取内容
    if (input.includes('页面内容') || input.includes('文本') || input.includes('内容')) {
      toolCalls.push({
        tool: 'chrome_get_web_content',
        server: 'builtin',
        args: { textContent: true },
        reasoning: '检测到内容获取请求',
        riskLevel: 'low'
      });
    }

    // 获取标签页
    if (input.includes('标签页') || input.includes('窗口') || input.includes('tabs')) {
      toolCalls.push({
        tool: 'get_windows_and_tabs',
        server: 'builtin',
        args: {},
        reasoning: '检测到标签页查询请求',
        riskLevel: 'low'
      });
    }

    return {
      intent: '基于关键词匹配的意图识别',
      complexity: toolCalls.length > 1 ? 'medium' : 'simple',
      category: '浏览器操作',
      riskLevel: 'low',
      toolCalls,
      reasoning: '使用后备关键词匹配策略',
      confirmationRequired: false
    };
  }

  /**
   * 调用Ollama API
   */
  private async callOllama(prompt: string, endpoint: string, model: string): Promise<string> {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // 降低温度以获得更一致的输出
          top_p: 0.9,
          num_predict: 2048
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API调用失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * 生成任务执行的确认信息
   */
  generateConfirmationMessage(analysis: TaskAnalysis): string {
    const { intent, toolCalls, riskLevel } = analysis;
    
    let message = `🤖 **任务确认**\n\n`;
    message += `**意图**: ${intent}\n`;
    message += `**风险等级**: ${riskLevel === 'high' ? '🔴 高' : riskLevel === 'medium' ? '🟡 中' : '🟢 低'}\n\n`;
    
    message += `**将执行以下操作**:\n`;
    toolCalls.forEach((tc, index) => {
      const riskIcon = tc.riskLevel === 'high' ? '🔴' : tc.riskLevel === 'medium' ? '🟡' : '🟢';
      message += `${index + 1}. ${riskIcon} **${tc.tool}** - ${tc.reasoning}\n`;
      if (Object.keys(tc.args).length > 0) {
        message += `   参数: ${JSON.stringify(tc.args)}\n`;
      }
    });

    if (riskLevel === 'high') {
      message += `\n⚠️ **警告**: 此操作包含高风险步骤，请谨慎确认！`;
    }

    message += `\n\n是否继续执行？`;
    
    return message;
  }
}
