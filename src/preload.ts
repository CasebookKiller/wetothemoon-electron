import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { FineTuningData, TrainingProgress } from './shared/types/types';

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // ==================== Общие методы (из preload.ts/preloadai.ts) ====================
    onLanguageChange: (callback: (locale: string) => void) => {
      ipcRenderer.on('language-changed', (_event, locale) => callback(locale));
    },
    openAIWindow: () => ipcRenderer.invoke('open-ai-window'),
    openBondsWindow: () => ipcRenderer.invoke('open-bonds-window'),
    openMDWindow: () => ipcRenderer.invoke('open-md-window'),
    openPGWindow: () => ipcRenderer.invoke('open-pg-window'),
    openOllamaWindow: () => ipcRenderer.invoke('open-ollama-window'),
    openTasksWindow: () => ipcRenderer.invoke('open-tasks-window'),
    sendMessageToAI: (message: string) =>
      ipcRenderer.invoke('send-to-ai', message).then((response) => {
        console.log(response);
        return response;
      }),
    onAIResponse: (callback: (data: any) => void) =>
      ipcRenderer.on('ai-response', (_, data) => callback(data)),
    startFineTuning: (data: FineTuningData) =>
      ipcRenderer.invoke('start-fine-tuning', data),
    onTrainingProgress: (callback: (progress: TrainingProgress) => void) =>
      ipcRenderer.on('training-progress', (_, progress: TrainingProgress) => callback(progress)),
    offTrainingProgress: (callback: (event: IpcRendererEvent, progress: TrainingProgress) => void) =>
      ipcRenderer.removeListener('training-progress', callback),
    onMenuClick: (callback: (data: any) => void) => {
      ipcRenderer.on('menu-click', (event, data) => {
        console.log('menu-click: ', data);
        return callback(data);
      });
    },
    removeMenuListener: () => ipcRenderer.removeAllListeners('menu-click'),

    // Методы экспорта чатов (из preloadai.ts)
    onExportCurrentConversatonClick: (callback: (data: any) => void) => {
      ipcRenderer.on('export-current-conversation', (event, data) => {
        console.log('export-current-conversation: ', data);
        return callback(data);
      });
    },
    onExportAllConversationsClick: (callback: (data: any) => void) => {
      ipcRenderer.on('export-all-conversations', (event, data) => {
        console.log('export-all-conversations: ', data);
        return callback(data);
      });
    },
    onBackupToSupabaseClick: (callback: (data: any) => void) => {
      ipcRenderer.on('backup-to-supabase', (event, data) => {
        console.log('backup-to-supabase: ', data);
        return callback(data);
      });
    },
    removeExportCurrentConversationListener: () =>
      ipcRenderer.removeAllListeners('export-current-conversation'),
    removeExportAllConversationsListener: () =>
      ipcRenderer.removeAllListeners('axport-all-conversations'),
    removeBackupToSupabaseListener: () =>
      ipcRenderer.removeAllListeners('backup-to-supabase'),

    // Работа с файлами (объединено из preloadai.ts и preloadpg.ts)
    openFilePicker: async (): Promise<string[] | null> => {
      try {
        const result = await ipcRenderer.invoke('open-file-picker');
        return result;
      } catch (error) {
        console.error('Ошибка при вызове диалога выбора файлов:', error);
        return null;
      }
    },
    readFilesContents: async (filePaths: string[]): Promise<{ path: string; content: string }[]> => {
      try {
        const contents = await ipcRenderer.invoke('read-files-contents', filePaths);
        return contents;
      } catch (error) {
        console.error('Ошибка при чтении файлов:', error);
        throw error;
      }
    },
    onFilePickerResult: (callback: (files: string[] | null) => void) => {
      ipcRenderer.on('file-picker-result', (event, files: string[] | null) => {
        callback(files);
      });
    },

    // ==================== Методы стримов (из preloadbonds.ts) ====================
    // MarketDataStream
    startMarketStream: (token: string, body: any) =>
      ipcRenderer.invoke('md-stream-start', token, body),
    stopMarketStream: () => ipcRenderer.invoke('md-stream-stop'),
    onMarketData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('md-stream-data');
      ipcRenderer.on('md-stream-data', (_, data: string) => callback(data));
    },
    onMarketClosed: (callback: () => void) => {
      ipcRenderer.removeAllListeners('md-stream-closed');
      ipcRenderer.on('md-stream-closed', callback);
    },
    onMarketError: (callback: (err: string) => void) => {
      ipcRenderer.removeAllListeners('md-stream-error');
      ipcRenderer.on('md-stream-error', (_, err: string) => callback(err));
    },

    // OperationsStream
    startOpsStream: (streamType: string, token: string, body: any) =>
      ipcRenderer.invoke('ops-stream-start', streamType, token, body),
    stopOpsStream: () => ipcRenderer.invoke('ops-stream-stop'),
    onOpsPortfolioData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('ops-portfolio-data');
      ipcRenderer.on('ops-portfolio-data', (_, data: string) => callback(data));
    },
    onOpsPositionsData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('ops-positions-data');
      ipcRenderer.on('ops-positions-data', (_, data: string) => callback(data));
    },
    onOpsOperationsData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('ops-operations-data');
      ipcRenderer.on('ops-operations-data', (_, data: string) => callback(data));
    },
    onOpsStreamClosed: (callback: (streamType: string) => void) => {
      ipcRenderer.removeAllListeners('ops-portfolio-closed');
      ipcRenderer.removeAllListeners('ops-positions-closed');
      ipcRenderer.removeAllListeners('ops-operations-closed');
      ipcRenderer.on('ops-portfolio-closed', () => callback('portfolio'));
      ipcRenderer.on('ops-positions-closed', () => callback('positions'));
      ipcRenderer.on('ops-operations-closed', () => callback('operations'));
    },
    onOpsStreamError: (callback: (streamType: string, err: string) => void) => {
      ipcRenderer.removeAllListeners('ops-stream-error');
      ipcRenderer.on('ops-stream-error', (_, streamType: string, err: string) =>
        callback(streamType, err),
      );
    },

    // OrdersStream
    startOrdersStream: (streamType: string, token: string, body: any) =>
      ipcRenderer.invoke('orders-stream-start', streamType, token, body),
    stopOrdersStream: () => ipcRenderer.invoke('orders-stream-stop'),
    onOrdersTradesData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('orders-trades-data');
      ipcRenderer.on('orders-trades-data', (_, data: string) => callback(data));
    },
    onOrdersOrderStateData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('orders-orderState-data');
      ipcRenderer.on('orders-orderState-data', (_, data: string) => callback(data));
    },
    onOrdersStreamClosed: (callback: (streamType: string) => void) => {
      ipcRenderer.removeAllListeners('orders-trades-closed');
      ipcRenderer.removeAllListeners('orders-orderState-closed');
      ipcRenderer.on('orders-trades-closed', () => callback('trades'));
      ipcRenderer.on('orders-orderState-closed', () => callback('orderState'));
    },
    onOrdersStreamError: (callback: (streamType: string, err: string) => void) => {
      ipcRenderer.removeAllListeners('orders-stream-error');
      ipcRenderer.on('orders-stream-error', (_, streamType: string, err: string) =>
        callback(streamType, err),
      );
    },

    // Универсальный вызов Grpc
    callGrpc: (service: string, method: string, token: string, request?: unknown) =>
    ipcRenderer.invoke('grpc-call', service, method, token, request),

    // ==================== Методы PG (из preloadpg.ts) ====================
    // Универсальный invoke (осторожно, доступен всем окнам!)
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    },
    getProjectTree: (folderPath: string) =>
      ipcRenderer.invoke('get-project-tree', folderPath),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getPackageDependencies: () => ipcRenderer.invoke('get-package-dependencies'),
    getPackageJson: () => ipcRenderer.invoke('get-package-json'),
    getConfigFile: (fileName: string, parseJson?: boolean) =>
      ipcRenderer.invoke('get-config-file', fileName, parseJson),
    getProjectTreeJson: (folderPath?: string) =>
      ipcRenderer.invoke('get-project-tree-json', folderPath),

    // Планировщик
    tasks: {
      getAll: () => ipcRenderer.invoke('tasks:getAll'),
      add: (taskData: any) => ipcRenderer.invoke('tasks:add', taskData),
      update: (task: any) => ipcRenderer.invoke('tasks:update', task),
      delete: (id: string) => ipcRenderer.invoke('tasks:delete', id),
      openWindow: () => ipcRenderer.invoke('tasks:open-window'),
      onCommand: (callback: (cmd: string, args: any) => void) => { /* ... */ },
    },

    // Методы для Trading Assistant
    getVolumeProfile: (instrumentUid: string) => ipcRenderer.invoke('trading-assistant:get-profile', instrumentUid),
    subscribeTradingAssistant: () => ipcRenderer.send('trading-assistant:subscribe'),
    onProfileUpdate: (callback: (profile: any) => void) => {
      ipcRenderer.on('trading-assistant:profile-update', (_, data) => callback(data));
    },
    onTradingSignal: (callback: (signal: any) => void) => {
      ipcRenderer.on('trading-assistant:signal', (_, data) => callback(data));
    },
    removeProfileUpdateListener: () => ipcRenderer.removeAllListeners('trading-assistant:profile-update'),
    removeTradingSignalListener: () => ipcRenderer.removeAllListeners('trading-assistant:signal'),
    runBacktest: (uid: string, dateFrom: string, dateTo: string, interval: string, token: string, params: any) =>
      ipcRenderer.invoke('trading-assistant:run-backtest', uid, dateFrom, dateTo, interval, token, params),

    toggleAutoTrading: (enabled: boolean) => ipcRenderer.invoke('trading-assistant:toggle-trading', enabled),
    getTradingStatus: () => ipcRenderer.invoke('trading-assistant:get-trading-status'),
    setLotQuantity: (qty: number) => ipcRenderer.invoke('trading-assistant:set-lot-quantity', qty),

    sendBacktestSignals: (signals: any[]) => ipcRenderer.invoke('trading-assistant:send-backtest-signals', signals),

    getSandboxAccounts: (token: string) => ipcRenderer.invoke('trading-assistant:get-accounts', token),
    createSandboxAccount: () => ipcRenderer.invoke('trading-assistant:create-account'),
    closeSandboxAccount: (accountId: string) => ipcRenderer.invoke('trading-assistant:close-account', accountId),

    payInSandbox: (amount: number, accountId: string) => ipcRenderer.invoke('trading-assistant:pay-in', amount, accountId),
    getBalance: (accountId: string) => ipcRenderer.invoke('trading-assistant:get-balance', accountId),

    updateTradingConfig: (config: any) => ipcRenderer.invoke('trading-assistant:update-config', config),
  });

  // Отдельный fileAPI (пустой, но оставлен для обратной совместимости)
  contextBridge.exposeInMainWorld('fileAPI', {
    // пока пусто, можно удалить позже
  });
} catch (e) {
  console.log(e);
}