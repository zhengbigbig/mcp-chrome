/**
 * Chrome Extension Constants
 * Centralized configuration values and magic constants
 */

// Native Host Configuration
export const NATIVE_HOST = {
  NAME: 'com.chromemcp.nativehost',
  DEFAULT_PORT: 12306,
} as const;

// Chrome Extension Icons
export const ICONS = {
  NOTIFICATION: 'icon/48.png',
} as const;

// Timeouts and Delays (in milliseconds)
export const TIMEOUTS = {
  DEFAULT_WAIT: 1000,
  NETWORK_CAPTURE_MAX: 30000,
  NETWORK_CAPTURE_IDLE: 3000,
  SCREENSHOT_DELAY: 100,
  KEYBOARD_DELAY: 50,
  CLICK_DELAY: 100,
} as const;

// Limits and Thresholds
export const LIMITS = {
  MAX_NETWORK_REQUESTS: 100,
  MAX_SEARCH_RESULTS: 50,
  MAX_BOOKMARK_RESULTS: 100,
  MAX_HISTORY_RESULTS: 100,
  // 语义搜索相关配置已移除
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NATIVE_CONNECTION_FAILED: 'Failed to connect to native host',
  NATIVE_DISCONNECTED: 'Native connection disconnected',
  SERVER_STATUS_LOAD_FAILED: 'Failed to load server status',
  SERVER_STATUS_SAVE_FAILED: 'Failed to save server status',
  TOOL_EXECUTION_FAILED: 'Tool execution failed',
  INVALID_PARAMETERS: 'Invalid parameters provided',
  PERMISSION_DENIED: 'Permission denied',
  TAB_NOT_FOUND: 'Tab not found',
  ELEMENT_NOT_FOUND: 'Element not found',
  NETWORK_ERROR: 'Network error occurred',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TOOL_EXECUTED: 'Tool executed successfully',
  CONNECTION_ESTABLISHED: 'Connection established',
  SERVER_STARTED: 'Server started successfully',
  SERVER_STOPPED: 'Server stopped successfully',
} as const;

// File Extensions and MIME Types
export const FILE_TYPES = {
  STATIC_EXTENSIONS: [
    '.css',
    '.js',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
  ],
  FILTERED_MIME_TYPES: ['text/html', 'text/css', 'text/javascript', 'application/javascript'],
  IMAGE_FORMATS: ['png', 'jpeg', 'webp'] as const,
} as const;

// Network Filtering
export const NETWORK_FILTERS = {
  EXCLUDED_DOMAINS: [
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.com',
    'doubleclick.net',
    'googlesyndication.com',
  ],
  STATIC_RESOURCE_TYPES: ['stylesheet', 'image', 'font', 'media', 'other'],
} as const;

// 语义搜索配置已移除

// Storage Keys
export const STORAGE_KEYS = {
  SERVER_STATUS: 'serverStatus',
  USER_PREFERENCES: 'userPreferences',
  // 语义搜索相关存储键已移除
} as const;

// Notification Configuration
export const NOTIFICATIONS = {
  PRIORITY: 2,
  TYPE: 'basic' as const,
} as const;

export enum ExecutionWorld {
  ISOLATED = 'ISOLATED',
  MAIN = 'MAIN',
}
