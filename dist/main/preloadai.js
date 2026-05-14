let electron = require("electron");
//#region src/preloadai.ts
try {
	electron.contextBridge.exposeInMainWorld("electronAPI", {
		onLanguageChange: (callback) => {
			electron.ipcRenderer.on("language-changed", (_event, locale) => callback(locale));
		},
		openAIWindow: () => electron.ipcRenderer.invoke("open-ai-window"),
		openBondsWindow: () => electron.ipcRenderer.invoke("open-bonds-window"),
		openMDWindow: () => electron.ipcRenderer.invoke("open-md-window"),
		openPGWindow: () => electron.ipcRenderer.invoke("open-pg-window"),
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
		}
	});
} catch (e) {
	console.log(e);
}
//#endregion
