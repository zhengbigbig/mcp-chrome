#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import axios from 'axios';

/**
 * Ollama 客户端，用于与 deepseek-r1:1.5b 模型交互
 */
class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'deepseek-r1:1.5b') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查模型是否可用
   */
  async checkModel(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      const models = response.data.models || [];
      return models.some((model: any) => model.name === this.model);
    } catch (error) {
      return false;
    }
  }

  /**
   * 与模型聊天
   */
  async chat(message: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: message,
        stream: false,
      });

      return response.data.response || '模型没有返回响应';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Ollama API 错误: ${error.message}`);
      }
      throw new Error(`未知错误: ${error}`);
    }
  }

  /**
   * 流式聊天
   */
  async chatStream(message: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: message,
        stream: true,
      }, {
        responseType: 'stream',
      });

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              onChunk(data.response);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Ollama API 错误: ${error.message}`);
      }
      throw new Error(`未知错误: ${error}`);
    }
  }
}

/**
 * MCP Client 实现
 * 连接到 MCP Server 并与 Ollama 模型集成
 */
class SimpleMCPClient {
  private client: Client;
  private ollama: OllamaClient;
  private transport: StdioClientTransport | null = null;

  constructor(ollamaBaseUrl?: string, ollamaModel?: string) {
    this.client = new Client(
      {
        name: 'simple-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
    this.ollama = new OllamaClient(ollamaBaseUrl, ollamaModel);
  }

  /**
   * 连接到 MCP Server
   */
  async connectToServer(serverCommand: string[]): Promise<void> {
    this.transport = new StdioClientTransport({
      command: serverCommand[0],
      args: serverCommand.slice(1),
    });

    await this.client.connect(this.transport);
    console.log('已连接到 MCP Server');
  }

  /**
   * 获取可用工具列表
   */
  async getAvailableTools(): Promise<any[]> {
    const response = await this.client.request(
      { method: 'tools/list' },
      ListToolsRequestSchema
    );
    return (response as any).tools || [];
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(name: string, args: any = {}): Promise<string> {
    try {
      const response = await this.client.request(
        { method: 'tools/call', params: { name, arguments: args } },
        CallToolRequestSchema
      );

      const result = response as any;
      if (result.content && result.content.length > 0) {
        return result.content[0].text || '工具执行完成，但没有返回内容';
      }

      return '工具执行完成';
    } catch (error) {
      throw new Error(`调用工具失败: ${error}`);
    }
  }

  /**
   * 智能处理用户输入
   * 结合 MCP 工具和 Ollama 模型
   */
  async processUserInput(input: string): Promise<string> {
    try {
      // 检查是否需要使用工具
      const toolResult = await this.tryUseTools(input);
      if (toolResult) {
        return toolResult;
      }

      // 使用 Ollama 模型处理
      return await this.ollama.chat(input);
    } catch (error) {
      return `处理输入时出错: ${error instanceof Error ? error.message : error}`;
    }
  }

  /**
   * 尝试使用工具处理输入
   */
  private async tryUseTools(input: string): Promise<string | null> {
    const lowerInput = input.toLowerCase();

    // 简单的关键词匹配来决定使用哪个工具
    if (lowerInput.includes('回显') || lowerInput.includes('echo')) {
      const text = input.replace(/.*?回显|.*?echo/i, '').trim();
      return await this.callTool('echo', { text });
    }

    if (lowerInput.includes('计算') || lowerInput.includes('算')) {
      // 提取数学表达式
      const mathRegex = /[\d+\-*/.() ]+/;
      const match = input.match(mathRegex);
      if (match) {
        return await this.callTool('calculate', { expression: match[0].trim() });
      }
    }

    if (lowerInput.includes('时间') || lowerInput.includes('现在几点')) {
      return await this.callTool('get_time');
    }

    return null;
  }

  /**
   * 启动交互式会话
   */
  async startInteractiveSession(): Promise<void> {
    console.log('🤖 简单 MCP Client 已启动！');
    console.log('💡 你可以：');
    console.log('   - 让我回显文本：回显 你好世界');
    console.log('   - 进行数学计算：计算 2 + 3 * 4');
    console.log('   - 查看当前时间：现在几点');
    console.log('   - 或者直接与 deepseek-r1:1.5b 聊天');
    console.log('   - 输入 "quit" 退出');
    console.log('');

    // 检查 Ollama 服务状态
    const isOllamaHealthy = await this.ollama.checkHealth();
    if (!isOllamaHealthy) {
      console.log('⚠️  警告: Ollama 服务不可用，将只能使用 MCP 工具功能');
    } else {
      const hasModel = await this.ollama.checkModel();
      if (!hasModel) {
        console.log('⚠️  警告: deepseek-r1:1.5b 模型不可用，请确保已安装该模型');
      } else {
        console.log('✅ Ollama deepseek-r1:1.5b 模型已就绪');
      }
    }

    // 获取可用工具
    try {
      const tools = await this.getAvailableTools();
      console.log(`✅ MCP Server 工具已就绪 (${tools.length} 个工具)`);
    } catch (error) {
      console.log('⚠️  警告: 无法连接到 MCP Server');
    }

    console.log('');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = (): Promise<string> => {
      return new Promise((resolve) => {
        rl.question('你: ', resolve);
      });
    };

    while (true) {
      try {
        const input = await askQuestion();

        if (input.toLowerCase().trim() === 'quit') {
          console.log('再见！');
          break;
        }

        if (input.trim() === '') {
          continue;
        }

        console.log('🤔 处理中...');
        const response = await this.processUserInput(input);
        console.log(`🤖 ${response}`);
        console.log('');
      } catch (error) {
        console.error('❌ 处理输入时出错:', error);
        console.log('');
      }
    }

    rl.close();
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.client.close();
      console.log('已断开 MCP Server 连接');
    }
  }
}

// 如果直接运行此文件，则启动客户端
if (require.main === module) {
  const client = new SimpleMCPClient();

  // 连接到本地 MCP Server
  client.connectToServer(['ts-node', 'src/server.ts'])
    .then(() => client.startInteractiveSession())
    .catch((error) => {
      console.error('启动客户端失败:', error);
      console.log('请确保：');
      console.log('1. MCP Server 可以正常启动');
      console.log('2. Ollama 服务正在运行 (http://localhost:11434)');
      console.log('3. deepseek-r1:1.5b 模型已安装');
      process.exit(1);
    });
}

export { SimpleMCPClient, OllamaClient };
