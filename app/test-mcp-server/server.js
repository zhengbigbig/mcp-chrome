#!/usr/bin/env node

// 独立的测试 MCP Server
// 支持 HTTP 和 WebSocket 两种传输方式

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// 创建 MCP Server
const mcpServer = new Server(
  {
    name: 'test-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义测试工具
const tools = [
  {
    name: 'weather',
    description: '获取指定城市的天气信息',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称',
        },
        unit: {
          type: 'string',
          description: '温度单位 (celsius/fahrenheit)',
          enum: ['celsius', 'fahrenheit'],
          default: 'celsius',
        },
      },
      required: ['city'],
    },
  },
  {
    name: 'translate',
    description: '翻译文本到指定语言',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要翻译的文本',
        },
        from: {
          type: 'string',
          description: '源语言代码 (如 en, zh, ja)',
          default: 'auto',
        },
        to: {
          type: 'string',
          description: '目标语言代码 (如 en, zh, ja)',
        },
      },
      required: ['text', 'to'],
    },
  },
  {
    name: 'random_number',
    description: '生成指定范围内的随机数',
    inputSchema: {
      type: 'object',
      properties: {
        min: {
          type: 'number',
          description: '最小值',
          default: 0,
        },
        max: {
          type: 'number',
          description: '最大值',
          default: 100,
        },
        count: {
          type: 'integer',
          description: '生成数量',
          default: 1,
          minimum: 1,
          maximum: 10,
        },
      },
    },
  },
  {
    name: 'system_info',
    description: '获取系统信息',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'base64_encode',
    description: 'Base64 编码',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要编码的文本',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'base64_decode',
    description: 'Base64 解码',
    inputSchema: {
      type: 'object',
      properties: {
        encoded: {
          type: 'string',
          description: '要解码的 Base64 字符串',
        },
      },
      required: ['encoded'],
    },
  },
];

// 设置工具列表处理器
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 设置工具调用处理器
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'weather':
        return handleWeather(args);
      case 'translate':
        return handleTranslate(args);
      case 'random_number':
        return handleRandomNumber(args);
      case 'system_info':
        return handleSystemInfo(args);
      case 'base64_encode':
        return handleBase64Encode(args);
      case 'base64_decode':
        return handleBase64Decode(args);
      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `工具执行失败: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 工具实现函数
function handleWeather(args) {
  const { city, unit = 'celsius' } = args;
  
  // 模拟天气数据
  const weathers = ['晴天', '多云', '小雨', '阴天', '雾霾'];
  const weather = weathers[Math.floor(Math.random() * weathers.length)];
  const temp = Math.floor(Math.random() * 30) + 5;
  const tempUnit = unit === 'fahrenheit' ? '°F' : '°C';
  const actualTemp = unit === 'fahrenheit' ? Math.floor(temp * 9/5 + 32) : temp;

  return {
    content: [
      {
        type: 'text',
        text: `${city}的天气: ${weather}，温度: ${actualTemp}${tempUnit}，湿度: ${Math.floor(Math.random() * 40) + 40}%`,
      },
    ],
  };
}

function handleTranslate(args) {
  const { text, from = 'auto', to } = args;
  
  // 简单的模拟翻译
  const translations = {
    'hello': { zh: '你好', ja: 'こんにちは', es: 'hola', fr: 'bonjour' },
    'world': { zh: '世界', ja: '世界', es: 'mundo', fr: 'monde' },
    'thank you': { zh: '谢谢', ja: 'ありがとう', es: 'gracias', fr: 'merci' },
    'good morning': { zh: '早上好', ja: 'おはよう', es: 'buenos días', fr: 'bonjour' },
  };

  const lowerText = text.toLowerCase();
  const translated = translations[lowerText]?.[to] || `[模拟翻译] ${text} -> ${to}`;

  return {
    content: [
      {
        type: 'text',
        text: `翻译结果 (${from} -> ${to}): ${translated}`,
      },
    ],
  };
}

function handleRandomNumber(args) {
  const { min = 0, max = 100, count = 1 } = args;
  
  const numbers = [];
  for (let i = 0; i < count; i++) {
    numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  return {
    content: [
      {
        type: 'text',
        text: `随机数 (${min}-${max}): ${numbers.join(', ')}`,
      },
    ],
  };
}

function handleSystemInfo(args) {
  const info = {
    platform: process.platform,
    nodeVersion: process.version,
    architecture: process.arch,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  };

  return {
    content: [
      {
        type: 'text',
        text: `系统信息:
平台: ${info.platform}
Node.js: ${info.nodeVersion}
架构: ${info.architecture}
运行时间: ${info.uptime} 秒
内存使用: ${info.memory.used}MB / ${info.memory.total}MB
时间戳: ${info.timestamp}`,
      },
    ],
  };
}

function handleBase64Encode(args) {
  const { text } = args;
  const encoded = Buffer.from(text, 'utf8').toString('base64');

  return {
    content: [
      {
        type: 'text',
        text: `Base64 编码结果: ${encoded}`,
      },
    ],
  };
}

function handleBase64Decode(args) {
  const { encoded } = args;
  
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    return {
      content: [
        {
          type: 'text',
          text: `Base64 解码结果: ${decoded}`,
        },
      ],
    };
  } catch (error) {
    throw new Error('无效的 Base64 字符串');
  }
}

// 创建 Express 应用
const app = express();
app.use(cors({
  origin: true, // 允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json());

// HTTP API 端点
app.get('/tools', async (req, res) => {
  try {
    // 返回工具列表，兼容现有的 Chrome 扩展期望
    res.json(tools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tools/list', async (req, res) => {
  try {
    // 直接返回工具列表，不需要通过 MCP Server
    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body.params || req.body;
    
    // 直接处理工具调用
    let result;
    switch (name) {
      case 'weather':
        const city = args?.city || '北京';
        const unit = args?.unit || 'celsius';
        const temp = unit === 'fahrenheit' ? '72°F' : '22°C';
        result = {
          content: [{
            type: 'text',
            text: `${city}当前天气：晴天，温度 ${temp}，湿度 65%，风速 5km/h`
          }]
        };
        break;
        
      case 'translate':
        const text = args?.text || '';
        const targetLang = args?.target_language || 'english';
        result = {
          content: [{
            type: 'text',
            text: `翻译结果 (${targetLang}): ${text} -> [模拟翻译: ${text}_translated]`
          }]
        };
        break;
        
      case 'random_number':
        const min = args?.min || 1;
        const max = args?.max || 100;
        const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        result = {
          content: [{
            type: 'text',
            text: `生成的随机数: ${randomNum} (范围: ${min}-${max})`
          }]
        };
        break;
        
      case 'system_info':
        result = {
          content: [{
            type: 'text',
            text: `系统信息: Node.js ${process.version}, 平台: ${process.platform}, 架构: ${process.arch}, 内存使用: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
          }]
        };
        break;
        
      case 'base64_encode':
        const encodeText = args?.text || '';
        const encoded = Buffer.from(encodeText).toString('base64');
        result = {
          content: [{
            type: 'text',
            text: `Base64 编码结果: ${encoded}`
          }]
        };
        break;
        
      case 'base64_decode':
        const encodedText = args?.encoded || '';
        try {
          const decoded = Buffer.from(encodedText, 'base64').toString('utf8');
          result = {
            content: [{
              type: 'text',
              text: `Base64 解码结果: ${decoded}`
            }]
          };
        } catch (error) {
          result = {
            content: [{
              type: 'text',
              text: `Base64 解码失败: ${error.message}`
            }]
          };
        }
        break;
        
      default:
        throw new Error(`未知工具: ${name}`);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'test-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    tools: tools.length,
  });
});

// 信息端点
app.get('/info', (req, res) => {
  res.json({
    name: 'test-mcp-server',
    description: '测试用的独立 MCP Server',
    version: '1.0.0',
    capabilities: ['tools'],
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
    })),
    transports: ['http', 'websocket'],
    endpoints: {
      http: `http://localhost:${PORT}`,
      websocket: `ws://localhost:${PORT}/ws`,
    },
  });
});

// 创建 HTTP 服务器
const PORT = process.env.PORT || 3002;
const httpServer = createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ 
  server: httpServer,
  path: '/ws'
});

// WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('WebSocket 客户端已连接');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const { id, method, params } = message;

      let result;
      switch (method) {
        case 'tools/list':
          result = await mcpServer.request(
            { method: 'tools/list' },
            ListToolsRequestSchema
          );
          break;
        case 'tools/call':
          result = await mcpServer.request(
            { method: 'tools/call', params },
            CallToolRequestSchema
          );
          break;
        default:
          throw new Error(`未知方法: ${method}`);
      }

      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result,
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: message?.id,
        error: {
          code: -32000,
          message: error.message,
        },
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket 客户端已断开');
  });

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    server: 'test-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));
});

// 启动服务器
httpServer.listen(PORT, () => {
  console.log(`🚀 测试 MCP Server 已启动:`);
  console.log(`   HTTP API: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Info: http://localhost:${PORT}/info`);
  console.log(`   工具数量: ${tools.length}`);
  console.log(`   支持的工具: ${tools.map(t => t.name).join(', ')}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  httpServer.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM，正在关闭服务器...');
  httpServer.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export { mcpServer, app, httpServer, wss };
