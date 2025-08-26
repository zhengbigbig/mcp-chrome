// 工具定义和执行控制
import { Tool } from './mcp-client';

export type ToolExecutionMode = 'parallel' | 'serial' | 'interactive';
export type ToolCategory = 'basic' | 'browser' | 'data' | 'system';

export interface EnhancedTool extends Tool {
  executionMode: ToolExecutionMode;
  category: ToolCategory;
  requiresConfirmation: boolean;
  dependencies?: string[]; // 依赖的其他工具
  conflictsWith?: string[]; // 与哪些工具冲突，不能并行执行
  priority: number; // 执行优先级 (1-10, 10最高)
  estimatedDuration?: number; // 预估执行时间（毫秒）
  userPrompt?: string; // 需要用户确认时的提示文本
}

export interface ToolExecutionPlan {
  phases: ToolExecutionPhase[];
  totalEstimatedTime: number;
  requiresUserInteraction: boolean;
}

export interface ToolExecutionPhase {
  id: string;
  name: string;
  tools: ToolCall[];
  executionMode: 'parallel' | 'serial';
  requiresUserConfirmation: boolean;
  dependencies: string[]; // 依赖的前置阶段
}

export interface ToolCall {
  tool: string;
  server?: string; // 指定的 server，可选
  args: any;
  reasoning: string;
  confirmationMessage?: string;
  phase?: string;
}

// 工具定义注册表
export class ToolRegistry {
  private tools: Map<string, EnhancedTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    // 基础工具
    this.registerTool({
      name: 'echo',
      description: '回显输入的文本',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要回显的文本' }
        },
        required: ['text']
      },
      executionMode: 'parallel',
      category: 'basic',
      requiresConfirmation: false,
      priority: 5,
      estimatedDuration: 100,
    });

    this.registerTool({
      name: 'calculate',
      description: '执行简单的数学计算',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: '数学表达式' }
        },
        required: ['expression']
      },
      executionMode: 'parallel',
      category: 'data',
      requiresConfirmation: false,
      priority: 7,
      estimatedDuration: 200,
    });

    this.registerTool({
      name: 'get_time',
      description: '获取当前时间',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      executionMode: 'parallel',
      category: 'system',
      requiresConfirmation: false,
      priority: 6,
      estimatedDuration: 50,
    });

    this.registerTool({
      name: 'get_page_info',
      description: '获取当前页面信息',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      executionMode: 'parallel',
      category: 'browser',
      requiresConfirmation: false,
      priority: 6,
      estimatedDuration: 300,
    });

    this.registerTool({
      name: 'scroll_page',
      description: '滚动页面（需要用户确认）',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { 
            type: 'string', 
            description: '滚动方向: up, down, top, bottom',
            enum: ['up', 'down', 'top', 'bottom']
          }
        },
        required: ['direction']
      },
      executionMode: 'interactive',
      category: 'browser',
      requiresConfirmation: true,
      priority: 4,
      estimatedDuration: 1000,
      userPrompt: '即将滚动页面，是否确认执行？',
      conflictsWith: ['get_page_info'], // 滚动时不能同时获取页面信息
    });

    // 高级交互工具示例
    this.registerTool({
      name: 'start_scroll_monitor',
      description: '开始监控页面滚动（交互式）',
      inputSchema: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: '监控时长（秒）' }
        }
      },
      executionMode: 'interactive',
      category: 'browser',
      requiresConfirmation: true,
      priority: 3,
      estimatedDuration: 5000,
      userPrompt: '即将开始监控页面滚动，此过程需要用户交互。是否继续？',
      dependencies: ['get_page_info'], // 需要先获取页面信息
    });

    this.registerTool({
      name: 'stop_scroll_monitor',
      description: '停止滚动监控',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      executionMode: 'serial',
      category: 'browser',
      requiresConfirmation: true,
      priority: 8,
      estimatedDuration: 500,
      userPrompt: '确认停止滚动监控？',
    });
  }

  registerTool(tool: EnhancedTool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): EnhancedTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): EnhancedTool[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: ToolCategory): EnhancedTool[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  getToolsByExecutionMode(mode: ToolExecutionMode): EnhancedTool[] {
    return this.getAllTools().filter(tool => tool.executionMode === mode);
  }

  // 检查工具之间的冲突
  hasConflicts(tool1: string, tool2: string): boolean {
    const t1 = this.getTool(tool1);
    const t2 = this.getTool(tool2);
    
    if (!t1 || !t2) return false;
    
    return (t1.conflictsWith?.includes(tool2)) || 
           (t2.conflictsWith?.includes(tool1)) || false;
  }

  // 检查工具依赖
  checkDependencies(toolName: string, availableTools: string[]): string[] {
    const tool = this.getTool(toolName);
    if (!tool || !tool.dependencies) return [];
    
    return tool.dependencies.filter(dep => !availableTools.includes(dep));
  }
}

// 执行计划生成器
export class ExecutionPlanner {
  constructor(private toolRegistry: ToolRegistry) {}

  // 生成工具执行计划
  generateExecutionPlan(toolCalls: ToolCall[]): ToolExecutionPlan {
    const phases: ToolExecutionPhase[] = [];
    const processedTools = new Set<string>();
    let phaseCounter = 0;

    // 1. 按依赖关系排序工具
    const sortedToolCalls = this.sortByDependencies(toolCalls);

    // 2. 分组工具到执行阶段
    while (processedTools.size < sortedToolCalls.length) {
      const currentPhase = this.createExecutionPhase(
        `phase_${phaseCounter++}`,
        sortedToolCalls,
        processedTools
      );
      
      if (currentPhase.tools.length > 0) {
        phases.push(currentPhase);
        currentPhase.tools.forEach(tc => processedTools.add(tc.tool));
      } else {
        break; // 防止无限循环
      }
    }

    // 3. 计算总预估时间
    const totalEstimatedTime = this.calculateTotalTime(phases);
    
    // 4. 检查是否需要用户交互
    const requiresUserInteraction = phases.some(phase => 
      phase.requiresUserConfirmation ||
      phase.tools.some(tc => {
        const tool = this.toolRegistry.getTool(tc.tool);
        return tool?.requiresConfirmation || false;
      })
    );

    return {
      phases,
      totalEstimatedTime,
      requiresUserInteraction,
    };
  }

  private sortByDependencies(toolCalls: ToolCall[]): ToolCall[] {
    const sorted: ToolCall[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (toolCall: ToolCall) => {
      if (visiting.has(toolCall.tool)) {
        throw new Error(`循环依赖检测到: ${toolCall.tool}`);
      }
      if (visited.has(toolCall.tool)) return;

      visiting.add(toolCall.tool);
      
      const tool = this.toolRegistry.getTool(toolCall.tool);
      if (tool?.dependencies) {
        for (const dep of tool.dependencies) {
          const depCall = toolCalls.find(tc => tc.tool === dep);
          if (depCall) {
            visit(depCall);
          }
        }
      }
      
      visiting.delete(toolCall.tool);
      visited.add(toolCall.tool);
      sorted.push(toolCall);
    };

    toolCalls.forEach(visit);
    return sorted;
  }

  private createExecutionPhase(
    phaseId: string, 
    allToolCalls: ToolCall[], 
    processedTools: Set<string>
  ): ToolExecutionPhase {
    const availableTools: ToolCall[] = [];
    const interactiveTools: ToolCall[] = [];
    const serialTools: ToolCall[] = [];

    // 筛选当前可以执行的工具
    for (const toolCall of allToolCalls) {
      if (processedTools.has(toolCall.tool)) continue;

      const tool = this.toolRegistry.getTool(toolCall.tool);
      if (!tool) continue;

      // 检查依赖是否满足
      const missingDeps = this.toolRegistry.checkDependencies(
        toolCall.tool, 
        Array.from(processedTools)
      );
      if (missingDeps.length > 0) continue;

      // 按执行模式分类
      switch (tool.executionMode) {
        case 'interactive':
          interactiveTools.push(toolCall);
          break;
        case 'serial':
          serialTools.push(toolCall);
          break;
        case 'parallel':
          availableTools.push(toolCall);
          break;
      }
    }

    // 确定阶段执行模式和工具
    let phaseTools: ToolCall[] = [];
    let executionMode: 'parallel' | 'serial' = 'parallel';
    let requiresUserConfirmation = false;

    if (interactiveTools.length > 0) {
      // 交互式工具优先，且只能串行执行
      phaseTools = [interactiveTools[0]];
      executionMode = 'serial';
      requiresUserConfirmation = true;
    } else if (serialTools.length > 0) {
      // 串行工具
      phaseTools = [serialTools[0]];
      executionMode = 'serial';
      const tool = this.toolRegistry.getTool(serialTools[0].tool);
      requiresUserConfirmation = tool?.requiresConfirmation || false;
    } else {
      // 并行工具，需要检查冲突
      phaseTools = this.resolveConflicts(availableTools);
      executionMode = 'parallel';
    }

    return {
      id: phaseId,
      name: `执行阶段 ${phaseId}`,
      tools: phaseTools,
      executionMode,
      requiresUserConfirmation,
      dependencies: [],
    };
  }

  private resolveConflicts(toolCalls: ToolCall[]): ToolCall[] {
    const result: ToolCall[] = [];
    const usedTools = new Set<string>();

    // 按优先级排序
    const sortedCalls = toolCalls.sort((a, b) => {
      const toolA = this.toolRegistry.getTool(a.tool);
      const toolB = this.toolRegistry.getTool(b.tool);
      return (toolB?.priority || 0) - (toolA?.priority || 0);
    });

    for (const toolCall of sortedCalls) {
      const hasConflict = Array.from(usedTools).some(usedTool => 
        this.toolRegistry.hasConflicts(toolCall.tool, usedTool)
      );

      if (!hasConflict) {
        result.push(toolCall);
        usedTools.add(toolCall.tool);
      }
    }

    return result;
  }

  private calculateTotalTime(phases: ToolExecutionPhase[]): number {
    return phases.reduce((total, phase) => {
      if (phase.executionMode === 'parallel') {
        // 并行执行：取最长时间
        const maxTime = Math.max(...phase.tools.map(tc => {
          const tool = this.toolRegistry.getTool(tc.tool);
          return tool?.estimatedDuration || 1000;
        }));
        return total + maxTime;
      } else {
        // 串行执行：累加时间
        const serialTime = phase.tools.reduce((sum, tc) => {
          const tool = this.toolRegistry.getTool(tc.tool);
          return sum + (tool?.estimatedDuration || 1000);
        }, 0);
        return total + serialTime;
      }
    }, 0);
  }
}


