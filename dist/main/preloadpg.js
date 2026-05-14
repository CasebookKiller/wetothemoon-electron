let electron = require("electron");
//#region src/preloadpg.ts
try {
	electron.contextBridge.exposeInMainWorld("fileAPI", {});
	electron.contextBridge.exposeInMainWorld("electronAPI", {
		ipcRenderer: { invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args) },
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
		getProjectTree: (folderPath) => electron.ipcRenderer.invoke("get-project-tree", folderPath),
		selectFolder: () => electron.ipcRenderer.invoke("select-folder"),
		getPackageDependencies: () => electron.ipcRenderer.invoke("get-package-dependencies"),
		getPackageJson: () => electron.ipcRenderer.invoke("get-package-json"),
		getConfigFile: (fileName, parseJson) => electron.ipcRenderer.invoke("get-config-file", fileName, parseJson),
		getProjectTreeJson: (folderPath) => electron.ipcRenderer.invoke("get-project-tree-json", folderPath)
	});
} catch (e) {
	console.log(e);
}
//#endregion
