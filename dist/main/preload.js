let electron = require("electron");
//#region src/preload.ts
try {
	electron.contextBridge.exposeInMainWorld("electronAPI", {
		onLanguageChange: (callback) => {
			electron.ipcRenderer.on("language-changed", (_event, locale) => callback(locale));
		},
		openAIWindow: () => electron.ipcRenderer.invoke("open-ai-window"),
		openBondsWindow: () => electron.ipcRenderer.invoke("open-bonds-window"),
		openMDWindow: () => electron.ipcRenderer.invoke("open-md-window"),
		openPGWindow: () => electron.ipcRenderer.invoke("open-pg-window"),
		openOllamaWindow: () => electron.ipcRenderer.invoke("open-ollama-window"),
		openTasksWindow: () => electron.ipcRenderer.invoke("open-tasks-window"),
		sendMessageToAI: (message) => electron.ipcRenderer.invoke("send-to-ai", message).then((response) => {
			console.log(response);
			return response;
		}),
		onAIResponse: (callback) => electron.ipcRenderer.on("ai-response", (_, data) => callback(data)),
		startFineTuning: (data) => electron.ipcRenderer.invoke("start-fine-tuning", data),
		onTrainingProgress: (callback) => electron.ipcRenderer.on("training-progress", (_, progress) => callback(progress)),
		offTrainingProgress: (callback) => electron.ipcRenderer.removeListener("training-progress", callback),
		onMenuClick: (callback) => {
			electron.ipcRenderer.on("menu-click", (event, data) => {
				console.log("menu-click: ", data);
				return callback(data);
			});
		},
		removeMenuListener: () => electron.ipcRenderer.removeAllListeners("menu-click"),
		onExportCurrentConversatonClick: (callback) => {
			electron.ipcRenderer.on("export-current-conversation", (event, data) => {
				console.log("export-current-conversation: ", data);
				return callback(data);
			});
		},
		onExportAllConversationsClick: (callback) => {
			electron.ipcRenderer.on("export-all-conversations", (event, data) => {
				console.log("export-all-conversations: ", data);
				return callback(data);
			});
		},
		onBackupToSupabaseClick: (callback) => {
			electron.ipcRenderer.on("backup-to-supabase", (event, data) => {
				console.log("backup-to-supabase: ", data);
				return callback(data);
			});
		},
		removeExportCurrentConversationListener: () => electron.ipcRenderer.removeAllListeners("export-current-conversation"),
		removeExportAllConversationsListener: () => electron.ipcRenderer.removeAllListeners("axport-all-conversations"),
		removeBackupToSupabaseListener: () => electron.ipcRenderer.removeAllListeners("backup-to-supabase"),
		openFilePicker: async () => {
			try {
				return await electron.ipcRenderer.invoke("open-file-picker");
			} catch (error) {
				console.error("Ошибка при вызове диалога выбора файлов:", error);
				return null;
			}
		},
		readFilesContents: async (filePaths) => {
			try {
				return await electron.ipcRenderer.invoke("read-files-contents", filePaths);
			} catch (error) {
				console.error("Ошибка при чтении файлов:", error);
				throw error;
			}
		},
		onFilePickerResult: (callback) => {
			electron.ipcRenderer.on("file-picker-result", (event, files) => {
				callback(files);
			});
		},
		startMarketStream: (token, body) => electron.ipcRenderer.invoke("md-stream-start", token, body),
		stopMarketStream: () => electron.ipcRenderer.invoke("md-stream-stop"),
		onMarketData: (callback) => {
			electron.ipcRenderer.removeAllListeners("md-stream-data");
			electron.ipcRenderer.on("md-stream-data", (_, data) => callback(data));
		},
		onMarketClosed: (callback) => {
			electron.ipcRenderer.removeAllListeners("md-stream-closed");
			electron.ipcRenderer.on("md-stream-closed", callback);
		},
		onMarketError: (callback) => {
			electron.ipcRenderer.removeAllListeners("md-stream-error");
			electron.ipcRenderer.on("md-stream-error", (_, err) => callback(err));
		},
		startOpsStream: (streamType, token, body) => electron.ipcRenderer.invoke("ops-stream-start", streamType, token, body),
		stopOpsStream: () => electron.ipcRenderer.invoke("ops-stream-stop"),
		onOpsPortfolioData: (callback) => {
			electron.ipcRenderer.removeAllListeners("ops-portfolio-data");
			electron.ipcRenderer.on("ops-portfolio-data", (_, data) => callback(data));
		},
		onOpsPositionsData: (callback) => {
			electron.ipcRenderer.removeAllListeners("ops-positions-data");
			electron.ipcRenderer.on("ops-positions-data", (_, data) => callback(data));
		},
		onOpsOperationsData: (callback) => {
			electron.ipcRenderer.removeAllListeners("ops-operations-data");
			electron.ipcRenderer.on("ops-operations-data", (_, data) => callback(data));
		},
		onOpsStreamClosed: (callback) => {
			electron.ipcRenderer.removeAllListeners("ops-portfolio-closed");
			electron.ipcRenderer.removeAllListeners("ops-positions-closed");
			electron.ipcRenderer.removeAllListeners("ops-operations-closed");
			electron.ipcRenderer.on("ops-portfolio-closed", () => callback("portfolio"));
			electron.ipcRenderer.on("ops-positions-closed", () => callback("positions"));
			electron.ipcRenderer.on("ops-operations-closed", () => callback("operations"));
		},
		onOpsStreamError: (callback) => {
			electron.ipcRenderer.removeAllListeners("ops-stream-error");
			electron.ipcRenderer.on("ops-stream-error", (_, streamType, err) => callback(streamType, err));
		},
		startOrdersStream: (streamType, token, body) => electron.ipcRenderer.invoke("orders-stream-start", streamType, token, body),
		stopOrdersStream: () => electron.ipcRenderer.invoke("orders-stream-stop"),
		onOrdersTradesData: (callback) => {
			electron.ipcRenderer.removeAllListeners("orders-trades-data");
			electron.ipcRenderer.on("orders-trades-data", (_, data) => callback(data));
		},
		onOrdersOrderStateData: (callback) => {
			electron.ipcRenderer.removeAllListeners("orders-orderState-data");
			electron.ipcRenderer.on("orders-orderState-data", (_, data) => callback(data));
		},
		onOrdersStreamClosed: (callback) => {
			electron.ipcRenderer.removeAllListeners("orders-trades-closed");
			electron.ipcRenderer.removeAllListeners("orders-orderState-closed");
			electron.ipcRenderer.on("orders-trades-closed", () => callback("trades"));
			electron.ipcRenderer.on("orders-orderState-closed", () => callback("orderState"));
		},
		onOrdersStreamError: (callback) => {
			electron.ipcRenderer.removeAllListeners("orders-stream-error");
			electron.ipcRenderer.on("orders-stream-error", (_, streamType, err) => callback(streamType, err));
		},
		callGrpc: (service, method, token, request) => electron.ipcRenderer.invoke("grpc-call", service, method, token, request),
		ipcRenderer: { invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args) },
		getProjectTree: (folderPath) => electron.ipcRenderer.invoke("get-project-tree", folderPath),
		selectFolder: () => electron.ipcRenderer.invoke("select-folder"),
		getPackageDependencies: () => electron.ipcRenderer.invoke("get-package-dependencies"),
		getPackageJson: () => electron.ipcRenderer.invoke("get-package-json"),
		getConfigFile: (fileName, parseJson) => electron.ipcRenderer.invoke("get-config-file", fileName, parseJson),
		getProjectTreeJson: (folderPath) => electron.ipcRenderer.invoke("get-project-tree-json", folderPath),
		tasks: {
			getAll: () => electron.ipcRenderer.invoke("tasks:getAll"),
			add: (taskData) => electron.ipcRenderer.invoke("tasks:add", taskData),
			update: (task) => electron.ipcRenderer.invoke("tasks:update", task),
			delete: (id) => electron.ipcRenderer.invoke("tasks:delete", id),
			openWindow: () => electron.ipcRenderer.invoke("tasks:open-window"),
			onCommand: (callback) => {}
		},
		getVolumeProfile: (instrumentUid) => electron.ipcRenderer.invoke("trading-assistant:get-profile", instrumentUid),
		subscribeTradingAssistant: () => electron.ipcRenderer.send("trading-assistant:subscribe"),
		onProfileUpdate: (callback) => {
			electron.ipcRenderer.on("trading-assistant:profile-update", (_, data) => callback(data));
		},
		onTradingSignal: (callback) => {
			electron.ipcRenderer.on("trading-assistant:signal", (_, data) => callback(data));
		},
		removeProfileUpdateListener: () => electron.ipcRenderer.removeAllListeners("trading-assistant:profile-update"),
		removeTradingSignalListener: () => electron.ipcRenderer.removeAllListeners("trading-assistant:signal"),
		runBacktest: (uid, dateFrom, dateTo, interval, token, params) => electron.ipcRenderer.invoke("trading-assistant:run-backtest", uid, dateFrom, dateTo, interval, token, params),
		toggleAutoTrading: (enabled) => electron.ipcRenderer.invoke("trading-assistant:toggle-trading", enabled),
		getTradingStatus: () => electron.ipcRenderer.invoke("trading-assistant:get-trading-status"),
		setLotQuantity: (qty) => electron.ipcRenderer.invoke("trading-assistant:set-lot-quantity", qty),
		sendBacktestSignals: (signals) => electron.ipcRenderer.invoke("trading-assistant:send-backtest-signals", signals),
		getSandboxAccounts: (token) => electron.ipcRenderer.invoke("trading-assistant:get-accounts", token),
		createSandboxAccount: () => electron.ipcRenderer.invoke("trading-assistant:create-account"),
		closeSandboxAccount: (accountId) => electron.ipcRenderer.invoke("trading-assistant:close-account", accountId),
		payInSandbox: (amount, accountId) => electron.ipcRenderer.invoke("trading-assistant:pay-in", amount, accountId),
		getBalance: (accountId) => electron.ipcRenderer.invoke("trading-assistant:get-balance", accountId),
		updateTradingConfig: (config) => electron.ipcRenderer.invoke("trading-assistant:update-config", config),
		onCandle: (callback) => {
			electron.ipcRenderer.on("candle-data", (_, candle) => callback(candle));
		},
		removeCandleListener: () => electron.ipcRenderer.removeAllListeners("candle-data"),
		onLastPrice: (callback) => {
			electron.ipcRenderer.on("last-price-data", (_, data) => callback(data));
		},
		removeLastPriceListener: () => electron.ipcRenderer.removeAllListeners("last-price-data"),
		getTodayCandles: (instrumentUid, token, interval) => electron.ipcRenderer.invoke("trading-assistant:get-today-candles", instrumentUid, token, interval),
		loadHistoricalProfile: (instrumentUid, candles) => electron.ipcRenderer.invoke("trading-assistant:load-historical-profile", instrumentUid, candles),
		getAllInstruments: (token) => electron.ipcRenderer.invoke("trading-assistant:get-all-instruments", token),
		batchBacktest: (instrumentUids, dateFrom, dateTo, interval, token, paramSets, strategyType, profileResolution, valueAreaPercent) => electron.ipcRenderer.invoke("trading-assistant:batch-backtest", instrumentUids, dateFrom, dateTo, interval, token, paramSets, strategyType, profileResolution, valueAreaPercent),
		batchV2: (instrumentUids, dateFrom, dateTo, interval, token, paramSets, strategyType, profileResolution, valueAreaPercent) => electron.ipcRenderer.invoke("trading-assistant:batch-v2", instrumentUids, dateFrom, dateTo, interval, token, paramSets, strategyType, profileResolution, valueAreaPercent),
		stopBatch: () => electron.ipcRenderer.invoke("trading-assistant:batch-stop"),
		onBatchProgress: (callback) => {
			electron.ipcRenderer.on("trading-assistant:batch-progress", (_, data) => callback(data));
		},
		onBatchComplete: (callback) => {
			electron.ipcRenderer.on("trading-assistant:batch-complete", (_, data) => callback(data));
		},
		removeBatchListeners: () => {
			electron.ipcRenderer.removeAllListeners("trading-assistant:batch-progress");
			electron.ipcRenderer.removeAllListeners("trading-assistant:batch-complete");
		},
		getPositions: (accountId) => electron.ipcRenderer.invoke("trading-assistant:get-positions", accountId),
		getOrders: (accountId) => electron.ipcRenderer.invoke("trading-assistant:get-orders", accountId),
		cancelOrder: (orderId, accountId) => electron.ipcRenderer.invoke("trading-assistant:cancel-order", orderId, accountId),
		closePosition: (instrumentUid, accountId, quantity, direction) => electron.ipcRenderer.invoke("trading-assistant:close-position", instrumentUid, accountId, quantity, direction),
		getOperations: (accountId, from, to, cursor) => electron.ipcRenderer.invoke("trading-assistant:get-operations", accountId, from, to, cursor),
		saveJson: (data, defaultName) => electron.ipcRenderer.invoke("trading-assistant:save-json", data, defaultName),
		screenerRun: (filters, token) => electron.ipcRenderer.invoke("trading-assistant:screener-run", filters, token),
		onSystemMemory: (callback) => {
			electron.ipcRenderer.on("system:memory", (_, data) => callback(data));
		},
		cloudCreateTask: (serverUrl, instrumentUid, dateFrom, dateTo, interval, strategy, params) => electron.ipcRenderer.invoke("cloud:createTask", serverUrl, instrumentUid, dateFrom, dateTo, interval, strategy, params),
		cloudGetTaskStatus: (taskId) => electron.ipcRenderer.invoke("cloud:getTaskStatus", taskId),
		cloudGetTaskResult: (taskId) => electron.ipcRenderer.invoke("cloud:getTaskResult", taskId),
		cloudGetTasks: () => electron.ipcRenderer.invoke("cloud:getTasks"),
		cloudTestConnection: (url) => electron.ipcRenderer.invoke("cloud:testConnection", url),
		getMarketPhase: (instrumentUid) => electron.ipcRenderer.invoke("trading-assistant:get-market-phase", instrumentUid),
		getOrderFlowDelta: (instrumentUid) => electron.ipcRenderer.invoke("trading-assistant:get-orderflow-delta", instrumentUid),
		getCompositeProfile: (instrumentUid, days, token) => electron.ipcRenderer.invoke("trading-assistant:composite-profile", instrumentUid, days, token),
		cloudCreateBatch: (batchConfig) => electron.ipcRenderer.invoke("cloud:createBatch", batchConfig),
		cloudGetBatchStatus: (serverUrl, batchId) => electron.ipcRenderer.invoke("cloud:getBatchStatus", serverUrl, batchId),
		cloudGetBatchResults: (serverUrl, batchId) => electron.ipcRenderer.invoke("cloud:getBatchResults", serverUrl, batchId),
		cloudGetInstruments: (serverUrl) => electron.ipcRenderer.invoke("cloud:getInstruments", serverUrl),
		cloudGetBatches: (serverUrl) => electron.ipcRenderer.invoke("cloud:getBatches", serverUrl),
		cloudDeleteBatch: (serverUrl, batchId) => electron.ipcRenderer.invoke("cloud:deleteBatch", serverUrl, batchId),
		cloudGetSchedulerTasks: (serverUrl) => electron.ipcRenderer.invoke("cloud:getSchedulerTasks", serverUrl),
		cloudAddSchedulerTask: (serverUrl, task) => electron.ipcRenderer.invoke("cloud:addSchedulerTask", serverUrl, task),
		cloudDeleteSchedulerTask: (serverUrl, id) => electron.ipcRenderer.invoke("cloud:deleteSchedulerTask", serverUrl, id),
		startAutoTrader: (instrumentUid) => electron.ipcRenderer.invoke("trading-assistant:start-auto-trader", instrumentUid),
		stopAutoTrader: (instrumentUid) => electron.ipcRenderer.invoke("trading-assistant:stop-auto-trader", instrumentUid),
		getActiveAutoTraders: () => electron.ipcRenderer.invoke("trading-assistant:get-active-auto-traders"),
		onAutoTraderSignal: (callback) => {
			electron.ipcRenderer.on("auto-trader:signal", (_, data) => callback(data));
		},
		onAutoTraderOrderSent: (callback) => {
			electron.ipcRenderer.on("auto-trader:order-sent", (_, data) => callback(data));
		},
		onAutoTraderOrderError: (callback) => {
			electron.ipcRenderer.on("auto-trader:order-error", (_, data) => callback(data));
		},
		removeAutoTraderListeners: () => {
			electron.ipcRenderer.removeAllListeners("auto-trader:signal");
			electron.ipcRenderer.removeAllListeners("auto-trader:order-sent");
			electron.ipcRenderer.removeAllListeners("auto-trader:order-error");
		}
	});
	electron.contextBridge.exposeInMainWorld("fileAPI", {});
} catch (e) {
	console.log(e);
}
//#endregion
