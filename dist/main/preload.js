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
		removeMenuListener: () => electron.ipcRenderer.removeAllListeners("menu-click")
	});
} catch (e) {
	console.log(e);
}
//#endregion
