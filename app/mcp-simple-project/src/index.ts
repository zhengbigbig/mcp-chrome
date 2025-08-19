#!/usr/bin/env node

import { SimpleMCPClient, OllamaClient } from './client';
import { SimpleMCPServer } from './server';

/**
 * 主入口文件
 * 可以同时启动 server 和 client，或者单独启动
 */

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'server':
      console.log('🚀 启动 MCP Server...');
      const server = new SimpleMCPServer();
      await server.start();
      break;

    case 'client':
      console.log('🚀 启动 MCP Client...');
      const client = new SimpleMCPClient();
      try {
        await client.connectToServer(['ts-node', 'src/server.ts']);
        await client.startInteractiveSession();
      } catch (error) {
        console.error('启动客户端失败:', error);
        process.exit(1);
      } finally {
        await client.disconnect();
      }
      break;

    case 'test-ollama':
      console.log('🧪 测试 Ollama 连接...');
      const ollama = new OllamaClient();
      
      console.log('检查 Ollama 服务状态...');
      const isHealthy = await ollama.checkHealth();
      console.log(`Ollama 服务状态: ${isHealthy ? '✅ 正常' : '❌ 不可用'}`);
      
      if (isHealthy) {
        console.log('检查 deepseek-r1:1.5b 模型...');
        const hasModel = await ollama.checkModel();
        console.log(`deepseek-r1:1.5b 模型: ${hasModel ? '✅ 可用' : '❌ 不可用'}`);
        
        if (hasModel) {
          console.log('测试模型对话...');
          try {
            const response = await ollama.chat('你好，请简单介绍一下你自己。');
            console.log('模型响应:', response);
          } catch (error) {
            console.error('模型对话失败:', error);
          }
        }
      }
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      console.log('📖 MCP Simple Project 使用说明');
      console.log('');
      console.log('用法: npm run <command>');
      console.log('');
      console.log('可用命令:');
      console.log('  dev          - 启动开发模式 (同时运行 server 和 client)');
      console.log('  server       - 只启动 MCP Server');
      console.log('  client       - 只启动 MCP Client');
      console.log('  test-ollama  - 测试 Ollama 连接和模型');
      console.log('  build        - 编译 TypeScript');
      console.log('  start        - 运行编译后的代码');
      console.log('');
      console.log('开发命令:');
      console.log('  npm run dev          - 开发模式');
      console.log('  npm run server       - 启动服务器');
      console.log('  npm run client       - 启动客户端');
      console.log('  npm run test-ollama  - 测试 Ollama');
      console.log('');
      console.log('环境要求:');
      console.log('  1. Ollama 服务运行在 http://localhost:11434');
      console.log('  2. 已安装 deepseek-r1:1.5b 模型');
      console.log('     安装命令: ollama pull deepseek-r1:1.5b');
      console.log('');
      break;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('程序执行失败:', error);
    process.exit(1);
  });
}

export { SimpleMCPServer, SimpleMCPClient, OllamaClient };
