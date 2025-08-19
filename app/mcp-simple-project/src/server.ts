#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * 简单的 MCP Server 实现
 * 提供基本的工具功能，可以与 MCP Client 进行交互
 */
class SimpleMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'simple-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  /**
   * 设置工具处理器
   */
  private setupToolHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'echo',
            description: '回显输入的文本',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: '要回显的文本',
                },
              },
              required: ['text'],
            },
          } as Tool,
          {
            name: 'calculate',
            description: '执行简单的数学计算',
            inputSchema: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: '数学表达式，例如: "2 + 3 * 4"',
                },
              },
              required: ['expression'],
            },
          } as Tool,
          {
            name: 'get_time',
            description: '获取当前时间',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          } as Tool,
        ],
      };
    });

    // 调用工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'echo':
            return {
              content: [
                {
                  type: 'text',
                  text: `回显: ${args?.text || ''}`,
                },
              ],
            };

          case 'calculate':
            const expression = args?.expression as string;
            if (!expression) {
              throw new Error('缺少表达式参数');
            }
            
            // 简单的数学表达式计算（仅支持基本运算）
            const result = this.safeEval(expression);
            return {
              content: [
                {
                  type: 'text',
                  text: `计算结果: ${expression} = ${result}`,
                },
              ],
            };

          case 'get_time':
            const now = new Date();
            return {
              content: [
                {
                  type: 'text',
                  text: `当前时间: ${now.toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                  })}`,
                },
              ],
            };

          default:
            throw new Error(`未知工具: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * 安全的数学表达式计算
   */
  private safeEval(expression: string): number {
    // 只允许数字、基本运算符和空格
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
    if (sanitized !== expression) {
      throw new Error('表达式包含不允许的字符');
    }

    try {
      // 使用 Function 构造函数进行安全计算
      const result = new Function('return ' + sanitized)();
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('计算结果无效');
      }
      return result;
    } catch (error) {
      throw new Error('表达式计算失败');
    }
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Simple MCP Server 已启动，等待连接...');
  }
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  const server = new SimpleMCPServer();
  server.start().catch((error) => {
    console.error('启动服务器失败:', error);
    process.exit(1);
  });
}

export { SimpleMCPServer };
