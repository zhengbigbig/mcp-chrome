// 简化的MCP助手，直接与background的Internal MCP Server通信

export interface SimpleTool {
  name: string;
  description: string;
  serverName: string;
}

export interface ToolCallResult {
  success: boolean;
  content: string;
  error?: string;
}

export class SimpleMCPHelper {
  
  /**
   * 获取所有可用工具
   */
  static async getAvailableTools(): Promise<SimpleTool[]> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'MCP_LIST_TOOLS' });
      
      if (response?.success && response.tools) {
        return response.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || '浏览器自动化工具',
          serverName: 'builtin'
        }));
      }
      
      throw new Error(response?.error || '获取工具列表失败');
    } catch (error) {
      console.error('[SimpleMCPHelper] 获取工具列表失败:', error);
      return [];
    }
  }

  /**
   * 调用工具
   */
  static async callTool(name: string, args: any = {}): Promise<ToolCallResult> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MCP_CALL_TOOL',
        payload: { name, args }
      });

      if (response?.success) {
        return {
          success: true,
          content: typeof response.result === 'string' 
            ? response.result 
            : JSON.stringify(response.result, null, 2)
        };
      }

      return {
        success: false,
        content: '',
        error: response?.error || '工具调用失败'
      };
    } catch (error) {
      console.error(`[SimpleMCPHelper] 调用工具失败: ${name}`, error);
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 批量调用工具
   */
  static async callMultipleTools(toolCalls: Array<{name: string, args: any}>): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];
    
    for (const { name, args } of toolCalls) {
      const result = await this.callTool(name, args);
      results.push(result);
    }
    
    return results;
  }
}
