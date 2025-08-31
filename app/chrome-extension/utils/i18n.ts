/**
 * Chrome Extension i18n utility
 * Provides safe access to chrome.i18n.getMessage with fallbacks
 */

// Fallback messages for when Chrome APIs aren't available (English)
const fallbackMessages: Record<string, string> = {
  // Extension metadata
  extensionName: 'chrome-mcp-server',
  extensionDescription: 'Exposes browser capabilities with your own chrome',

  // Section headers
  nativeServerConfigLabel: 'Native Server Configuration',
  // 语义引擎功能已移除
  embeddingModelLabel: 'Embedding Model',
  indexDataManagementLabel: 'Index Data Management',
  modelCacheManagementLabel: 'Model Cache Management',

  // Status labels
  statusLabel: 'Status',
  runningStatusLabel: 'Running Status',
  connectionStatusLabel: 'Connection Status',
  lastUpdatedLabel: 'Last Updated:',

  // Connection states
  connectButton: 'Connect',
  disconnectButton: 'Disconnect',
  connectingStatus: 'Connecting...',
  connectedStatus: 'Connected',
  disconnectedStatus: 'Disconnected',
  detectingStatus: 'Detecting...',

  // Server states
  serviceRunningStatus: 'Service Running (Port: {0})',
  serviceNotConnectedStatus: 'Service Not Connected',
  connectedServiceNotStartedStatus: 'Connected, Service Not Started',

  // Configuration labels
  mcpServerConfigLabel: 'MCP Server Configuration',
  connectionPortLabel: 'Connection Port',
  refreshStatusButton: 'Refresh Status',
  copyConfigButton: 'Copy Configuration',

  // Action buttons
  retryButton: 'Retry',
  cancelButton: 'Cancel',
  confirmButton: 'Confirm',
  saveButton: 'Save',
  closeButton: 'Close',
  resetButton: 'Reset',

  // Progress states
  initializingStatus: 'Initializing...',
  processingStatus: 'Processing...',
  loadingStatus: 'Loading...',
  clearingStatus: 'Clearing...',
  cleaningStatus: 'Cleaning...',
  downloadingStatus: 'Downloading...',

  // 语义引擎功能已移除
  reinitializeButton: 'Reinitialize',

  // Model states
  downloadingModelStatus: 'Downloading Model... {0}%',
  switchingModelStatus: 'Switching Model...',
  modelLoadedStatus: 'Model Loaded',
  modelFailedStatus: 'Model Failed to Load',

  // Model descriptions
  lightweightModelDescription: 'Lightweight Multilingual Model',
  betterThanSmallDescription: 'Slightly larger than e5-small, but better performance',
  multilingualModelDescription: 'Multilingual Semantic Model',

  // Performance levels
  fastPerformance: 'Fast',
  balancedPerformance: 'Balanced',
  accuratePerformance: 'Accurate',

  // Error messages
  networkErrorMessage: 'Network connection error, please check network and retry',
  modelCorruptedErrorMessage: 'Model file corrupted or incomplete, please retry download',
  unknownErrorMessage: 'Unknown error, please check if your network can access HuggingFace',
  permissionDeniedErrorMessage: 'Permission denied',
  timeoutErrorMessage: 'Operation timed out',

  // Data statistics
  indexedPagesLabel: 'Indexed Pages',
  indexSizeLabel: 'Index Size',
  activeTabsLabel: 'Active Tabs',
  vectorDocumentsLabel: 'Vector Documents',
  cacheSizeLabel: 'Cache Size',
  cacheEntriesLabel: 'Cache Entries',

  // Data management
  clearAllDataButton: 'Clear All Data',
  clearAllCacheButton: 'Clear All Cache',
  cleanExpiredCacheButton: 'Clean Expired Cache',
  exportDataButton: 'Export Data',
  importDataButton: 'Import Data',

  // Dialog titles
  confirmClearDataTitle: 'Confirm Clear Data',
  settingsTitle: 'Settings',
  aboutTitle: 'About',
  helpTitle: 'Help',

  // Dialog messages
  clearDataWarningMessage:
    'This operation will clear all indexed webpage content and vector data, including:',
  clearDataList1: 'All webpage text content index',
  clearDataList2: 'Vector embedding data',
  clearDataList3: 'Search history and cache',
  clearDataIrreversibleWarning:
    'This operation is irreversible! After clearing, you need to browse webpages again to rebuild the index.',
  confirmClearButton: 'Confirm Clear',

  // Cache states
  cacheDetailsLabel: 'Cache Details',
  noCacheDataMessage: 'No cache data',
  loadingCacheInfoStatus: 'Loading cache information...',
  processingCacheStatus: 'Processing cache...',
  expiredLabel: 'Expired',

  // Browser integration
  bookmarksBarLabel: 'Bookmarks Bar',
  newTabLabel: 'New Tab',
  currentPageLabel: 'Current Page',

  // Accessibility
  menuLabel: 'Menu',
  navigationLabel: 'Navigation',
  mainContentLabel: 'Main Content',

  // Future features
  languageSelectorLabel: 'Language',
  themeLabel: 'Theme',
  lightTheme: 'Light',
  darkTheme: 'Dark',
  autoTheme: 'Auto',
  advancedSettingsLabel: 'Advanced Settings',
  debugModeLabel: 'Debug Mode',
  verboseLoggingLabel: 'Verbose Logging',

  // Notifications
  successNotification: 'Operation completed successfully',
  warningNotification: 'Warning: Please review before proceeding',
  infoNotification: 'Information',
  configCopiedNotification: 'Configuration copied to clipboard',
  dataClearedNotification: 'Data cleared successfully',

  // Units
  bytesUnit: 'bytes',
  kilobytesUnit: 'KB',
  megabytesUnit: 'MB',
  gigabytesUnit: 'GB',
  itemsUnit: 'items',
  pagesUnit: 'pages',

  // Legacy keys for backwards compatibility
  nativeServerConfig: 'Native Server Configuration',
  runningStatus: 'Running Status',
  refreshStatus: 'Refresh Status',
  lastUpdated: 'Last Updated:',
  mcpServerConfig: 'MCP Server Configuration',
  connectionPort: 'Connection Port',
  connecting: 'Connecting...',
  disconnect: 'Disconnect',
  connect: 'Connect',
  // 语义引擎功能已移除
  embeddingModel: 'Embedding Model',
  retry: 'Retry',
  indexDataManagement: 'Index Data Management',
  clearing: 'Clearing...',
  clearAllData: 'Clear All Data',
  copyConfig: 'Copy Configuration',
  serviceRunning: 'Service Running (Port: {0})',
  connectedServiceNotStarted: 'Connected, Service Not Started',
  serviceNotConnected: 'Service Not Connected',
  detecting: 'Detecting...',
  lightweightModel: 'Lightweight Multilingual Model',
  betterThanSmall: 'Slightly larger than e5-small, but better performance',
  multilingualModel: 'Multilingual Semantic Model',
  fast: 'Fast',
  balanced: 'Balanced',
  accurate: 'Accurate',
  // 语义引擎相关功能已移除
  // 模型下载、索引管理等功能已移除
  confirmClearData: 'Confirm Clear Data',
  clearDataWarning: 'This operation will clear all data (functionality simplified after cleanup)',
  clearDataIrreversible: 'This operation is irreversible!',
  confirmClear: 'Confirm Clear',
  cancel: 'Cancel',
  confirm: 'Confirm',
  processing: 'Processing...',
  // 模型缓存管理功能已移除
  bookmarksBar: 'Bookmarks Bar',
};

/**
 * Safe i18n message getter with fallback support
 * @param key Message key
 * @param substitutions Optional substitution values
 * @returns Localized message or fallback
 */
export function getMessage(key: string, substitutions?: string[]): string {
  try {
    // Check if Chrome extension APIs are available
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) {
        return message;
      }
    }
  } catch (error) {
    console.warn(`Failed to get i18n message for key "${key}":`, error);
  }

  // Fallback to English messages
  let fallback = fallbackMessages[key] || key;

  // Handle substitutions in fallback messages
  if (substitutions && substitutions.length > 0) {
    substitutions.forEach((value, index) => {
      fallback = fallback.replace(`{${index}}`, value);
    });
  }

  return fallback;
}

/**
 * Check if Chrome extension i18n APIs are available
 */
export function isI18nAvailable(): boolean {
  try {
    return (
      typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function'
    );
  } catch {
    return false;
  }
}
