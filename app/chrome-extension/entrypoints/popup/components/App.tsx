import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  PREDEFINED_MODELS,
  type ModelPreset,
  getModelInfo,
  getCacheStats,
  clearModelCache,
  cleanupModelCache,
} from '@/utils/semantic-similarity-engine';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { getMessage } from '@/utils/i18n';

import { ConfirmDialog } from './ConfirmDialog';
import { ProgressIndicator } from './ProgressIndicator';
import { ModelCacheManagement } from './ModelCacheManagement';
import {
  DocumentIcon,
  DatabaseIcon,
  BoltIcon,
  TrashIcon,
  CheckIcon,
  TabIcon,
  VectorIcon,
} from './icons';

interface ServerStatus {
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}

interface StorageStats {
  indexedPages: number;
  totalDocuments: number;
  totalTabs: number;
  indexSize: number;
  isInitialized: boolean;
}

interface CacheStats {
  totalSize: number;
  totalSizeMB: number;
  entryCount: number;
  entries: Array<{
    url: string;
    size: number;
    sizeMB: number;
    timestamp: number;
    age: string;
    expired: boolean;
  }>;
}

export const App: React.FC = () => {
  // State management
  const [nativeConnectionStatus, setNativeConnectionStatus] = useState<
    'unknown' | 'connected' | 'disconnected'
  >('unknown');
  const [isConnecting, setIsConnecting] = useState(false);
  const [nativeServerPort, setNativeServerPort] = useState<number>(12306);

  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    isRunning: false,
    lastUpdated: Date.now(),
  });

  const [copyButtonText, setCopyButtonText] = useState(getMessage('copyConfigButton'));

  const [currentModel, setCurrentModel] = useState<ModelPreset | null>(null);
  const [isModelSwitching, setIsModelSwitching] = useState(false);
  const [modelSwitchProgress, setModelSwitchProgress] = useState('');

  const [modelDownloadProgress, setModelDownloadProgress] = useState<number>(0);
  const [isModelDownloading, setIsModelDownloading] = useState(false);
  const [modelInitializationStatus, setModelInitializationStatus] = useState<
    'idle' | 'downloading' | 'initializing' | 'ready' | 'error'
  >('idle');
  const [modelErrorMessage, setModelErrorMessage] = useState<string>('');
  const [modelErrorType, setModelErrorType] = useState<'network' | 'file' | 'unknown' | ''>('');

  const [selectedVersion] = useState<'quantized'>('quantized');

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearDataProgress, setClearDataProgress] = useState('');

  const [semanticEngineStatus, setSemanticEngineStatus] = useState<
    'idle' | 'initializing' | 'ready' | 'error'
  >('idle');
  const [isSemanticEngineInitializing, setIsSemanticEngineInitializing] = useState(false);
  const [semanticEngineInitProgress, setSemanticEngineInitProgress] = useState('');
  const [semanticEngineLastUpdated, setSemanticEngineLastUpdated] = useState<number | null>(null);

  // Cache management
  const [isManagingCache, setIsManagingCache] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  // Refs for intervals
  const statusMonitoringInterval = useRef<NodeJS.Timeout | null>(null);
  const semanticEngineStatusPollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Computed values
  const showMcpConfig = useMemo(() => {
    return nativeConnectionStatus === 'connected' && serverStatus.isRunning;
  }, [nativeConnectionStatus, serverStatus.isRunning]);

  const mcpConfigJson = useMemo(() => {
    const port = serverStatus.port || nativeServerPort;
    const config = {
      mcpServers: {
        'streamable-mcp-server': {
          type: 'streamable-http',
          url: `http://127.0.0.1:${port}/mcp`,
        },
      },
    };
    return JSON.stringify(config, null, 2);
  }, [serverStatus.port, nativeServerPort]);

  const availableModels = useMemo(() => {
    return Object.entries(PREDEFINED_MODELS).map(([key, value]) => ({
      preset: key as ModelPreset,
      ...value,
    }));
  }, []);

  // Helper functions
  const getStatusClass = () => {
    if (nativeConnectionStatus === 'connected') {
      if (serverStatus.isRunning) {
        return 'bg-emerald-500';
      } else {
        return 'bg-yellow-500';
      }
    } else if (nativeConnectionStatus === 'disconnected') {
      return 'bg-red-500';
    } else {
      return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (nativeConnectionStatus === 'connected') {
      if (serverStatus.isRunning) {
        return getMessage('serviceRunningStatus', [(serverStatus.port || 'Unknown').toString()]);
      } else {
        return getMessage('connectedServiceNotStartedStatus');
      }
    } else if (nativeConnectionStatus === 'disconnected') {
      return getMessage('serviceNotConnectedStatus');
    } else {
      return getMessage('detectingStatus');
    }
  };

  const formatIndexSize = () => {
    if (!storageStats?.indexSize) return '0 MB';
    const sizeInMB = Math.round(storageStats.indexSize / (1024 * 1024));
    return `${sizeInMB} MB`;
  };

  const getModelDescription = (model: any) => {
    switch (model.preset) {
      case 'multilingual-e5-small':
        return getMessage('lightweightModelDescription');
      case 'multilingual-e5-base':
        return getMessage('betterThanSmallDescription');
      default:
        return getMessage('multilingualModelDescription');
    }
  };

  const getPerformanceText = (performance: string) => {
    switch (performance) {
      case 'fast':
        return getMessage('fastPerformance');
      case 'balanced':
        return getMessage('balancedPerformance');
      case 'accurate':
        return getMessage('accuratePerformance');
      default:
        return performance;
    }
  };

  const getSemanticEngineStatusText = () => {
    switch (semanticEngineStatus) {
      case 'ready':
        return getMessage('semanticEngineReadyStatus');
      case 'initializing':
        return getMessage('semanticEngineInitializingStatus');
      case 'error':
        return getMessage('semanticEngineInitFailedStatus');
      case 'idle':
      default:
        return getMessage('semanticEngineNotInitStatus');
    }
  };

  const getSemanticEngineStatusClass = () => {
    switch (semanticEngineStatus) {
      case 'ready':
        return 'bg-emerald-500';
      case 'initializing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'idle':
      default:
        return 'bg-gray-500';
    }
  };

  const getActiveTabsCount = () => {
    return storageStats?.totalTabs || 0;
  };

  const getProgressText = () => {
    if (isModelDownloading) {
      return getMessage('downloadingModelStatus', [modelDownloadProgress.toString()]);
    } else if (isModelSwitching) {
      return modelSwitchProgress || getMessage('switchingModelStatus');
    }
    return '';
  };

  const getErrorTypeText = () => {
    switch (modelErrorType) {
      case 'network':
        return getMessage('networkErrorMessage');
      case 'file':
        return getMessage('modelCorruptedErrorMessage');
      case 'unknown':
      default:
        return getMessage('unknownErrorMessage');
    }
  };

  const getSemanticEngineButtonText = () => {
    switch (semanticEngineStatus) {
      case 'ready':
        return getMessage('reinitializeButton');
      case 'initializing':
        return getMessage('initializingStatus');
      case 'error':
        return getMessage('reinitializeButton');
      case 'idle':
      default:
        return getMessage('initSemanticEngineButton');
    }
  };

  // State persistence functions
  const saveSemanticEngineState = useCallback(async () => {
    try {
      const semanticEngineState = {
        status: semanticEngineStatus,
        lastUpdated: semanticEngineLastUpdated,
      };
      await chrome.storage.local.set({ semanticEngineState });
    } catch (error) {
      console.error('保存语义引擎状态失败:', error);
    }
  }, [semanticEngineStatus, semanticEngineLastUpdated]);

  const saveModelPreference = useCallback(async (model: ModelPreset) => {
    try {
      await chrome.storage.local.set({ selectedModel: model });
    } catch (error) {
      console.error('保存模型偏好失败:', error);
    }
  }, []);

  const saveVersionPreference = useCallback(
    async (version: 'full' | 'quantized' | 'compressed') => {
      try {
        await chrome.storage.local.set({ selectedVersion: version });
      } catch (error) {
        console.error('保存版本偏好失败:', error);
      }
    },
    [],
  );

  const savePortPreference = useCallback(async (port: number) => {
    try {
      await chrome.storage.local.set({ nativeServerPort: port });
      console.log(`端口偏好已保存: ${port}`);
    } catch (error) {
      console.error('保存端口偏好失败:', error);
    }
  }, []);

  const saveModelState = useCallback(async () => {
    try {
      const modelState = {
        status: modelInitializationStatus,
        downloadProgress: modelDownloadProgress,
        isDownloading: isModelDownloading,
        lastUpdated: Date.now(),
      };
      await chrome.storage.local.set({ modelState });
    } catch (error) {
      console.error('保存模型状态失败:', error);
    }
  }, [modelInitializationStatus, modelDownloadProgress, isModelDownloading]);

  // Cache management functions
  const loadCacheStats = useCallback(async () => {
    try {
      setCacheStats(await getCacheStats());
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      setCacheStats(null);
    }
  }, []);

  const cleanupCache = useCallback(async () => {
    if (isManagingCache) return;

    setIsManagingCache(true);
    try {
      await cleanupModelCache();
      await loadCacheStats();
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    } finally {
      setIsManagingCache(false);
    }
  }, [isManagingCache, loadCacheStats]);

  const clearAllCache = useCallback(async () => {
    if (isManagingCache) return;

    setIsManagingCache(true);
    try {
      await clearModelCache();
      await loadCacheStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsManagingCache(false);
    }
  }, [isManagingCache, loadCacheStats]);

  // Core functionality functions
  const updatePort = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const newPort = Number(event.target.value);
      setNativeServerPort(newPort);
      await savePortPreference(newPort);
    },
    [savePortPreference],
  );

  const checkNativeConnection = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'ping_native' });
      setNativeConnectionStatus(response?.connected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('检测 Native 连接状态失败:', error);
      setNativeConnectionStatus('disconnected');
    }
  }, []);

  const checkServerStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS,
      });
      if (response?.success && response.serverStatus) {
        setServerStatus(response.serverStatus);
      }

      if (response?.connected !== undefined) {
        setNativeConnectionStatus(response.connected ? 'connected' : 'disconnected');
      }
    } catch (error) {
      console.error('检测服务器状态失败:', error);
    }
  }, []);

  const refreshServerStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS,
      });
      if (response?.success && response.serverStatus) {
        setServerStatus(response.serverStatus);
      }

      if (response?.connected !== undefined) {
        setNativeConnectionStatus(response.connected ? 'connected' : 'disconnected');
      }
    } catch (error) {
      console.error('刷新服务器状态失败:', error);
    }
  }, []);

  const copyMcpConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mcpConfigJson);
      setCopyButtonText('✅' + getMessage('configCopiedNotification'));

      setTimeout(() => {
        setCopyButtonText(getMessage('copyConfigButton'));
      }, 2000);
    } catch (error) {
      console.error('复制配置失败:', error);
      setCopyButtonText('❌' + getMessage('networkErrorMessage'));

      setTimeout(() => {
        setCopyButtonText(getMessage('copyConfigButton'));
      }, 2000);
    }
  }, [mcpConfigJson]);

  const testNativeConnection = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      if (nativeConnectionStatus === 'connected') {
        await chrome.runtime.sendMessage({ type: 'disconnect_native' });
        setNativeConnectionStatus('disconnected');
      } else {
        console.log(`尝试连接到端口: ${nativeServerPort}`);
        const response = await chrome.runtime.sendMessage({
          type: 'connectNative',
          port: nativeServerPort,
        });
        if (response && response.success) {
          setNativeConnectionStatus('connected');
          console.log('连接成功:', response);
          await savePortPreference(nativeServerPort);
        } else {
          setNativeConnectionStatus('disconnected');
          console.error('连接失败:', response);
        }
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      setNativeConnectionStatus('disconnected');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, nativeConnectionStatus, nativeServerPort, savePortPreference]);

  // Load preferences functions
  const loadPortPreference = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['nativeServerPort']);
      if (result.nativeServerPort) {
        setNativeServerPort(result.nativeServerPort);
        console.log(`端口偏好已加载: ${result.nativeServerPort}`);
      }
    } catch (error) {
      console.error('加载端口偏好失败:', error);
    }
  }, []);

  const loadModelPreference = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get([
        'selectedModel',
        'selectedVersion',
        'modelState',
        'semanticEngineState',
      ]);

      if (result.selectedModel) {
        const storedModel = result.selectedModel as string;
        console.log('📋 Stored model from storage:', storedModel);

        if (PREDEFINED_MODELS[storedModel as ModelPreset]) {
          setCurrentModel(storedModel as ModelPreset);
          console.log(`✅ Loaded valid model: ${storedModel}`);
        } else {
          console.warn(
            `⚠️ Stored model "${storedModel}" not found in PREDEFINED_MODELS, using default`,
          );
          setCurrentModel('multilingual-e5-small');
          await saveModelPreference('multilingual-e5-small');
        }
      } else {
        console.log('⚠️ No model found in storage, using default');
        setCurrentModel('multilingual-e5-small');
        await saveModelPreference('multilingual-e5-small');
      }

      console.log('✅ Using quantized version (fixed)');
      await saveVersionPreference('quantized');

      if (result.modelState) {
        const modelState = result.modelState;

        if (modelState.status === 'ready') {
          setModelInitializationStatus('ready');
          setModelDownloadProgress(modelState.downloadProgress || 100);
          setIsModelDownloading(false);
        } else {
          setModelInitializationStatus('idle');
          setModelDownloadProgress(0);
          setIsModelDownloading(false);
          await saveModelState();
        }
      } else {
        setModelInitializationStatus('idle');
        setModelDownloadProgress(0);
        setIsModelDownloading(false);
      }

      if (result.semanticEngineState) {
        const semanticState = result.semanticEngineState;
        if (semanticState.status === 'ready') {
          setSemanticEngineStatus('ready');
          setSemanticEngineLastUpdated(semanticState.lastUpdated || Date.now());
        } else if (semanticState.status === 'error') {
          setSemanticEngineStatus('error');
          setSemanticEngineLastUpdated(semanticState.lastUpdated || Date.now());
        } else {
          setSemanticEngineStatus('idle');
        }
      } else {
        setSemanticEngineStatus('idle');
      }
    } catch (error) {
      console.error('❌ 加载模型偏好失败:', error);
    }
  }, [saveModelPreference, saveVersionPreference, saveModelState]);

  // Semantic engine functions
  const checkSemanticEngineStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.GET_MODEL_STATUS,
      });

      if (response && response.success && response.status) {
        const status = response.status;

        if (status.initializationStatus === 'ready') {
          setSemanticEngineStatus('ready');
          setSemanticEngineLastUpdated(Date.now());
          setIsSemanticEngineInitializing(false);
          setSemanticEngineInitProgress(getMessage('semanticEngineReadyStatus'));
          await saveSemanticEngineState();
          stopSemanticEngineStatusPolling();
          setTimeout(() => {
            setSemanticEngineInitProgress('');
          }, 2000);
        } else if (
          status.initializationStatus === 'downloading' ||
          status.initializationStatus === 'initializing'
        ) {
          setSemanticEngineStatus('initializing');
          setIsSemanticEngineInitializing(true);
          setSemanticEngineInitProgress(getMessage('semanticEngineInitializingStatus'));
          setSemanticEngineLastUpdated(Date.now());
          await saveSemanticEngineState();
        } else if (status.initializationStatus === 'error') {
          setSemanticEngineStatus('error');
          setSemanticEngineLastUpdated(Date.now());
          setIsSemanticEngineInitializing(false);
          setSemanticEngineInitProgress(getMessage('semanticEngineInitFailedStatus'));
          await saveSemanticEngineState();
          stopSemanticEngineStatusPolling();
          setTimeout(() => {
            setSemanticEngineInitProgress('');
          }, 5000);
        } else {
          setSemanticEngineStatus('idle');
          setIsSemanticEngineInitializing(false);
          await saveSemanticEngineState();
        }
      } else {
        setSemanticEngineStatus('idle');
        setIsSemanticEngineInitializing(false);
        await saveSemanticEngineState();
      }
    } catch (error) {
      console.error('Popup: Failed to check semantic engine status:', error);
      setSemanticEngineStatus('idle');
      setIsSemanticEngineInitializing(false);
      await saveSemanticEngineState();
    }
  }, [saveSemanticEngineState]);

  const startSemanticEngineStatusPolling = useCallback(() => {
    if (semanticEngineStatusPollingInterval.current) {
      clearInterval(semanticEngineStatusPollingInterval.current);
    }

    semanticEngineStatusPollingInterval.current = setInterval(async () => {
      try {
        await checkSemanticEngineStatus();
      } catch (error) {
        console.error('Semantic engine status polling failed:', error);
      }
    }, 2000);
  }, [checkSemanticEngineStatus]);

  const stopSemanticEngineStatusPolling = useCallback(() => {
    if (semanticEngineStatusPollingInterval.current) {
      clearInterval(semanticEngineStatusPollingInterval.current);
      semanticEngineStatusPollingInterval.current = null;
    }
  }, []);

  const initializeSemanticEngine = useCallback(async () => {
    if (isSemanticEngineInitializing) return;

    const isReinitialization = semanticEngineStatus === 'ready';
    console.log(
      `🚀 User triggered semantic engine ${isReinitialization ? 'reinitialization' : 'initialization'}`,
    );

    setIsSemanticEngineInitializing(true);
    setSemanticEngineStatus('initializing');
    setSemanticEngineInitProgress(
      isReinitialization
        ? getMessage('semanticEngineInitializingStatus')
        : getMessage('semanticEngineInitializingStatus'),
    );
    setSemanticEngineLastUpdated(Date.now());

    await saveSemanticEngineState();

    try {
      chrome.runtime
        .sendMessage({
          type: BACKGROUND_MESSAGE_TYPES.INITIALIZE_SEMANTIC_ENGINE,
        })
        .catch((error) => {
          console.error('❌ Error sending semantic engine initialization request:', error);
        });

      startSemanticEngineStatusPolling();

      setSemanticEngineInitProgress(
        isReinitialization ? getMessage('processingStatus') : getMessage('processingStatus'),
      );
    } catch (error: any) {
      console.error('❌ Failed to send initialization request:', error);
      setSemanticEngineStatus('error');
      setSemanticEngineInitProgress(
        `Failed to send initialization request: ${error?.message || 'Unknown error'}`,
      );

      await saveSemanticEngineState();

      setTimeout(() => {
        setSemanticEngineInitProgress('');
      }, 5000);

      setIsSemanticEngineInitializing(false);
      setSemanticEngineLastUpdated(Date.now());
      await saveSemanticEngineState();
    }
  }, [
    isSemanticEngineInitializing,
    semanticEngineStatus,
    saveSemanticEngineState,
    startSemanticEngineStatusPolling,
  ]);

  // Model management functions
  const startModelStatusMonitoring = useCallback(() => {
    if (statusMonitoringInterval.current) {
      clearInterval(statusMonitoringInterval.current);
    }

    statusMonitoringInterval.current = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'get_model_status',
        });

        if (response && response.success) {
          const status = response.status;
          setModelInitializationStatus(status.initializationStatus || 'idle');
          setModelDownloadProgress(status.downloadProgress || 0);
          setIsModelDownloading(status.isDownloading || false);

          if (status.initializationStatus === 'error') {
            setModelErrorMessage(status.errorMessage || getMessage('modelFailedStatus'));
            setModelErrorType(status.errorType || 'unknown');
          } else {
            setModelErrorMessage('');
            setModelErrorType('');
          }

          await saveModelState();

          if (status.initializationStatus === 'ready' || status.initializationStatus === 'error') {
            stopModelStatusMonitoring();
          }
        }
      } catch (error) {
        console.error('获取模型状态失败:', error);
      }
    }, 1000);
  }, [saveModelState]);

  const stopModelStatusMonitoring = useCallback(() => {
    if (statusMonitoringInterval.current) {
      clearInterval(statusMonitoringInterval.current);
      statusMonitoringInterval.current = null;
    }
  }, []);

  const retryModelInitialization = useCallback(async () => {
    if (!currentModel) return;

    console.log('🔄 Retrying model initialization...');

    setModelErrorMessage('');
    setModelErrorType('');
    setModelInitializationStatus('downloading');
    setModelDownloadProgress(0);
    setIsModelDownloading(true);
    await switchModel(currentModel);
  }, [currentModel]);

  const switchModel = useCallback(
    async (newModel: ModelPreset) => {
      console.log(`🔄 switchModel called with newModel: ${newModel}`);

      if (isModelSwitching) {
        console.log('⏸️ Model switch already in progress, skipping');
        return;
      }

      const isSameModel = newModel === currentModel;
      const currentModelInfo = currentModel
        ? getModelInfo(currentModel)
        : getModelInfo('multilingual-e5-small');
      const newModelInfo = getModelInfo(newModel);
      const isDifferentDimension = currentModelInfo.dimension !== newModelInfo.dimension;

      console.log(`📊 Switch analysis:`);
      console.log(`   - Same model: ${isSameModel} (${currentModel} -> ${newModel})`);
      console.log(
        `   - Current dimension: ${currentModelInfo.dimension}, New dimension: ${newModelInfo.dimension}`,
      );
      console.log(`   - Different dimension: ${isDifferentDimension}`);

      if (isSameModel && !isDifferentDimension) {
        console.log('✅ Same model and dimension - no need to switch');
        return;
      }

      const switchReasons = [];
      if (!isSameModel) switchReasons.push('different model');
      if (isDifferentDimension) switchReasons.push('different dimension');

      console.log(`🚀 Switching model due to: ${switchReasons.join(', ')}`);
      console.log(
        `📋 Model: ${currentModel} (${currentModelInfo.dimension}D) -> ${newModel} (${newModelInfo.dimension}D)`,
      );

      setIsModelSwitching(true);
      setModelSwitchProgress(getMessage('switchingModelStatus'));

      setModelInitializationStatus('downloading');
      setModelDownloadProgress(0);
      setIsModelDownloading(true);

      try {
        await saveModelPreference(newModel);
        await saveVersionPreference('quantized');
        await saveModelState();

        setModelSwitchProgress(getMessage('semanticEngineInitializingStatus'));

        startModelStatusMonitoring();

        const response = await chrome.runtime.sendMessage({
          type: 'switch_semantic_model',
          modelPreset: newModel,
          modelVersion: 'quantized',
          modelDimension: newModelInfo.dimension,
          previousDimension: currentModelInfo.dimension,
        });

        if (response && response.success) {
          setCurrentModel(newModel);
          setModelSwitchProgress(getMessage('successNotification'));
          console.log(
            '模型切换成功:',
            newModel,
            'version: quantized',
            'dimension:',
            newModelInfo.dimension,
          );

          setModelInitializationStatus('ready');
          setIsModelDownloading(false);
          await saveModelState();

          setTimeout(() => {
            setModelSwitchProgress('');
          }, 2000);
        } else {
          throw new Error(response?.error || 'Model switch failed');
        }
      } catch (error: any) {
        console.error('模型切换失败:', error);
        setModelSwitchProgress(`Model switch failed: ${error?.message || 'Unknown error'}`);

        setModelInitializationStatus('error');
        setIsModelDownloading(false);

        const errorMessage = error?.message || '未知错误';
        if (
          errorMessage.includes('network') ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('timeout')
        ) {
          setModelErrorType('network');
          setModelErrorMessage(getMessage('networkErrorMessage'));
        } else if (
          errorMessage.includes('corrupt') ||
          errorMessage.includes('invalid') ||
          errorMessage.includes('format')
        ) {
          setModelErrorType('file');
          setModelErrorMessage(getMessage('modelCorruptedErrorMessage'));
        } else {
          setModelErrorType('unknown');
          setModelErrorMessage(errorMessage);
        }

        await saveModelState();

        setTimeout(() => {
          setModelSwitchProgress('');
        }, 8000);
      } finally {
        setIsModelSwitching(false);
      }
    },
    [
      isModelSwitching,
      currentModel,
      saveModelPreference,
      saveVersionPreference,
      saveModelState,
      startModelStatusMonitoring,
    ],
  );

  // Storage stats functions
  const refreshStorageStats = useCallback(async () => {
    if (isRefreshingStats) return;

    setIsRefreshingStats(true);
    try {
      console.log('🔄 Refreshing storage statistics...');

      const response = await chrome.runtime.sendMessage({
        type: 'get_storage_stats',
      });

      if (response && response.success) {
        setStorageStats({
          indexedPages: response.stats.indexedPages || 0,
          totalDocuments: response.stats.totalDocuments || 0,
          totalTabs: response.stats.totalTabs || 0,
          indexSize: response.stats.indexSize || 0,
          isInitialized: response.stats.isInitialized || false,
        });
        console.log('✅ Storage stats refreshed:', response.stats);
      } else {
        console.error('❌ Failed to get storage stats:', response?.error);
        setStorageStats({
          indexedPages: 0,
          totalDocuments: 0,
          totalTabs: 0,
          indexSize: 0,
          isInitialized: false,
        });
      }
    } catch (error) {
      console.error('❌ Error refreshing storage stats:', error);
      setStorageStats({
        indexedPages: 0,
        totalDocuments: 0,
        totalTabs: 0,
        indexSize: 0,
        isInitialized: false,
      });
    } finally {
      setIsRefreshingStats(false);
    }
  }, [isRefreshingStats]);

  const confirmClearAllData = useCallback(async () => {
    if (isClearingData) return;

    setIsClearingData(true);
    setClearDataProgress(getMessage('clearingStatus'));

    try {
      console.log('🗑️ Starting to clear all data...');

      const response = await chrome.runtime.sendMessage({
        type: 'clear_all_data',
      });

      if (response && response.success) {
        setClearDataProgress(getMessage('dataClearedNotification'));
        console.log('✅ All data cleared successfully');

        await refreshStorageStats();

        setTimeout(() => {
          setClearDataProgress('');
          setShowClearConfirmation(false);
        }, 2000);
      } else {
        throw new Error(response?.error || 'Failed to clear data');
      }
    } catch (error: any) {
      console.error('❌ Failed to clear all data:', error);
      setClearDataProgress(`Failed to clear data: ${error?.message || 'Unknown error'}`);

      setTimeout(() => {
        setClearDataProgress('');
      }, 5000);
    } finally {
      setIsClearingData(false);
    }
  }, [isClearingData, refreshStorageStats]);

  // Setup server status listener
  const setupServerStatusListener = useCallback(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED && message.payload) {
        setServerStatus(message.payload);
        console.log('Server status updated:', message.payload);
      }
    });
  }, []);

  // Effects
  useEffect(() => {
    const initialize = async () => {
      await loadPortPreference();
      await loadModelPreference();
      await checkNativeConnection();
      await checkServerStatus();
      await refreshStorageStats();
      await loadCacheStats();
      await checkSemanticEngineStatus();
      setupServerStatusListener();
    };

    initialize();

    return () => {
      stopModelStatusMonitoring();
      stopSemanticEngineStatusPolling();
    };
  }, []);

  // Effect to save semantic engine state when it changes
  useEffect(() => {
    saveSemanticEngineState();
  }, [semanticEngineStatus, semanticEngineLastUpdated, saveSemanticEngineState]);

  return (
    <div className="popup-container">
      <div className="header">
        <div className="header-content">
          <h1 className="header-title">Chrome MCP Server</h1>
        </div>
      </div>

      <div className="content">
        {/* Native Server Config Section */}
        <div className="section">
          <h2 className="section-title">{getMessage('nativeServerConfigLabel')}</h2>
          <div className="config-card">
            <div className="status-section">
              <div className="status-header">
                <p className="status-label">{getMessage('runningStatusLabel')}</p>
                <button
                  className="refresh-status-button"
                  onClick={refreshServerStatus}
                  title={getMessage('refreshStatusButton')}
                >
                  🔄
                </button>
              </div>
              <div className="status-info">
                <span className={`status-dot ${getStatusClass()}`}></span>
                <span className="status-text">{getStatusText()}</span>
              </div>
              {serverStatus.lastUpdated && (
                <div className="status-timestamp">
                  {getMessage('lastUpdatedLabel')}
                  {new Date(serverStatus.lastUpdated).toLocaleTimeString()}
                </div>
              )}
            </div>

            {showMcpConfig && (
              <div className="mcp-config-section">
                <div className="mcp-config-header">
                  <p className="mcp-config-label">{getMessage('mcpServerConfigLabel')}</p>
                  <button className="copy-config-button" onClick={copyMcpConfig}>
                    {copyButtonText}
                  </button>
                </div>
                <div className="mcp-config-content">
                  <pre className="mcp-config-json">{mcpConfigJson}</pre>
                </div>
              </div>
            )}

            <div className="port-section">
              <label htmlFor="port" className="port-label">
                {getMessage('connectionPortLabel')}
              </label>
              <input
                type="text"
                id="port"
                value={nativeServerPort}
                onChange={updatePort}
                className="port-input"
              />
            </div>

            <button
              className="connect-button"
              disabled={isConnecting}
              onClick={testNativeConnection}
            >
              <BoltIcon />
              <span>
                {isConnecting
                  ? getMessage('connectingStatus')
                  : nativeConnectionStatus === 'connected'
                    ? getMessage('disconnectButton')
                    : getMessage('connectButton')}
              </span>
            </button>
          </div>
        </div>

        {/* Semantic Engine Section */}
        <div className="section">
          <h2 className="section-title">{getMessage('semanticEngineLabel')}</h2>
          <div className="semantic-engine-card">
            <div className="semantic-engine-status">
              <div className="status-info">
                <span className={`status-dot ${getSemanticEngineStatusClass()}`}></span>
                <span className="status-text">{getSemanticEngineStatusText()}</span>
              </div>
              {semanticEngineLastUpdated && (
                <div className="status-timestamp">
                  {getMessage('lastUpdatedLabel')}
                  {new Date(semanticEngineLastUpdated).toLocaleTimeString()}
                </div>
              )}
            </div>

            <ProgressIndicator
              visible={isSemanticEngineInitializing}
              text={semanticEngineInitProgress}
              showSpinner={true}
            />

            <button
              className="semantic-engine-button"
              disabled={isSemanticEngineInitializing}
              onClick={initializeSemanticEngine}
            >
              <BoltIcon />
              <span>{getSemanticEngineButtonText()}</span>
            </button>
          </div>
        </div>

        {/* Embedding Model Section */}
        <div className="section">
          <h2 className="section-title">{getMessage('embeddingModelLabel')}</h2>

          <ProgressIndicator
            visible={isModelSwitching || isModelDownloading}
            text={getProgressText()}
            showSpinner={true}
          />

          {modelInitializationStatus === 'error' && (
            <div className="error-card">
              <div className="error-content">
                <div className="error-icon">⚠️</div>
                <div className="error-details">
                  <p className="error-title">{getMessage('semanticEngineInitFailedStatus')}</p>
                  <p className="error-message">
                    {modelErrorMessage || getMessage('semanticEngineInitFailedStatus')}
                  </p>
                  <p className="error-suggestion">{getErrorTypeText()}</p>
                </div>
              </div>
              <button
                className="retry-button"
                onClick={retryModelInitialization}
                disabled={isModelSwitching || isModelDownloading}
              >
                <span>🔄</span>
                <span>{getMessage('retryButton')}</span>
              </button>
            </div>
          )}

          <div className="model-list">
            {availableModels.map((model) => (
              <div
                key={model.preset}
                className={`model-card ${currentModel === model.preset ? 'selected' : ''} ${
                  isModelSwitching || isModelDownloading ? 'disabled' : ''
                }`}
                onClick={() => {
                  if (!isModelSwitching && !isModelDownloading) {
                    switchModel(model.preset as ModelPreset);
                  }
                }}
              >
                <div className="model-header">
                  <div className="model-info">
                    <p
                      className={`model-name ${currentModel === model.preset ? 'selected-text' : ''}`}
                    >
                      {model.preset}
                    </p>
                    <p className="model-description">{getModelDescription(model)}</p>
                  </div>
                  {currentModel === model.preset && (
                    <div className="check-icon">
                      <CheckIcon className="text-white" />
                    </div>
                  )}
                </div>
                <div className="model-tags">
                  <span className="model-tag performance">
                    {getPerformanceText(model.performance)}
                  </span>
                  <span className="model-tag size">{model.size}</span>
                  <span className="model-tag dimension">{model.dimension}D</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Index Data Management Section */}
        <div className="section">
          <h2 className="section-title">{getMessage('indexDataManagementLabel')}</h2>
          <div className="stats-grid">
            <div className="stats-card">
              <div className="stats-header">
                <p className="stats-label">{getMessage('indexedPagesLabel')}</p>
                <span className="stats-icon violet">
                  <DocumentIcon />
                </span>
              </div>
              <p className="stats-value">{storageStats?.indexedPages || 0}</p>
            </div>

            <div className="stats-card">
              <div className="stats-header">
                <p className="stats-label">{getMessage('indexSizeLabel')}</p>
                <span className="stats-icon teal">
                  <DatabaseIcon />
                </span>
              </div>
              <p className="stats-value">{formatIndexSize()}</p>
            </div>

            <div className="stats-card">
              <div className="stats-header">
                <p className="stats-label">{getMessage('activeTabsLabel')}</p>
                <span className="stats-icon blue">
                  <TabIcon />
                </span>
              </div>
              <p className="stats-value">{getActiveTabsCount()}</p>
            </div>

            <div className="stats-card">
              <div className="stats-header">
                <p className="stats-label">{getMessage('vectorDocumentsLabel')}</p>
                <span className="stats-icon green">
                  <VectorIcon />
                </span>
              </div>
              <p className="stats-value">{storageStats?.totalDocuments || 0}</p>
            </div>
          </div>

          <ProgressIndicator
            visible={isClearingData && !!clearDataProgress}
            text={clearDataProgress}
            showSpinner={true}
          />

          <button
            className="danger-button"
            disabled={isClearingData}
            onClick={() => setShowClearConfirmation(true)}
          >
            <TrashIcon />
            <span>
              {isClearingData ? getMessage('clearingStatus') : getMessage('clearAllDataButton')}
            </span>
          </button>
        </div>

        {/* Model Cache Management Section */}
        <ModelCacheManagement
          cacheStats={cacheStats}
          isManagingCache={isManagingCache}
          onCleanupCache={cleanupCache}
          onClearAllCache={clearAllCache}
        />
      </div>

      <div className="footer">
        <p className="footer-text">chrome mcp server for ai</p>
      </div>

      <ConfirmDialog
        visible={showClearConfirmation}
        title={getMessage('confirmClearDataTitle')}
        message={getMessage('clearDataWarningMessage')}
        items={[
          getMessage('clearDataList1'),
          getMessage('clearDataList2'),
          getMessage('clearDataList3'),
        ]}
        warning={getMessage('clearDataIrreversibleWarning')}
        icon="⚠️"
        confirmText={getMessage('confirmClearButton')}
        cancelText={getMessage('cancelButton')}
        confirmingText={getMessage('clearingStatus')}
        isConfirming={isClearingData}
        onConfirm={confirmClearAllData}
        onCancel={() => setShowClearConfirmation(false)}
      />
    </div>
  );
};
