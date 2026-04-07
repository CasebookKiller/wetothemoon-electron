let electron = require("electron");
//#region src/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	onLanguageChange: (callback) => {
		electron.ipcRenderer.on("language-changed", (_event, locale) => callback(locale));
	},
	openLlamaWindow: () => electron.ipcRenderer.invoke("open-llama-window"),
	sendMessageToLlama: (message) => electron.ipcRenderer.invoke("send-to-llama", message).then((response) => {
		console.log(response);
		return response;
	}),
	onLlamaResponse: (callback) => electron.ipcRenderer.on("llama-response", (_, data) => callback(data))
});
//#endregion
