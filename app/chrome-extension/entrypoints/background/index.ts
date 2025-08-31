import { initNativeHostListener } from './native-host';
import {
  initSemanticSimilarityListener,
  initializeSemanticEngineIfCached,
} from './semantic-similarity';
import { initStorageManagerListener } from './storage-manager';
import { cleanupModelCache } from '@/utils/semantic-similarity-engine';
import { handleCallTool } from './tools';
import { internalMCPServer } from './mcp-internal-server';

/**
 * 处理来自sidepanel的MCP请求（通过Internal MCP Server）
 */
async function handleMCPRequest(mcpRequest: any): Promise<any> {
  try {
    // 使用 Internal MCP Server 的传输层处理请求
    const transport = internalMCPServer.getTransport();
    
    // 通过内部传输层发送请求并获取响应
    const response = await transport.sendRequest(mcpRequest.method, mcpRequest.params);
    
    return {
      jsonrpc: '2.0',
      id: mcpRequest.id,
      result: response,
    };
  } catch (error) {
    console.error('[Background] MCP请求处理失败:', error);
    return {
      jsonrpc: '2.0',
      id: mcpRequest.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  // Initialize Internal MCP Server
  console.log('[Background] 启动 Internal MCP Server...');
  if (internalMCPServer.isRunning()) {
    console.log('[Background] Internal MCP Server 已运行');
  } else {
    console.log('[Background] Internal MCP Server 启动中...');
  }

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

  // Setup extension installation handler
  chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] 插件已安装/更新');
    
    // 设置侧边栏默认行为：点击插件图标时打开侧边栏
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .then(() => {
        console.log('[Background] 已设置点击插件图标自动打开侧边栏');
      })
      .catch((error) => {
        console.error('[Background] 设置侧边栏行为失败:', error);
      });
  });

  // Setup action click listener to open sidepanel (备用方案)
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('[Background] 侧边栏已通过插件图标点击打开');
      }
    } catch (error) {
      console.error('[Background] 通过插件图标打开侧边栏失败:', error);
    }
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

    // Handle GET_ALL_TOOLS request from options page
    if (message.type === 'GET_ALL_TOOLS') {
      try {
        const tools = internalMCPServer.getAvailableTools();
        sendResponse({ success: true, tools });
      } catch (error) {
        console.error('Get tools failed:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
      return false;
    }

    // Handle MCP_LIST_TOOLS request from sidepanel
    if (message.type === 'MCP_LIST_TOOLS') {
      try {
        const tools = internalMCPServer.getAvailableTools();
        sendResponse({ success: true, tools });
      } catch (error) {
        console.error('List tools failed:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
      return false;
    }

    // Handle MCP_CALL_TOOL request from sidepanel
    if (message.type === 'MCP_CALL_TOOL') {
      const { name, args } = message.payload || {};
      handleCallTool({ name, args })
        .then((result) => {
          sendResponse({ success: true, result });
        })
        .catch((error) => {
          console.error('Call tool failed:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true; // Keep message channel open for async response
    }
  });
});
