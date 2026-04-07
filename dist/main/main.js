//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let path = require("path");
path = __toESM(path);
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_electron_squirrel_startup_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/electron-squirrel-startup/index.js");
_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_electron_squirrel_startup_index_js = __toESM(_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_electron_squirrel_startup_index_js);
//#region src/main/main.ts
var mainWindow = null;
var llamaWindow = null;
var MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5574";
var LLAMA_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5575";
process.on("message", (msg) => {
	if (msg?.type === "MAIN_WINDOW_READY") {
		MAIN_WINDOW_VITE_DEV_SERVER_URL = msg.data.url;
		console.log("Main window URL set to:", MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else if (msg?.type === "LLAMA_WINDOW_READY") {
		LLAMA_WINDOW_VITE_DEV_SERVER_URL = msg.data.url;
		console.log("Llama window URL set to:", LLAMA_WINDOW_VITE_DEV_SERVER_URL);
	}
});
if (_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_electron_squirrel_startup_index_js.default) electron.app.quit();
var createWindow = () => {
	mainWindow = new electron.BrowserWindow({
		width: 1024,
		height: 768,
		webPreferences: {
			preload: path.default.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		console.log("%cMAIN_WINDOW_VITE_DEV_SERVER_URL: %s", "color: cyan;", MAIN_WINDOW_VITE_DEV_SERVER_URL);
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else mainWindow.loadFile(path.default.join(__dirname, `../renderer/main_window/index.html`));
	mainWindow.webContents.openDevTools();
};
function createLlamaWindow() {
	llamaWindow = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Llama Window",
		webPreferences: {
			preload: path.default.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (LLAMA_WINDOW_VITE_DEV_SERVER_URL) {
		console.log("%cLLAMA_WINDOW_VITE_DEV_SERVER_URL: %s", "color: cyan;", LLAMA_WINDOW_VITE_DEV_SERVER_URL);
		llamaWindow.loadURL(LLAMA_WINDOW_VITE_DEV_SERVER_URL);
	} else llamaWindow.loadFile(path.default.join(__dirname, `../renderer/llama-window/index.html`));
}
var menuTemplate = [
	{
		label: "Файл",
		submenu: [{
			label: "Открыть Нейро",
			click: createLlamaWindow
		}, {
			label: "Выйти",
			accelerator: "CmdOrCtrl+Q",
			click: () => electron.app.quit()
		}]
	},
	{
		label: "Правка",
		submenu: [
			{
				label: "Отменить",
				accelerator: "CmdOrCtrl+Z",
				role: "undo"
			},
			{
				label: "Повторить",
				accelerator: "Shift+CmdOrCtrl+Z",
				role: "redo"
			},
			{ type: "separator" },
			{
				label: "Вырезать",
				accelerator: "CmdOrCtrl+X",
				role: "cut"
			},
			{
				label: "Копировать",
				accelerator: "CmdOrCtrl+C",
				role: "copy"
			},
			{
				label: "Вставить",
				accelerator: "CmdOrCtrl+V",
				role: "paste"
			}
		]
	},
	{
		label: "Вид",
		submenu: [{
			label: "Перезагрузить",
			accelerator: "CmdOrCtrl+R",
			role: "reload"
		}, {
			label: "Инструменты разработчика",
			accelerator: process.platform === "darwin" ? "Alt+Cmd+I" : "Ctrl+Shift+I",
			role: "toggleDevTools"
		}]
	},
	{
		label: "Окно",
		submenu: [
			{
				label: "Свернуть",
				accelerator: "CmdOrCtrl+M",
				role: "minimize"
			},
			{
				label: "Увеличить",
				role: "zoom"
			},
			{
				label: "Закрыть",
				accelerator: "CmdOrCtrl+W",
				role: "close"
			}
		],
		role: "windowMenu"
	}
];
var menu = electron.Menu.buildFromTemplate(menuTemplate);
electron.Menu.setApplicationMenu(menu);
electron.app.on("ready", () => {
	electron.session.defaultSession.setCertificateVerifyProc((request, callback) => {
		callback(0);
	});
	createWindow();
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
	if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
electron.ipcMain.handle("open-llama-window", () => {
	if (!llamaWindow) createLlamaWindow();
	else llamaWindow.focus();
});
electron.ipcMain.handle("send-to-llama", async (event, message) => {
	try {
		const response = await callLlamaAPI(message);
		console.log("API response:", response);
		return response;
	} catch (error) {
		console.error("Llama API error:", error);
		throw error;
	}
});
var callLlamaAPI = async (prompt) => {
	const data = await (await fetch("http://localhost:11434/api/generate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: "llama3.2:3b",
			prompt,
			stream: false
		})
	})).json();
	console.log("callLlamaAPI response:", data);
	return data.response || "Нет ответа";
};
//#endregion

//# sourceMappingURL=main.js.map