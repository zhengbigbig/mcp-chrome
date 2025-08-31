// MCP Client for Chrome Extension - adapted for background script communication

// Define our own types for compatibility
export interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface CallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface BrowserClientTransport {
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: any): Promise<any>;
}

/**
 * Chrome Extension MCP Client - communicates with background script
 */
export class ChromeMCPClient implements BrowserClientTransport {
  constructor() {}

  /**
   * List all available tools from background script
   */
  async listTools(): Promise<Tool[]> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'MCP_LIST_TOOLS' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve(response.tools || []);
          } else {
            reject(new Error(response?.error || 'Failed to list tools'));
          }
        }
      );
    });
  }

  /**
   * Call a tool via background script
   */
  async callTool(name: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'MCP_CALL_TOOL',
          payload: { name, args }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve(response.result);
          } else {
            reject(new Error(response?.error || 'Tool call failed'));
          }
        }
      );
    });
  }
}

// Types are already exported above
