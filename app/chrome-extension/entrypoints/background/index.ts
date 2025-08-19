import { initNativeHostListener } from './native-host';
import {
  initSemanticSimilarityListener,
  initializeSemanticEngineIfCached,
} from './semantic-similarity';
import { initStorageManagerListener } from './storage-manager';
import { cleanupModelCache } from '@/utils/semantic-similarity-engine';
import { handleCallTool } from './tools';

/**
 * 处理来自sidepanel的MCP请求
 */
async function handleMCPRequest(mcpRequest: any): Promise<any> {
  const { method, params } = mcpRequest;

  switch (method) {
    case 'initialize':
      // 返回初始化响应
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'chrome-mcp-server',
            version: '1.0.0',
          },
        },
      };

    case 'tools/list':
      // 返回可用工具列表
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result: {
          tools: [
            {
              name: 'browser_screenshot',
              description: '截取当前浏览器标签页的屏幕截图',
              inputSchema: {
                type: 'object',
                properties: {
                  fullPage: { type: 'boolean', description: '是否截取完整页面' },
                },
              },
            },
            {
              name: 'browser_get_tabs',
              description: '获取所有打开的浏览器标签页信息',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'browser_get_page_content',
              description: '获取当前页面的文本内容',
              inputSchema: {
                type: 'object',
                properties: {
                  selector: { type: 'string', description: 'CSS选择器（可选）' },
                },
              },
            },
            {
              name: 'browser_get_console_logs',
              description: '获取浏览器控制台日志',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        },
      };

    case 'tools/call':
      // 调用工具
      try {
        const result = await handleCallTool(params);
        return {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result),
              },
            ],
          },
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: {
            code: -1,
            message: error instanceof Error ? error.message : 'Tool call failed',
          },
        };
      }

    default:
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      };
  }
}

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  // Initialize core services
  initNativeHostListener();
  initSemanticSimilarityListener();
  initStorageManagerListener();

  // Conditionally initialize semantic similarity engine if model cache exists
  initializeSemanticEngineIfCached()
    .then((initialized) => {
      if (initialized) {
        console.log('Background: Semantic similarity engine initialized from cache');
      } else {
        console.log(
          'Background: Semantic similarity engine initialization skipped (no cache found)',
        );
      }
    })
    .catch((error) => {
      console.warn('Background: Failed to conditionally initialize semantic engine:', error);
    });

  // Initial cleanup on startup
  cleanupModelCache().catch((error) => {
    console.warn('Background: Initial cache cleanup failed:', error);
  });

  // Setup sidePanel listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_SIDEPANEL') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.sidePanel
            .open({ windowId: tabs[0].windowId })
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((error) => {
              console.error('Failed to open sidePanel:', error);
              sendResponse({ success: false, error: error.message });
            });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
      return true; // Keep the message channel open for async response
    }

    // Handle MCP requests from sidepanel
    if (message.type === 'MCP_REQUEST') {
      handleMCPRequest(message.payload)
        .then((result) => {
          sendResponse({ success: true, data: result });
        })
        .catch((error) => {
          console.error('MCP request failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for async response
    }
  });
});
