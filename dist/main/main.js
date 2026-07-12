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
require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/dotenv/config.js");
let electron = require("electron");
let path = require("path");
path = __toESM(path);
let child_process = require("child_process");
let fs_promises = require("fs/promises");
fs_promises = __toESM(fs_promises);
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/@grpc/grpc-js/build/src/index.js");
_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js = __toESM(_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js);
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/@grpc/proto-loader/build/src/index.js");
_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js = __toESM(_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js);
let events = require("events");
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/fs-extra/lib/index.js");
_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js = __toESM(_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js);
let fs = require("fs");
fs = __toESM(fs);
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_uuid_dist_node_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/uuid/dist-node/index.js");
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_node_cron_dist_esm_node_cron_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/node-cron/dist/esm/node-cron.js");
_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_node_cron_dist_esm_node_cron_js = __toESM(_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_node_cron_dist_esm_node_cron_js);
//#region src/main/windows/mainWindow.ts
var mainWindow = null;
var preloadPath$7 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5173";
path.default.join(__dirname, "../../renderer/main-window/index.html");
var createMainWindow = () => {
	mainWindow = new electron.BrowserWindow({
		width: 1024,
		height: 768,
		title: "Мы на Луну!",
		webPreferences: {
			preload: preloadPath$7,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	mainWindow.webContents.openDevTools();
	mainWindow.webContents.openDevTools();
	return mainWindow;
};
//#endregion
//#region src/main/windows/paths.ts
var DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
function getMainWindowProdPath() {
	if (electron.app.isPackaged) return path.default.join(process.resourcesPath, "index.html");
	return path.default.join(__dirname, "../../renderer/index.html");
}
//#endregion
//#region src/main/windows/aiWindow.ts
var aiWindow = null;
var preloadPath$6 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createAIWindow = () => {
	console.log("createAIWindow called");
	aiWindow = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Нейро",
		webPreferences: {
			preload: preloadPath$6,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.NODE_ENV !== "production") aiWindow.loadURL(`${DEV_SERVER_URL}/#/ai`);
	else aiWindow.loadFile(getMainWindowProdPath());
	aiWindow.on("closed", () => {
		aiWindow = null;
	});
	return aiWindow;
};
var getAIWindow = () => aiWindow;
var callAIAPI = async (prompt) => {
	const data = await (await fetch("http://localhost:11434/api/generate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: "t-tech/T-lite-it-2.1:q4_K_M",
			prompt,
			stream: false
		})
	})).json();
	console.log("callAIAPI response:", data);
	return data.response || "Нет ответа";
};
var registerAIHandlers = () => {
	electron.ipcMain.handle("send-to-ai", async (event, message) => {
		try {
			const response = await callAIAPI(message);
			console.log("API response:", response);
			return response;
		} catch (error) {
			console.error("AI API error:", error);
			throw error;
		}
	});
	electron.ipcMain.handle("save-ai-result", (event) => {
		const window = electron.BrowserWindow.fromWebContents(event.sender);
		console.log("Saving AI result from:", window?.title);
	});
};
//#endregion
//#region src/main/training.ts
var AITrainer = class {
	pythonPath;
	constructor() {
		this.pythonPath = this.detectPython();
	}
	detectPython() {
		if (process.platform === "win32") return "python";
		return "python3";
	}
	async startFineTuning(data) {
		return new Promise((resolve) => {
			if (!data.dataPath || !data.modelName || !data.outputDir) {
				resolve({
					status: "error",
					message: "Недостаточно данных для дообучения"
				});
				return;
			}
			const args = [
				path.join(__dirname, "../../training/scripts/fine_tune_llama.py"),
				"--data-path",
				data.dataPath,
				"--model-name",
				data.modelName,
				"--output-dir",
				data.outputDir
			];
			const child = (0, child_process.exec)(`${this.pythonPath} ${args.join(" ")}`);
			child.stdout?.on("data", (data) => {
				const progress = this.parseProgress(data.toString());
				if (progress) electron.ipcMain.emit("training-progress", progress);
			});
			child.stderr?.on("data", (data) => {
				console.error(`[Training Error] ${data}`);
				electron.ipcMain.emit("training-progress", {
					status: "error",
					message: data.toString(),
					progress: 0
				});
			});
			child.on("close", (code) => {
				if (code === 0) resolve({
					status: "completed",
					outputDir: data.outputDir,
					message: "Дообучение завершено успешно"
				});
				else resolve({
					status: "error",
					message: `Процесс завершился с кодом ${code}`
				});
			});
			child.on("error", (error) => {
				resolve({
					status: "error",
					message: error.message
				});
			});
		});
	}
	parseProgress(output) {
		const match = output.match(/Progress:\s*(\d+)%/);
		if (match) {
			const progress = parseInt(match[1], 10);
			return {
				status: "processing",
				progress,
				message: `Прогресс: ${progress}%`
			};
		}
		return null;
	}
};
//#endregion
//#region src/main/ipcHandlers/trainingHandlers.ts
var registerTrainingHandlers = () => {
	electron.ipcMain.handle("start-fine-tuning", async (event, data) => {
		try {
			for (let i = 0; i <= 100; i += 10) {
				event.sender.send("training-progress", {
					status: `Обработка данных...`,
					progress: i
				});
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
			return {
				status: "completed",
				outputDir: data.outputDir
			};
		} catch (error) {
			return {
				status: "error",
				message: error.message
			};
		}
	});
};
new AITrainer();
//#endregion
//#region src/main/menus/windowMenus.ts
var mainMenuTemplate = [
	{
		label: "Файл",
		submenu: [
			{
				label: "Открыть Нейро",
				id: "open-ai"
			},
			{
				label: "Открыть Markdown",
				id: "open-md"
			},
			{
				label: "Открыть Облигации",
				id: "open-bonds"
			},
			{
				label: "Открыть Генератор запросов",
				id: "open-pg"
			},
			{
				label: "Открыть Трейдер",
				id: "open-trading"
			},
			{ type: "separator" },
			{
				label: "Выйти",
				click: () => electron.app.quit(),
				accelerator: "CmdOrCtrl+Q"
			}
		]
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
var aiWindowMenuTemplate = [
	{
		label: "Нейро",
		submenu: [
			{
				label: "Сохранить результат",
				click: () => {
					const windows = electron.BrowserWindow.getAllWindows();
					if (windows.length > 0) windows[0].webContents.send("save-ai-result");
				}
			},
			{
				label: "Очистить историю",
				click: () => {
					const windows = electron.BrowserWindow.getAllWindows();
					if (windows.length > 0) windows[0].webContents.send("clear-ai-history");
				}
			},
			{ type: "separator" },
			{
				label: "Экспорт текущего диалога",
				click: () => {
					electron.BrowserWindow.getAllWindows().find((w) => w.title === "Нейро")?.webContents.send("export-current-conversation", {
						action: "send-data",
						timestamp: Date.now(),
						message: "Выбран пункт меню \"Экспорт текущего диалога\"!"
					});
					console.log("Выбран пункт меню \"Экспорт текущего диалога\" - для отправки сообщения React");
				}
			},
			{
				label: "Экспорт всех диалогов",
				click: () => {
					getAIWindow()?.webContents.send("export-all-conversations", {
						action: "send-data",
						timestamp: Date.now(),
						message: "Выбран пункт меню \"Экспорт всех диалогов\"!"
					});
					console.log("Выбран пункт меню \"Экспорт всех диалогов\" - для отправки сообщения React");
				}
			},
			{
				label: "Сохранить в Supabase",
				click: () => {
					getAIWindow()?.webContents.send("backup-to-supabase", {
						action: "send-data",
						timestamp: Date.now(),
						message: "Выбран пункт меню \"Сохранить в Supabase\"!"
					});
					console.log("Выбран пункт меню \"Сохранить в Supabase\" - для отправки сообщения React");
				}
			},
			{ type: "separator" },
			{
				label: "Закрыть окно",
				accelerator: "CmdOrCtrl+W",
				role: "close"
			}
		]
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
var mdWindowMenuTemplate = [
	{
		label: "Markdown-окно",
		submenu: [
			{
				label: "Экспорт в PDF",
				click: () => {
					const windows = electron.BrowserWindow.getAllWindows();
					if (windows.length > 0) windows[0].webContents.send("export-md-to-pdf");
				}
			},
			{
				label: "Превью",
				click: () => {
					const windows = electron.BrowserWindow.getAllWindows();
					if (windows.length > 0) windows[0].webContents.send("toggle-md-preview");
				}
			},
			{ type: "separator" },
			{
				label: "Закрыть окно",
				accelerator: "CmdOrCtrl+W",
				role: "close"
			}
		]
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
var bondsWindowMenuTemplate = [
	{
		label: "Облигации",
		submenu: [
			{
				label: "Экспорт в JSON",
				click: () => {
					const windows = electron.BrowserWindow.getAllWindows();
					if (windows.length > 0) windows[0].webContents.send("export-bonds-to-json");
				}
			},
			{ type: "separator" },
			{
				label: "Закрыть окно",
				accelerator: "CmdOrCtrl+W",
				role: "close"
			}
		]
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
var tasksWindowMenuTemplate = [{
	label: "Файл",
	submenu: [{
		label: "Закрыть окно",
		role: "close"
	}]
}, {
	label: "Вид",
	submenu: [{
		label: "Обновить",
		accelerator: "CmdOrCtrl+R",
		click: (item, focusedWindow) => {
			const windows = electron.BrowserWindow.getAllWindows();
			if (windows.length > 0) {
				windows[0].webContents.send("task:react-command", "refresh", {});
				console.log("[tasksWindowMenuTemplate] Обновить");
			}
		}
	}]
}];
var tradingAssistantWindowMenuTemplate = [{
	label: "Файл",
	submenu: [{ role: "close" }]
}, {
	label: "Вид",
	submenu: [
		{ role: "reload" },
		{ role: "forceReload" },
		{ role: "toggleDevTools" },
		{ type: "separator" },
		{ role: "resetZoom" },
		{ role: "zoomIn" },
		{ role: "zoomOut" },
		{ type: "separator" },
		{ role: "togglefullscreen" }
	]
}];
//#endregion
//#region src/main/windows/bondsWindow.ts
var bondsWindow$1 = null;
var preloadPath$5 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createBondsWindow = () => {
	bondsWindow$1 = new electron.BrowserWindow({
		width: 1024,
		height: 768,
		title: "Облигации",
		webPreferences: {
			preload: preloadPath$5,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.NODE_ENV === "development") bondsWindow$1.loadURL(`${DEV_SERVER_URL}/#/bonds`);
	else bondsWindow$1.loadFile(getMainWindowProdPath());
	const menu = electron.Menu.buildFromTemplate(bondsWindowMenuTemplate);
	bondsWindow$1.setMenu(menu);
	bondsWindow$1.on("closed", () => {
		bondsWindow$1 = null;
	});
	return bondsWindow$1;
};
var getBondsWindow = () => bondsWindow$1;
//#endregion
//#region src/main/windows/mdWindow.ts
var mdWindow$1 = null;
var preloadPath$4 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createMDWindow = () => {
	mdWindow$1 = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Markdown",
		webPreferences: {
			preload: preloadPath$4,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.NODE_ENV === "development") mdWindow$1.loadURL(`${DEV_SERVER_URL}/#/md`);
	else mdWindow$1.loadFile(getMainWindowProdPath());
	mdWindow$1.on("closed", () => {
		mdWindow$1 = null;
	});
	return mdWindow$1;
};
var getMDWindow = () => mdWindow$1;
//#endregion
//#region src/main/windows/pgWindow.ts
var pgWindow$1 = null;
var preloadPath$3 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createPGWindow = () => {
	pgWindow$1 = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Генератор запросов",
		webPreferences: {
			preload: preloadPath$3,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.NODE_ENV === "development") pgWindow$1.loadURL(`${DEV_SERVER_URL}/#/pg`);
	else pgWindow$1.loadFile(getMainWindowProdPath());
	pgWindow$1.on("closed", () => {
		pgWindow$1 = null;
	});
	return pgWindow$1;
};
var getPGWindow = () => pgWindow$1;
//#endregion
//#region src/main/windows/ollamaWindow.ts
var ollamaWindow$1 = null;
var preloadPath$2 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createOllamaWindow = () => {
	if (ollamaWindow$1) {
		ollamaWindow$1.focus();
		return;
	}
	ollamaWindow$1 = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Клиент Ollama ",
		webPreferences: {
			preload: preloadPath$2,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.NODE_ENV === "development") ollamaWindow$1.loadURL(`${DEV_SERVER_URL}/#/ollama`);
	else ollamaWindow$1.loadFile(getMainWindowProdPath());
	ollamaWindow$1.on("closed", () => {
		ollamaWindow$1 = null;
	});
};
var getOllamaWindow = () => ollamaWindow$1;
var registerBondsHandlers = () => {
	electron.ipcMain.handle("save-bonds-to-storage", async (event, message) => {
		try {
			return {};
		} catch (error) {
			console.error("AI API error:", error);
			throw error;
		}
	});
};
//#endregion
//#region src/main/ipcHandlers/dashboardHandlers.ts
var registerDashboardHandlers = (mainWindow) => {
	electron.ipcMain.handle("get-tasks", async (event, message) => {
		try {
			return {};
		} catch (error) {
			console.error("AI API error:", error);
			throw error;
		}
	});
};
var registerMDHandlers = () => {
	electron.ipcMain.handle("get-md-file", async (event, message) => {
		try {
			return {};
		} catch (error) {
			console.error("AI API error:", error);
			throw error;
		}
	});
};
var registerPGHandlers = () => {
	electron.ipcMain.handle("get-package-dependencies", async () => {
		try {
			const packageJsonPath = path.default.join(electron.app.getAppPath(), "package.json");
			const rawData = await fs_promises.default.readFile(packageJsonPath, "utf-8");
			const packageJson = JSON.parse(rawData);
			return {
				dependencies: packageJson.dependencies || {},
				devDependencies: packageJson.devDependencies || {},
				peerDependencies: packageJson.peerDependencies || {}
			};
		} catch (error) {
			console.error("Ошибка чтения package.json:", error);
			return {
				dependencies: {},
				devDependencies: {},
				peerDependencies: {}
			};
		}
	});
	electron.ipcMain.handle("get-package-json", async () => {
		try {
			const packagePath = path.default.join(electron.app.getAppPath(), "package.json");
			const rawData = await fs_promises.default.readFile(packagePath, "utf-8");
			return JSON.parse(rawData);
		} catch (error) {
			console.error("Ошибка чтения package.json:", error);
			return {};
		}
	});
	electron.ipcMain.handle("get-config-file", async (_, fileName, parseJson = true) => {
		try {
			const filePath = path.default.join(electron.app.getAppPath(), fileName);
			await fs_promises.default.access(filePath, fs_promises.default.constants.R_OK);
			const raw = await fs_promises.default.readFile(filePath, "utf-8");
			return parseJson ? JSON.parse(raw) : raw;
		} catch (err) {
			console.warn(`Конфиг ${fileName} не найден или недоступен:`, err);
			return null;
		}
	});
	function categorizeFile(fileName) {
		const ext = (0, path.extname)(fileName).toLowerCase();
		const base = (0, path.basename)(fileName).toLowerCase();
		if (base === "package.json" || base === ".eslintrc.json" || base === ".eslintrc.js" || base === ".prettierrc" || base === ".prettierrc.json" || base === "prettier.config.js" || base === "postcss.config.js" || base === "tailwind.config.js" || base === ".env" || base.startsWith(".env.") || base === "forge.config.js" || base === "forge.config.ts" || base === "forge.env.d.ts" || base === "electron-builder.yml" || base === "builder.config.ts") return "config";
		if (base.startsWith("tsconfig") || base.startsWith("vite") && base.includes("config")) return "config";
		if (base.match(/\.config\.(js|ts|json|yaml|yml)/)) return "config";
		if ([".ts", ".tsx"].includes(ext)) return "typescript";
		if ([".js", ".jsx"].includes(ext)) return "javascript";
		if ([
			".css",
			".scss",
			".less",
			".sass"
		].includes(ext)) return "style";
		if ([".html", ".htm"].includes(ext)) return "html";
		if ([".json"].includes(ext)) return "data";
		if ([".md", ".txt"].includes(ext)) return "documentation";
		return "other";
	}
	async function buildTree(rootPath, currentPath = rootPath) {
		const entries = await (0, fs_promises.readdir)(currentPath, { withFileTypes: true });
		const nodes = [];
		for (const entry of entries) {
			const fullPath = (0, path.join)(currentPath, entry.name);
			const relativePath = fullPath.replace(rootPath, "").replace(/^[/\\]/, "");
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
				nodes.push({
					name: entry.name,
					path: relativePath,
					type: "directory",
					children: await buildTree(rootPath, fullPath)
				});
			} else nodes.push({
				name: entry.name,
				path: relativePath,
				type: "file",
				extension: (0, path.extname)(entry.name).substring(1),
				category: categorizeFile(entry.name)
			});
		}
		return nodes;
	}
	electron.ipcMain.handle("get-project-tree-json", async (_, folderPath) => {
		return await buildTree(folderPath || electron.app.getAppPath());
	});
};
//#endregion
//#region src/main/utils/protoPath.ts
function getProtoPath(protoFileName) {
	if (electron.app.isPackaged) return path.default.join(process.resourcesPath, "proto", protoFileName);
	return path.default.join(__dirname, "../../proto", protoFileName);
}
var marketDataBus = class MarketDataBus extends events.EventEmitter {
	static instance;
	static counter = 0;
	id;
	constructor() {
		super();
		MarketDataBus.counter++;
		this.id = MarketDataBus.counter;
		console.log(`[MarketDataBus] Создан экземпляр #${this.id}`);
		this.setMaxListeners(50);
	}
	getInstanceId() {
		return this.id;
	}
	static getInstance() {
		if (!MarketDataBus.instance) MarketDataBus.instance = new MarketDataBus();
		return MarketDataBus.instance;
	}
	onCandle(handler) {
		this.on("candle", handler);
		return this;
	}
	onTrade(handler) {
		this.on("trade", handler);
		return this;
	}
	onOrderBook(handler) {
		this.on("orderbook", handler);
		return this;
	}
	onLastPrice(handler) {
		this.on("lastPrice", handler);
		return this;
	}
	offCandle(handler) {
		this.off("candle", handler);
		return this;
	}
	offTrade(handler) {
		this.off("trade", handler);
		return this;
	}
}.getInstance();
//#endregion
//#region src/main/streams/marketdata.ts
var MAX_RECONNECT_ATTEMPTS = 3;
var BASE_DELAY_MS = 3e3;
var retryTimeout = null;
var retryCount = 0;
var currentStream = null;
var client$8 = null;
function createClient() {
	const PROTO_PATH = getProtoPath("marketdata.proto");
	const packageDefinition = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js.loadSync(PROTO_PATH, {
		keepCase: false,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true
	});
	const MarketDataStreamService = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.loadPackageDefinition(packageDefinition).tinkoff.public.invest.api.contract.v1.MarketDataStreamService;
	return new MarketDataStreamService("invest-public-api.tbank.ru:443", _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.credentials.createSsl(null, null, null, { rejectUnauthorized: false }), { "grpc.ssl_target_name_override": "invest-public-api.tbank.ru" });
}
var registerMarketdataStreamHandlers = () => {
	console.log("[Main] registerMDStreamHandlers called");
	client$8 = createClient();
	electron.ipcMain.handle("md-stream-start", async (_, token, requestBody) => {
		console.log("[Main] md-stream-start called");
		if (currentStream) {
			currentStream.cancel();
			currentStream = null;
		}
		if (retryTimeout) {
			clearTimeout(retryTimeout);
			retryTimeout = null;
		}
		retryCount = 0;
		if (client$8) try {
			client$8.close();
		} catch (e) {}
		client$8 = createClient();
		const connect = () => {
			if (retryCount >= MAX_RECONNECT_ATTEMPTS) {
				console.error("[Main] Достигнуто максимальное количество попыток переподключения");
				return;
			}
			console.log(`[Main] Подключение стрима (попытка ${retryCount + 1})`);
			const metadata = new _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.Metadata();
			metadata.add("Authorization", `Bearer ${token}`);
			const stream = client$8.MarketDataServerSideStream(requestBody, metadata);
			if (!stream) {
				console.error("[Main] Не удалось создать стрим");
				if (retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
				return;
			}
			currentStream = stream;
			let buffer = "";
			stream.on("data", (data) => {
				if (typeof data !== "string" && typeof data !== "object") return;
				const chunk = typeof data === "string" ? data : JSON.stringify(data);
				buffer += chunk;
				while (buffer.length > 0) {
					let jsonEnd = -1;
					let depth = 0;
					for (let i = 0; i < buffer.length; i++) if (buffer[i] === "{") depth++;
					else if (buffer[i] === "}") {
						depth--;
						if (depth === 0) {
							jsonEnd = i + 1;
							break;
						}
					}
					if (jsonEnd === -1) break;
					const jsonStr = buffer.substring(0, jsonEnd);
					buffer = buffer.substring(jsonEnd);
					let parsed;
					try {
						parsed = JSON.parse(jsonStr);
					} catch (e) {
						console.warn("[Stream] Ошибка парсинга");
						continue;
					}
					if (parsed.candle) {
						const c = parsed.candle;
						marketDataBus.emit("candle", {
							instrumentUid: c.instrumentUid || c.figi,
							figi: c.figi,
							open: c.open,
							high: c.high,
							low: c.low,
							close: c.close,
							volume: c.volume,
							time: c.time
						});
					}
				}
			});
			stream.on("end", () => {
				console.log("[Main] Стрим завершён");
				currentStream = null;
				if (retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
			});
			stream.on("error", (err) => {
				console.error(`[Main] Ошибка стрима: ${err.message}`);
				currentStream = null;
				if (err.code === 8) {
					console.error("[Main] Лимит стримов исчерпан, дальнейшие попытки остановлены");
					return;
				}
				if (retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
			});
		};
		const scheduleReconnect = () => {
			const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
			retryCount++;
			console.log(`[Main] Переподключение через ${delay / 1e3}с (попытка ${retryCount})`);
			retryTimeout = setTimeout(connect, delay);
		};
		connect();
	});
	electron.ipcMain.handle("md-stream-stop", async () => {
		console.log("[Main] md-stream-stop called");
		if (retryTimeout) {
			clearTimeout(retryTimeout);
			retryTimeout = null;
		}
		if (currentStream) {
			currentStream.cancel();
			currentStream = null;
		}
	});
};
//#endregion
//#region src/main/streams/operations.ts
var registerOperationsStreamHandlers = () => {
	let opsStreams = {
		portfolio: null,
		positions: null,
		operations: null
	};
	let opsClient;
	function ensureOpsClient(mainWindow) {
		if (opsClient) return opsClient;
		const OPS_PROTO_PATH = getProtoPath("operations.proto");
		const packageDefinition = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js.loadSync(OPS_PROTO_PATH, {
			keepCase: false,
			longs: String,
			enums: String,
			defaults: true,
			oneofs: true
		});
		const OperationsStreamService = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.loadPackageDefinition(packageDefinition).tinkoff.public.invest.api.contract.v1.OperationsStreamService;
		opsClient = new OperationsStreamService("invest-public-api.tbank.ru:443", _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.credentials.createSsl(null, null, null, { rejectUnauthorized: false }), { "grpc.ssl_target_name_override": "invest-public-api.tbank.ru" });
		return opsClient;
	}
	electron.ipcMain.handle("ops-stream-start", async (event, streamType, token, requestBody) => {
		const mainWindow = electron.BrowserWindow.fromWebContents(event.sender) || null;
		const client = ensureOpsClient(mainWindow);
		const metadata = new _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.Metadata();
		metadata.add("Authorization", `Bearer ${token}`);
		if (opsStreams[streamType]) {
			opsStreams[streamType].cancel();
			opsStreams[streamType] = null;
		}
		let stream;
		try {
			if (streamType === "portfolio") stream = client.PortfolioStream(requestBody, metadata);
			else if (streamType === "positions") stream = client.PositionsStream(requestBody, metadata);
			else if (streamType === "operations") stream = client.OperationsStream(requestBody, metadata);
			else throw new Error(`Unknown stream type: ${streamType}`);
		} catch (err) {
			mainWindow?.webContents.send("ops-stream-error", streamType, err.message);
			return;
		}
		opsStreams[streamType] = stream;
		let buffer = "";
		stream.on("data", (data) => {
			const chunk = JSON.stringify(data);
			buffer += chunk;
			let begin = 0, depth = 0, inString = false, escape = false;
			for (let i = 0; i < buffer.length; i++) {
				const ch = buffer[i];
				if (inString) {
					if (escape) escape = false;
					else if (ch === "\\") escape = true;
					else if (ch === "\"") inString = false;
					continue;
				}
				if (ch === "\"") inString = true;
				else if (ch === "{") {
					if (depth === 0) begin = i;
					depth++;
				} else if (ch === "}") {
					depth--;
					if (depth === 0) {
						const jsonStr = buffer.substring(begin, i + 1);
						try {
							JSON.parse(jsonStr);
							mainWindow?.webContents.send(`ops-${streamType}-data`, jsonStr);
						} catch {}
					}
				}
			}
			buffer = depth > 0 ? buffer.substring(begin) : "";
		});
		stream.on("status", (status) => {
			mainWindow?.webContents.send(`ops-${streamType}-closed`);
			opsStreams[streamType] = null;
		});
		stream.on("error", (err) => {
			mainWindow?.webContents.send("ops-stream-error", streamType, err.message);
			opsStreams[streamType] = null;
		});
	});
	electron.ipcMain.handle("ops-stream-stop", async () => {
		for (const key of Object.keys(opsStreams)) {
			opsStreams[key]?.cancel();
			opsStreams[key] = null;
		}
	});
};
//#endregion
//#region src/main/streams/orders.ts
var registerOrdersStreamHandlers = () => {
	let ordersStreams = {
		trades: null,
		orderState: null
	};
	let ordersClient;
	function ensureOrdersClient() {
		if (ordersClient) return ordersClient;
		const PROTO_PATH = getProtoPath("orders.proto");
		const packageDefinition = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js.loadSync(PROTO_PATH, {});
		const OrdersStreamService = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.loadPackageDefinition(packageDefinition).tinkoff.public.invest.api.contract.v1.OrdersStreamService;
		ordersClient = new OrdersStreamService("invest-public-api.tbank.ru:443", _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.credentials.createSsl(null, null, null, { rejectUnauthorized: false }), { "grpc.ssl_target_name_override": "invest-public-api.tbank.ru" });
		return ordersClient;
	}
	electron.ipcMain.handle("orders-stream-start", async (event, streamType, token, requestBody) => {
		const mainWindow = electron.BrowserWindow.fromWebContents(event.sender) || null;
		const client = ensureOrdersClient();
		const metadata = new _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.Metadata();
		metadata.add("Authorization", `Bearer ${token}`);
		if (ordersStreams[streamType]) {
			ordersStreams[streamType].cancel();
			ordersStreams[streamType] = null;
		}
		let stream;
		try {
			if (streamType === "trades") stream = client.TradesStream(requestBody, metadata);
			else if (streamType === "orderState") stream = client.OrderStateStream(requestBody, metadata);
			else throw new Error(`Unknown stream type: ${streamType}`);
		} catch (err) {
			mainWindow?.webContents.send("orders-stream-error", streamType, err.message);
			return;
		}
		ordersStreams[streamType] = stream;
		let buffer = "";
		stream.on("data", (data) => {
			const chunk = JSON.stringify(data);
			buffer += chunk;
			let begin = 0, depth = 0, inString = false, escape = false;
			for (let i = 0; i < buffer.length; i++) {
				const ch = buffer[i];
				if (inString) {
					if (escape) escape = false;
					else if (ch === "\\") escape = true;
					else if (ch === "\"") inString = false;
					continue;
				}
				if (ch === "\"") inString = true;
				else if (ch === "{") {
					if (depth === 0) begin = i;
					depth++;
				} else if (ch === "}") {
					depth--;
					if (depth === 0) {
						const jsonStr = buffer.substring(begin, i + 1);
						try {
							JSON.parse(jsonStr);
							mainWindow?.webContents.send(`orders-${streamType}-data`, jsonStr);
						} catch {}
					}
				}
			}
			buffer = depth > 0 ? buffer.substring(begin) : "";
		});
		stream.on("status", () => {
			mainWindow?.webContents.send(`orders-${streamType}-closed`);
			ordersStreams[streamType] = null;
		});
		stream.on("error", (err) => {
			mainWindow?.webContents.send("orders-stream-error", streamType, err.message);
			ordersStreams[streamType] = null;
		});
	});
	electron.ipcMain.handle("orders-stream-stop", async () => {
		for (const key of Object.keys(ordersStreams)) {
			ordersStreams[key]?.cancel();
			ordersStreams[key] = null;
		}
	});
};
//#endregion
//#region src/main/windows/tradingAssistantWindow.ts
var tradingAssistantWindow = null;
var preloadPath$1 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createTradingAssistantWindow = () => {
	if (tradingAssistantWindow && !tradingAssistantWindow.isDestroyed()) {
		tradingAssistantWindow.focus();
		return tradingAssistantWindow;
	}
	tradingAssistantWindow = new electron.BrowserWindow({
		width: 1200,
		height: 800,
		title: "Trading Assistant – Volume Profile",
		webPreferences: {
			preload: preloadPath$1,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.NODE_ENV === "development") tradingAssistantWindow.loadURL(`${DEV_SERVER_URL}/#/trading-assistant`);
	else tradingAssistantWindow.loadFile(getMainWindowProdPath());
	const menu = electron.Menu.buildFromTemplate(tradingAssistantWindowMenuTemplate);
	tradingAssistantWindow.setMenu(menu);
	tradingAssistantWindow.on("closed", () => {
		tradingAssistantWindow = null;
	});
	return tradingAssistantWindow;
};
var getTradingAssistantWindow = () => tradingAssistantWindow;
//#endregion
//#region src/main/services/volumeProfileEngine.ts
function quotationToNumber$2(q) {
	if (!q) return 0;
	return Number(q.units || "0") + (q.nano || 0) / 1e9;
}
var DEFAULT_CONFIG = {
	valueAreaPercent: 70,
	hvnMultiplier: 1.5,
	lvnMultiplier: .5,
	minVolumeThreshold: 100,
	profileResolution: 50
};
function normalDensity(x, mean, stdDev) {
	const exponent = -.5 * Math.pow((x - mean) / stdDev, 2);
	return 1 / (stdDev * Math.sqrt(2 * Math.PI)) * Math.exp(exponent);
}
var VolumeProfileEngine = class extends events.EventEmitter {
	config;
	volumeByPrice = /* @__PURE__ */ new Map();
	lastPrice = /* @__PURE__ */ new Map();
	lastCandleTime = /* @__PURE__ */ new Map();
	lastSignalDirection = /* @__PURE__ */ new Map();
	constructor(config = {}) {
		super();
		this.config = {
			...DEFAULT_CONFIG,
			...config
		};
		if (!this.config.skipAutoSubscribe) {
			marketDataBus.onCandle(this.onCandle.bind(this));
			marketDataBus.onTrade(this.onTrade.bind(this));
		}
	}
	onCandle(candle) {
		const uid = candle.instrumentUid || candle.figi;
		if (!uid) return;
		const volume = Number(candle.volume || "0");
		if (volume <= this.config.minVolumeThreshold) return;
		const high = quotationToNumber$2(candle.high);
		const low = quotationToNumber$2(candle.low);
		const close = quotationToNumber$2(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		this.lastPrice.set(uid, close);
		const typicalPrice = (high + low + close) / 3;
		const range = high - low;
		if (range <= .001) this.addVolume(uid, close, volume);
		else {
			const resolution = this.config.profileResolution;
			const stdDev = range * .15;
			const densities = [];
			const prices = [];
			for (let i = 0; i < resolution; i++) {
				const price = low + i / (resolution - 1) * range;
				const density = normalDensity(price, typicalPrice, stdDev);
				densities.push(density);
				prices.push(price);
			}
			const sumDensity = densities.reduce((a, b) => a + b, 0);
			if (sumDensity > 0) for (let i = 0; i < resolution; i++) {
				const weight = densities[i] / sumDensity;
				this.addVolume(uid, prices[i], volume * weight);
			}
			else this.addVolume(uid, close, volume);
		}
		this.recalculateProfileWithCache(uid, time);
		this.generateSignals(uid, close, time);
	}
	onTrade(trade) {
		const uid = trade.instrumentUid || trade.figi;
		if (!uid) return;
		const price = quotationToNumber$2(trade.price);
		this.lastPrice.set(uid, price);
	}
	addVolume(uid, price, volume) {
		if (!this.volumeByPrice.has(uid)) this.volumeByPrice.set(uid, /* @__PURE__ */ new Map());
		const priceMap = this.volumeByPrice.get(uid);
		const roundedPrice = Math.round(price * 100) / 100;
		priceMap.set(roundedPrice, (priceMap.get(roundedPrice) || 0) + volume);
	}
	recalculateProfile(uid, timestamp) {
		const priceMap = this.volumeByPrice.get(uid);
		if (!priceMap || priceMap.size === 0) return;
		const sortedEntries = Array.from(priceMap.entries()).sort((a, b) => a[0] - b[0]);
		const totalVolume = sortedEntries.reduce((sum, [, vol]) => sum + vol, 0);
		if (totalVolume === 0) return;
		let poc = sortedEntries[0][0];
		let maxVol = sortedEntries[0][1];
		for (const [price, vol] of sortedEntries) if (vol > maxVol) {
			maxVol = vol;
			poc = price;
		}
		const targetVolume = this.config.valueAreaPercent / 100 * totalVolume;
		let accumulated = 0;
		let vaHigh = poc;
		let vaLow = poc;
		let pocIndex = sortedEntries.findIndex(([p]) => p === poc);
		if (pocIndex === -1) pocIndex = 0;
		let left = pocIndex;
		let right = pocIndex;
		accumulated += sortedEntries[pocIndex][1];
		while (accumulated < targetVolume && (left > 0 || right < sortedEntries.length - 1)) if ((left > 0 ? sortedEntries[left - 1][1] : 0) >= (right < sortedEntries.length - 1 ? sortedEntries[right + 1][1] : 0) && left > 0) {
			left--;
			accumulated += sortedEntries[left][1];
			vaLow = sortedEntries[left][0];
		} else if (right < sortedEntries.length - 1) {
			right++;
			accumulated += sortedEntries[right][1];
			vaHigh = sortedEntries[right][0];
		} else if (left > 0) {
			left--;
			accumulated += sortedEntries[left][1];
			vaLow = sortedEntries[left][0];
		} else break;
		const avgVolume = totalVolume / sortedEntries.length;
		const hvn = [];
		const lvn = [];
		for (const [price, vol] of sortedEntries) if (vol > avgVolume * this.config.hvnMultiplier) hvn.push(price);
		else if (vol < avgVolume * this.config.lvnMultiplier && vol > 0) lvn.push(price);
		const volumeByPrice = Array.from(priceMap.entries()).map(([price, vol]) => ({
			price,
			volume: vol
		}));
		const levels = {
			instrumentUid: uid,
			timestamp,
			poc,
			valueAreaHigh: vaHigh,
			valueAreaLow: vaLow,
			hvn,
			lvn,
			totalVolume,
			volumeByPrice
		};
		this.emit("profileUpdate", levels);
	}
	generateSignals(uid, currentPrice, time) {
		if (!this.volumeByPrice.get(uid)) return;
		const profile = this.getLastProfile(uid);
		if (!profile) return;
		const { poc, valueAreaHigh, valueAreaLow, hvn, lvn } = profile;
		const newDirection = currentPrice > poc ? "UP" : currentPrice < poc ? "DOWN" : null;
		if (!newDirection) return;
		if (this.lastSignalDirection.get(uid) === newDirection) return;
		this.lastSignalDirection.set(uid, newDirection);
		if (newDirection === "UP") this.emitSignal(uid, time, "POC_BREAKOUT_UP", currentPrice, poc, `Цена ${currentPrice} пробила POC ${poc} вверх`);
		else this.emitSignal(uid, time, "POC_BREAKOUT_DOWN", currentPrice, poc, `Цена ${currentPrice} пробила POC ${poc} вниз`);
		if (currentPrice > valueAreaLow && currentPrice < valueAreaHigh) {}
	}
	emitSignal(uid, time, type, price, level, message) {
		const signal = {
			instrumentUid: uid,
			time,
			type,
			price,
			level,
			message
		};
		this.emit("signal", signal);
	}
	profileCache = /* @__PURE__ */ new Map();
	/** Получить последний рассчитанный профиль для инструмента */
	getProfile(instrumentUid) {
		return this.profileCache.get(instrumentUid) || null;
	}
	getLastProfile(uid) {
		return this.profileCache.get(uid);
	}
	reset(instrumentUid) {
		this.volumeByPrice.delete(instrumentUid);
		this.lastSignalDirection.delete(instrumentUid);
		this.profileCache.delete(instrumentUid);
	}
	cacheProfile(profile) {
		this.profileCache.set(profile.instrumentUid, profile);
	}
	recalculateProfileWithCache(uid, timestamp) {
		const priceMap = this.volumeByPrice.get(uid);
		if (!priceMap || priceMap.size === 0) return;
		const sortedEntries = Array.from(priceMap.entries()).sort((a, b) => a[0] - b[0]);
		const totalVolume = sortedEntries.reduce((sum, [, vol]) => sum + vol, 0);
		if (totalVolume === 0) return;
		let poc = sortedEntries[0][0];
		let maxVol = sortedEntries[0][1];
		for (const [price, vol] of sortedEntries) if (vol > maxVol) {
			maxVol = vol;
			poc = price;
		}
		const targetVolume = this.config.valueAreaPercent / 100 * totalVolume;
		let accumulated = 0;
		let vaHigh = poc;
		let vaLow = poc;
		let pocIndex = sortedEntries.findIndex(([p]) => p === poc);
		if (pocIndex === -1) pocIndex = 0;
		let left = pocIndex;
		let right = pocIndex;
		accumulated += sortedEntries[pocIndex][1];
		while (accumulated < targetVolume && (left > 0 || right < sortedEntries.length - 1)) if ((left > 0 ? sortedEntries[left - 1][1] : 0) >= (right < sortedEntries.length - 1 ? sortedEntries[right + 1][1] : 0) && left > 0) {
			left--;
			accumulated += sortedEntries[left][1];
			vaLow = sortedEntries[left][0];
		} else if (right < sortedEntries.length - 1) {
			right++;
			accumulated += sortedEntries[right][1];
			vaHigh = sortedEntries[right][0];
		} else if (left > 0) {
			left--;
			accumulated += sortedEntries[left][1];
			vaLow = sortedEntries[left][0];
		} else break;
		const avgVolume = totalVolume / sortedEntries.length;
		const hvn = sortedEntries.filter(([, vol]) => vol > avgVolume * this.config.hvnMultiplier).map(([p]) => p);
		const lvn = sortedEntries.filter(([, vol]) => vol < avgVolume * this.config.lvnMultiplier && vol > 0).map(([p]) => p);
		const volumeByPrice = Array.from(priceMap.entries()).map(([price, vol]) => ({
			price,
			volume: vol
		}));
		const profile = {
			instrumentUid: uid,
			timestamp,
			poc,
			valueAreaHigh: vaHigh,
			valueAreaLow: vaLow,
			hvn,
			lvn,
			totalVolume,
			volumeByPrice
		};
		this.cacheProfile(profile);
		this.emit("profileUpdate", profile);
	}
	onCandleWithCache(candle) {}
	feedCandle(candle) {
		this.onCandle(candle);
	}
};
var volumeProfileEngine = new VolumeProfileEngine();
//#endregion
//#region src/api/tbank/marketdataTypes.ts
/** Интервал свечей */
var CandleInterval = /* @__PURE__ */ function(CandleInterval) {
	/** Интервал не определён */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_UNSPECIFIED"] = 0] = "CANDLE_INTERVAL_UNSPECIFIED";
	/** 1 минута. Максимальный `limit` — 2400 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_1_MIN"] = 1] = "CANDLE_INTERVAL_1_MIN";
	/** 5 минут. Максимальный `limit` — 2400 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_5_MIN"] = 2] = "CANDLE_INTERVAL_5_MIN";
	/** 15 минут. Максимальный `limit` — 2400 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_15_MIN"] = 3] = "CANDLE_INTERVAL_15_MIN";
	/** 1 час. Максимальный `limit` — 2400 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_HOUR"] = 4] = "CANDLE_INTERVAL_HOUR";
	/** 1 день. Максимальный `limit` — 2400 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_DAY"] = 5] = "CANDLE_INTERVAL_DAY";
	/** 2 минуты. Максимальный `limit` — 1200 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_2_MIN"] = 6] = "CANDLE_INTERVAL_2_MIN";
	/** 3 минуты. Максимальный `limit` — 750 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_3_MIN"] = 7] = "CANDLE_INTERVAL_3_MIN";
	/** 10 минут. Максимальный `limit` — 1200 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_10_MIN"] = 8] = "CANDLE_INTERVAL_10_MIN";
	/** 30 минут. Максимальный `limit` — 1200 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_30_MIN"] = 9] = "CANDLE_INTERVAL_30_MIN";
	/** 2 часа. Максимальный `limit` — 2400 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_2_HOUR"] = 10] = "CANDLE_INTERVAL_2_HOUR";
	/** 4 часа. Максимальный `limit` — 700 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_4_HOUR"] = 11] = "CANDLE_INTERVAL_4_HOUR";
	/** 1 неделя. Максимальный `limit` — 300 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_WEEK"] = 12] = "CANDLE_INTERVAL_WEEK";
	/** 1 месяц. Максимальный `limit` — 120 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_MONTH"] = 13] = "CANDLE_INTERVAL_MONTH";
	/** 5 секунд. Максимальный `limit` — 2500 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_5_SEC"] = 14] = "CANDLE_INTERVAL_5_SEC";
	/** 10 секунд. Максимальный `limit` — 1250 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_10_SEC"] = 15] = "CANDLE_INTERVAL_10_SEC";
	/** 30 секунд. Максимальный `limit` — 2500 */
	CandleInterval[CandleInterval["CANDLE_INTERVAL_30_SEC"] = 16] = "CANDLE_INTERVAL_30_SEC";
	return CandleInterval;
}({});
/** Тип источника свечи (в запросе) */
var CandleSourceRequest = /* @__PURE__ */ function(CandleSourceRequest) {
	/** Все свечи */
	CandleSourceRequest[CandleSourceRequest["CANDLE_SOURCE_UNSPECIFIED"] = 0] = "CANDLE_SOURCE_UNSPECIFIED";
	/** Биржевые свечи */
	CandleSourceRequest[CandleSourceRequest["CANDLE_SOURCE_EXCHANGE"] = 1] = "CANDLE_SOURCE_EXCHANGE";
	/** Все свечи с учётом торговли по выходным */
	CandleSourceRequest[CandleSourceRequest["CANDLE_SOURCE_INCLUDE_WEEKEND"] = 3] = "CANDLE_SOURCE_INCLUDE_WEEKEND";
	return CandleSourceRequest;
}({});
//#endregion
//#region src/main/services/backtest/strategies/VolumeAccumulationStrategy.ts
var VolumeAccumulationStrategy = class {
	signals = [];
	dailyProfile = null;
	instrumentUid;
	hasBrokenHigh = false;
	hasBrokenLow = false;
	volumeFilterEnabled;
	volumeFilterPeriod;
	volumeHistory = [];
	lastSignalDirection = null;
	maxSignalsPerDay = 0;
	minIntervalMs = 0;
	signalsToday = 0;
	lastSignalTime = 0;
	constructor(instrumentUid, dailyProfile, options) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
		this.volumeFilterEnabled = options?.volumeFilterEnabled ?? false;
		this.volumeFilterPeriod = options?.volumeFilterPeriod ?? 20;
		this.maxSignalsPerDay = options?.maxSignalsPerDay ?? 0;
		this.minIntervalMs = (options?.minIntervalMinutes ?? 15) * 60 * 1e3;
	}
	reset() {
		this.signals = [];
		this.hasBrokenHigh = false;
		this.hasBrokenLow = false;
		this.hasPosition = false;
		this.volumeHistory = [];
	}
	hasPosition = false;
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const high = quotationToNumber$1(candle.high);
		const low = quotationToNumber$1(candle.low);
		const close = quotationToNumber$1(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const volume = Number(candle.volume || "0");
		this.volumeHistory.push(volume);
		if (this.volumeHistory.length > this.volumeFilterPeriod) this.volumeHistory.shift();
		if (this.volumeFilterEnabled && this.volumeHistory.length >= this.volumeFilterPeriod) {
			if (volume < this.volumeHistory.reduce((a, b) => a + b, 0) / this.volumeHistory.length) return;
		}
		if (high > this.dailyProfile.valueAreaHigh) {
			this.hasBrokenHigh = true;
			this.hasBrokenLow = false;
		}
		if (low < this.dailyProfile.valueAreaLow) {
			this.hasBrokenLow = true;
			this.hasBrokenHigh = false;
		}
		if (this.maxSignalsPerDay > 0 && this.signalsToday >= this.maxSignalsPerDay) return;
		const now = Date.now();
		if (this.minIntervalMs > 0 && now - this.lastSignalTime < this.minIntervalMs) return;
		if (this.hasBrokenHigh && close < this.dailyProfile.valueAreaHigh) {
			this.signals.push({
				type: "SELL",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Return to VA after breaking high (VAH=${this.dailyProfile.valueAreaHigh})`,
				targetPrice: this.dailyProfile.poc
			});
			this.hasBrokenHigh = false;
			this.hasPosition = true;
			this.signalsToday++;
			this.lastSignalTime = now;
		}
		if (this.hasBrokenLow && close > this.dailyProfile.valueAreaLow) {
			this.signals.push({
				type: "BUY",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Return to VA after breaking low (VAL=${this.dailyProfile.valueAreaLow})`,
				targetPrice: this.dailyProfile.poc
			});
			this.hasBrokenLow = false;
			this.hasPosition = true;
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.dailyProfile = profile;
		this.hasPosition = false;
		this.hasBrokenHigh = false;
		this.hasBrokenLow = false;
		this.volumeHistory = [];
		this.signalsToday = 0;
		this.lastSignalTime = 0;
	}
};
function quotationToNumber$1(q) {
	if (!q) return 0;
	return Number(q.units || 0) + (q.nano || 0) / 1e9;
}
//#endregion
//#region src/main/utils/grpcHelper.ts
function createGrpcClient(packageName, serviceName) {
	const PROTO_PATH = getProtoPath(packageName);
	const packageDefinition = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js.loadSync(PROTO_PATH, {
		keepCase: false,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true
	});
	const ServiceClient = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.loadPackageDefinition(packageDefinition).tinkoff.public.invest.api.contract.v1[serviceName];
	return new ServiceClient("invest-public-api.tbank.ru:443", _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.credentials.createSsl(null, null, null, { rejectUnauthorized: false }), { "grpc.ssl_target_name_override": "invest-public-api.tbank.ru" });
}
function createMetadata(token) {
	const meta = new _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.Metadata();
	meta.add("Authorization", `Bearer ${token}`);
	return meta;
}
//#endregion
//#region src/main/services/tbank/MarketDataGrpcService.ts
var client$7 = createGrpcClient("marketdata.proto", "MarketDataService");
var marketDataGrpc = {
	getCandles: (request, token) => new Promise((resolve, reject) => {
		client$7.GetCandles(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getClosePrices: (request, token) => new Promise((resolve, reject) => {
		client$7.GetClosePrices(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getLastPrices: (request, token) => new Promise((resolve, reject) => {
		client$7.GetLastPrices(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getLastTrades: (request, token) => new Promise((resolve, reject) => {
		client$7.GetLastTrades(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getMarketValues: (request, token) => new Promise((resolve, reject) => {
		client$7.GetMarketValues(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrderBook: (request, token) => new Promise((resolve, reject) => {
		client$7.GetOrderBook(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getTechAnalysis: (request, token) => new Promise((resolve, reject) => {
		client$7.GetTechAnalysis(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getTradingStatus: (request, token) => new Promise((resolve, reject) => {
		client$7.GetTradingStatus(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getTradingStatuses: (request, token) => new Promise((resolve, reject) => {
		client$7.GetTradingStatuses(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/historicalDataLoader.ts
function timestampToISO(ts) {
	if (!ts) return (/* @__PURE__ */ new Date()).toISOString();
	if (typeof ts === "object" && ts.seconds !== void 0) return (/* @__PURE__ */ new Date(ts.seconds * 1e3)).toISOString();
	if (typeof ts === "string") return new Date(ts).toISOString();
	return (/* @__PURE__ */ new Date()).toISOString();
}
var HistoricalDataLoader = class {
	cacheDir = path.default.join(electron.app.getPath("userData"), "candles_cache");
	compactCandle(c) {
		return {
			o: c.open,
			h: c.high,
			l: c.low,
			c: c.close,
			v: c.volume,
			t: c.time
		};
	}
	expandCandle(c, instrumentUid) {
		return {
			instrumentUid,
			open: c.o,
			high: c.h,
			low: c.l,
			close: c.c,
			volume: c.v,
			time: c.t
		};
	}
	/** Атомарная запись: сначала пишем во временный файл, потом переименовываем */
	async atomicWriteJson(filePath, data) {
		const tmpPath = filePath + ".tmp";
		try {
			const json = JSON.stringify(data);
			_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.writeFileSync(tmpPath, json, "utf-8");
			_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.renameSync(tmpPath, filePath);
			console.log(`[Cache] Saved: ${filePath}`);
		} catch (e) {
			console.error("Failed to write cache file", filePath, e);
			try {
				_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.unlinkSync(tmpPath);
			} catch {}
		}
	}
	async loadIntradayCandles(instrumentUid, from, to, token, interval = CandleInterval.CANDLE_INTERVAL_1_MIN) {
		try {
			await _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.ensureDir(this.cacheDir);
		} catch (e) {
			console.error("Failed to create cache dir:", e);
		}
		const allCandles = [];
		let currentDate = new Date(from);
		currentDate.setHours(7, 0, 0, 0);
		while (currentDate <= to) {
			let dateStr = "";
			try {
				dateStr = currentDate.toISOString().split("T")[0];
				const cacheFile = path.default.join(this.cacheDir, `${instrumentUid}_${interval}_${dateStr}.json`);
				let dayCandles = null;
				try {
					if (await _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.pathExists(cacheFile)) {
						const stat = await _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.stat(cacheFile);
						if ((Date.now() - stat.mtimeMs) / 36e5 < 24) {
							const raw = await _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.readFile(cacheFile, "utf-8");
							dayCandles = JSON.parse(raw).map((c) => this.expandCandle(c, instrumentUid));
							console.log(`[Cache] Loaded from cache: ${cacheFile}`);
						}
					}
				} catch (e) {
					console.error("Cache read error for", dateStr, e);
				}
				if (!dayCandles) {
					const dayFrom = new Date(currentDate);
					const dayTo = new Date(currentDate);
					dayTo.setHours(16, 0, 0, 0);
					if (dayTo > to) dayTo.setTime(to.getTime());
					const request = {
						instrumentId: instrumentUid,
						interval,
						from: {
							seconds: Math.floor(dayFrom.getTime() / 1e3),
							nanos: 0
						},
						to: {
							seconds: Math.floor(dayTo.getTime() / 1e3),
							nanos: 0
						},
						candleSourceType: CandleSourceRequest.CANDLE_SOURCE_EXCHANGE
					};
					dayCandles = ((await marketDataGrpc.getCandles(request, token)).candles || []).map((candle) => ({
						instrumentUid,
						open: candle.open,
						high: candle.high,
						low: candle.low,
						close: candle.close,
						volume: String(candle.volume || "0"),
						time: timestampToISO(candle.time)
					}));
					const compactData = dayCandles.map((c) => this.compactCandle(c));
					this.atomicWriteJson(cacheFile, compactData).then(() => console.log(`[Cache] Saved: ${cacheFile}`)).catch((e) => console.error("Cache write error for", dateStr, e));
				}
				allCandles.push(...dayCandles);
			} catch (e) {
				console.error("Error loading day", dateStr, e);
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}
		this.cleanOldCache().catch((e) => console.warn("Cache cleanup error:", e));
		return allCandles;
	}
	async cleanOldCache(maxAgeDays = 30) {
		const files = await _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.readdir(this.cacheDir);
		const now = Date.now();
		for (const file of files) {
			const filePath = path.default.join(this.cacheDir, file);
			try {
				if ((now - (await _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.stat(filePath)).mtimeMs) / 864e5 > maxAgeDays) await _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_fs_extra_lib_index_js.default.unlink(filePath);
			} catch (e) {}
		}
	}
};
//#endregion
//#region src/main/services/backtest/virtualPortfolio.ts
var VirtualPortfolio = class {
	capital;
	initialCapital;
	trades = [];
	openPosition = null;
	peakCapital;
	maxDrawdown = 0;
	config;
	constructor(config) {
		this.config = {
			initialCapital: config.initialCapital,
			commissionPercent: config.commissionPercent ?? 0,
			slippagePercent: config.slippagePercent ?? 0,
			stopLossPercent: config.stopLossPercent ?? 0,
			takeProfitPercent: config.takeProfitPercent ?? 0,
			trailingDistancePercent: config.trailingDistancePercent ?? 0,
			lotQuantity: config.lotQuantity ?? 1,
			positionSizing: config.positionSizing ?? "fixed",
			riskPercent: config.riskPercent ?? 1
		};
		this.initialCapital = this.config.initialCapital;
		this.capital = this.config.initialCapital;
		this.peakCapital = this.config.initialCapital;
	}
	processSignal(signal) {
		if (this.openPosition) this.closePosition(signal.price, signal.time, "SIGNAL");
		const entryPrice = signal.price;
		const isBuy = signal.type === "BUY";
		let lotQty = this.config.lotQuantity;
		if (this.config.positionSizing === "dynamic" && this.config.stopLossPercent > 0) {
			const riskAmount = this.capital * this.config.riskPercent / 100;
			const stopDistance = entryPrice * (this.config.stopLossPercent / 100);
			lotQty = Math.floor(riskAmount / stopDistance);
			if (lotQty < 1) lotQty = 1;
		}
		const maxLotsByCapital = Math.floor(this.capital / entryPrice);
		lotQty = Math.min(lotQty, maxLotsByCapital);
		if (lotQty < 1) lotQty = 1;
		const stopLossPrice = this.config.stopLossPercent > 0 ? isBuy ? entryPrice * (1 - this.config.stopLossPercent / 100) : entryPrice * (1 + this.config.stopLossPercent / 100) : entryPrice;
		const takeProfitPrice = this.config.takeProfitPercent > 0 ? isBuy ? entryPrice * (1 + this.config.takeProfitPercent / 100) : entryPrice * (1 - this.config.takeProfitPercent / 100) : void 0;
		this.openPosition = {
			type: signal.type,
			price: entryPrice,
			time: signal.time,
			stopLossPrice,
			takeProfitPrice,
			trailingDistance: this.config.trailingDistancePercent / 100,
			bestPrice: entryPrice,
			lotQuantity: lotQty
		};
	}
	checkStopTake(high, low, close, time) {
		if (!this.openPosition) return;
		const { type, stopLossPrice, takeProfitPrice, trailingDistance, bestPrice } = this.openPosition;
		if (type === "BUY") {
			if (high > bestPrice) {
				this.openPosition.bestPrice = high;
				if (trailingDistance > 0) {
					const newStop = high * (1 - trailingDistance);
					if (newStop > this.openPosition.stopLossPrice) this.openPosition.stopLossPrice = newStop;
				}
			}
		} else if (low < bestPrice) {
			this.openPosition.bestPrice = low;
			if (trailingDistance > 0) {
				const newStop = low * (1 + trailingDistance);
				if (newStop < this.openPosition.stopLossPrice) this.openPosition.stopLossPrice = newStop;
			}
		}
		if (stopLossPrice > 0) {
			if (type === "BUY" && low <= stopLossPrice) {
				this.closePosition(stopLossPrice, time, "STOP_LOSS");
				return;
			}
			if (type === "SELL" && high >= stopLossPrice) {
				this.closePosition(stopLossPrice, time, "STOP_LOSS");
				return;
			}
		}
		if (takeProfitPrice !== void 0) {
			if (type === "BUY" && high >= takeProfitPrice) {
				this.closePosition(takeProfitPrice, time, "TAKE_PROFIT");
				return;
			}
			if (type === "SELL" && low <= takeProfitPrice) {
				this.closePosition(takeProfitPrice, time, "TAKE_PROFIT");
				return;
			}
		}
	}
	closePosition(price, time, reason) {
		if (!this.openPosition) return;
		const entry = this.openPosition;
		let profit;
		const lots = this.openPosition.lotQuantity ?? 1;
		console.log(`[DEBUG] entry.price=${entry.price}, price=${price}, lots=${lots}`);
		if (entry.type === "BUY") profit = (price - entry.price) * lots;
		else profit = (entry.price - price) * lots;
		console.log(`[Portfolio] LOTS=${lots}, PROFIT=${profit}`);
		const profitPercent = profit / entry.price * 100;
		this.capital += profit;
		this.trades.push({
			type: entry.type,
			entryPrice: entry.price,
			exitPrice: price,
			entryTime: entry.time,
			exitTime: time,
			profit,
			profitPercent,
			exitReason: reason
		});
		if (this.capital > this.peakCapital) this.peakCapital = this.capital;
		const currentDrawdown = this.peakCapital - this.capital;
		if (currentDrawdown > this.maxDrawdown) this.maxDrawdown = currentDrawdown;
		this.openPosition = null;
	}
	finalizeWithLastPrice(lastPrice, time) {
		if (this.openPosition) this.closePosition(lastPrice, time, "END_OF_DAY");
		return this.getStats();
	}
	getStats() {
		const totalTrades = this.trades.length;
		const winningTrades = this.trades.filter((t) => t.profit > 0).length;
		const losingTrades = totalTrades - winningTrades;
		const winRate = totalTrades > 0 ? winningTrades / totalTrades * 100 : 0;
		const totalProfit = this.capital - this.initialCapital;
		const totalProfitPercent = totalProfit / this.initialCapital * 100;
		const maxDrawdownPercent = this.peakCapital > 0 ? this.maxDrawdown / this.peakCapital * 100 : 0;
		const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
		const averageProfitPercent = totalTrades > 0 ? totalProfitPercent / totalTrades : 0;
		return {
			initialCapital: this.initialCapital,
			finalCapital: this.capital,
			totalProfit,
			totalProfitPercent,
			totalTrades,
			winningTrades,
			losingTrades,
			winRate,
			maxDrawdown: this.maxDrawdown,
			maxDrawdownPercent,
			averageProfit,
			averageProfitPercent
		};
	}
	getTrades() {
		return this.trades;
	}
};
//#endregion
//#region src/main/services/backtest/common.ts
/** Преобразует Quotation в число */
function quotationToNumber(q) {
	if (!q) return 0;
	return Number(q.units || "0") + (q.nano || 0) / 1e9;
}
//#endregion
//#region src/main/services/tbank/SandboxGrpcService.ts
var client$6 = createGrpcClient("sandbox.proto", "SandboxService");
var sandboxGrpc = {
	openSandboxAccount: (request, token) => new Promise((resolve, reject) => {
		client$6.OpenSandboxAccount(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	closeSandboxAccount: (request, token) => new Promise((resolve, reject) => {
		client$6.CloseSandboxAccount(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxAccounts: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	sandboxPayIn: (request, token) => new Promise((resolve, reject) => {
		client$6.SandboxPayIn(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postSandboxOrder: (request, token) => new Promise((resolve, reject) => {
		client$6.PostSandboxOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postSandboxOrderAsync: (request, token) => new Promise((resolve, reject) => {
		client$6.PostSandboxOrderAsync(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	cancelSandboxOrder: (request, token) => new Promise((resolve, reject) => {
		client$6.CancelSandboxOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOrderState: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxOrderState(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOrders: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	replaceSandboxOrder: (request, token) => new Promise((resolve, reject) => {
		client$6.ReplaceSandboxOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxMaxLots: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxMaxLots(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOrderPrice: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxOrderPrice(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	cancelSandboxStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$6.CancelSandboxStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxStopOrders: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxStopOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postSandboxStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$6.PostSandboxStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOperations: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxOperations(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOperationsByCursor: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxOperationsByCursor(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxPortfolio: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxPortfolio(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxPositions: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxPositions(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxWithdrawLimits: (request, token) => new Promise((resolve, reject) => {
		client$6.GetSandboxWithdrawLimits(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/InstrumentsGrpcService.ts
var client$5 = createGrpcClient("instruments.proto", "InstrumentsService");
var instrumentsGrpc = {
	bondBy: (request, token) => new Promise((resolve, reject) => {
		client$5.BondBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	bonds: (request, token) => new Promise((resolve, reject) => {
		client$5.Bonds(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	createFavoriteGroup: (request, token) => new Promise((resolve, reject) => {
		client$5.CreateFavoriteGroup(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencies: (request, token) => new Promise((resolve, reject) => {
		client$5.Currencies(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencyBy: (request, token) => new Promise((resolve, reject) => {
		client$5.CurrencyBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	deleteFavoriteGroup: (request, token) => new Promise((resolve, reject) => {
		client$5.DeleteFavoriteGroup(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	editFavorites: (request, token) => new Promise((resolve, reject) => {
		client$5.EditFavorites(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	etfBy: (request, token) => new Promise((resolve, reject) => {
		client$5.EtfBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	etfs: (request, token) => new Promise((resolve, reject) => {
		client$5.Etfs(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	findInstrument: (request, token) => new Promise((resolve, reject) => {
		client$5.FindInstrument(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	futureBy: (request, token) => new Promise((resolve, reject) => {
		client$5.FutureBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	futures: (request, token) => new Promise((resolve, reject) => {
		client$5.Futures(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAccruedInterests: (request, token) => new Promise((resolve, reject) => {
		client$5.GetAccruedInterests(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetBy: (request, token) => new Promise((resolve, reject) => {
		client$5.GetAssetBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetFundamentals: (request, token) => new Promise((resolve, reject) => {
		client$5.GetAssetFundamentals(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetReports: (request, token) => new Promise((resolve, reject) => {
		client$5.GetAssetReports(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssets: (request, token) => new Promise((resolve, reject) => {
		client$5.GetAssets(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBondCoupons: (request, token) => new Promise((resolve, reject) => {
		client$5.GetBondCoupons(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBondEvents: (request, token) => new Promise((resolve, reject) => {
		client$5.GetBondEvents(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrandBy: (request, token) => new Promise((resolve, reject) => {
		client$5.GetBrandBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrands: (request, token) => new Promise((resolve, reject) => {
		client$5.GetBrands(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getConsensusForecasts: (request, token) => new Promise((resolve, reject) => {
		client$5.GetConsensusForecasts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getCountries: (request, token) => new Promise((resolve, reject) => {
		client$5.GetCountries(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getDividends: (request, token) => new Promise((resolve, reject) => {
		client$5.GetDividends(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFavoriteGroups: (request, token) => new Promise((resolve, reject) => {
		client$5.GetFavoriteGroups(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFavorites: (request, token) => new Promise((resolve, reject) => {
		client$5.GetFavorites(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getForecastBy: (request, token) => new Promise((resolve, reject) => {
		client$5.GetForecastBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFuturesMargin: (request, token) => new Promise((resolve, reject) => {
		client$5.GetFuturesMargin(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getInsiderDeals: (request, token) => new Promise((resolve, reject) => {
		client$5.GetInsiderDeals(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getInstrumentBy: (request, token) => new Promise((resolve, reject) => {
		client$5.GetInstrumentBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getRiskRates: (request, token) => new Promise((resolve, reject) => {
		client$5.GetRiskRates(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	indicatives: (request, token) => new Promise((resolve, reject) => {
		client$5.Indicatives(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	optionBy: (request, token) => new Promise((resolve, reject) => {
		client$5.OptionBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	options: (request, token) => new Promise((resolve, reject) => {
		client$5.Options(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	optionsBy: (request, token) => new Promise((resolve, reject) => {
		client$5.OptionsBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	shareBy: (request, token) => new Promise((resolve, reject) => {
		client$5.ShareBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	shares: (request, token) => new Promise((resolve, reject) => {
		client$5.Shares(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	structuredNoteBy: (request, token) => new Promise((resolve, reject) => {
		client$5.StructuredNoteBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	structuredNotes: (request, token) => new Promise((resolve, reject) => {
		client$5.StructuredNotes(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	tradingSchedules: (request, token) => new Promise((resolve, reject) => {
		client$5.TradingSchedules(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/backtest/strategies/TrendStrategy.ts
var TrendStrategy = class {
	signals = [];
	dailyProfile = null;
	instrumentUid;
	hvnLevel = null;
	hvnBroken = false;
	trendDirection = null;
	hasPosition = false;
	lastTradeTime = 0;
	minIntervalMs = 900 * 1e3;
	volumeFilterEnabled;
	volumeFilterPeriod;
	volumeHistory = [];
	constructor(instrumentUid, dailyProfile, options) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
		this.volumeFilterEnabled = options?.volumeFilterEnabled ?? false;
		this.volumeFilterPeriod = options?.volumeFilterPeriod ?? 20;
	}
	reset() {
		this.signals = [];
		this.hvnLevel = null;
		this.hvnBroken = false;
		this.trendDirection = null;
		this.hasPosition = false;
		this.lastTradeTime = 0;
		this.volumeHistory = [];
	}
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const volume = Number(candle.volume || "0");
		this.volumeHistory.push(volume);
		if (this.volumeHistory.length > this.volumeFilterPeriod) this.volumeHistory.shift();
		if (this.volumeFilterEnabled && this.volumeHistory.length >= this.volumeFilterPeriod) {
			if (volume < this.volumeHistory.reduce((a, b) => a + b, 0) / this.volumeHistory.length) return;
		}
		const now = new Date(time).getTime();
		if (now - this.lastTradeTime < this.minIntervalMs) return;
		if (close > this.dailyProfile.valueAreaHigh) this.trendDirection = "UP";
		else if (close < this.dailyProfile.valueAreaLow) this.trendDirection = "DOWN";
		else {
			this.hvnLevel = null;
			this.hvnBroken = false;
			return;
		}
		if (this.hvnLevel === null && this.dailyProfile.hvn.length > 0) {
			const hvnList = this.dailyProfile.hvn;
			if (this.trendDirection === "UP") {
				const candidates = hvnList.filter((level) => level < close);
				if (candidates.length > 0) this.hvnLevel = Math.max(...candidates);
			} else {
				const candidates = hvnList.filter((level) => level > close);
				if (candidates.length > 0) this.hvnLevel = Math.min(...candidates);
			}
		}
		if (this.hvnLevel === null) return;
		if (!this.hvnBroken) {
			if (this.trendDirection === "UP" && high > this.hvnLevel) this.hvnBroken = true;
			else if (this.trendDirection === "DOWN" && low < this.hvnLevel) this.hvnBroken = true;
		}
		if (this.hvnBroken) {
			const tolerance = .05;
			if (this.trendDirection === "UP" && close <= this.hvnLevel + tolerance && close >= this.hvnLevel - tolerance) {
				this.signals.push({
					type: "BUY",
					price: close,
					time,
					instrumentUid: this.instrumentUid,
					reason: `Тренд вверх, ретест HVN ${this.hvnLevel}`
				});
				this.hasPosition = true;
				this.lastTradeTime = now;
				this.hvnLevel = null;
				this.hvnBroken = false;
			} else if (this.trendDirection === "DOWN" && close >= this.hvnLevel - tolerance && close <= this.hvnLevel + tolerance) {
				this.signals.push({
					type: "SELL",
					price: close,
					time,
					instrumentUid: this.instrumentUid,
					reason: `Тренд вниз, ретест HVN ${this.hvnLevel}`
				});
				this.hasPosition = true;
				this.lastTradeTime = now;
				this.hvnLevel = null;
				this.hvnBroken = false;
			}
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.dailyProfile = profile;
		this.hasPosition = false;
		this.hvnLevel = null;
		this.hvnBroken = false;
		this.trendDirection = null;
		this.volumeHistory = [];
	}
};
//#endregion
//#region src/main/services/backtest/batchBacktestRunner.ts
var BatchBacktestRunner = class {
	cancelled = false;
	async run(instrumentUids, dateFrom, dateTo, interval, token, paramSets, strategyType, profileResolution, valueAreaPercent, onProgress) {
		const loader = new HistoricalDataLoader();
		const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
		for (const uid of instrumentUids) {
			if (this.cancelled) break;
			for (const params of paramSets) {
				if (this.cancelled) break;
				const portfolio = new VirtualPortfolio({
					initialCapital: 1e5,
					stopLossPercent: params.stopLossPercent,
					takeProfitPercent: params.takeProfitPercent,
					trailingDistancePercent: params.trailingDistancePercent,
					lotQuantity: params.lots,
					positionSizing: params.positionSizing,
					riskPercent: params.riskPercent
				});
				let totalSignals = 0;
				let lastClose = 0;
				let currentDate = /* @__PURE__ */ new Date(dateFrom + "T00:00:00Z");
				const endDate = /* @__PURE__ */ new Date(dateTo + "T00:00:00Z");
				while (currentDate <= endDate) {
					if (this.cancelled) break;
					const dayOfWeek = currentDate.getDay();
					if (dayOfWeek !== 0 && dayOfWeek !== 6) {
						const dateStr = currentDate.toISOString().split("T")[0];
						const dayFrom = /* @__PURE__ */ new Date(dateStr + "T07:00:00Z");
						const dayTo = /* @__PURE__ */ new Date(dateStr + "T16:00:00Z");
						let candles = [];
						let retries = 3;
						while (retries > 0 && candles.length === 0) try {
							await delay(1e3);
							candles = await loader.loadIntradayCandles(uid, dayFrom, dayTo, token, interval);
						} catch (e) {
							retries--;
							console.warn(`[Batch] Ошибка загрузки за ${dateStr}, осталось попыток: ${retries}`, e.message);
							if (retries > 0) await delay(2e3);
						}
						if (candles.length > 0) {
							const engine = new VolumeProfileEngine({
								profileResolution,
								valueAreaPercent
							});
							candles.forEach((c) => engine.onCandle?.(c));
							const profile = engine.getProfile(uid);
							if (profile) {
								const strategyOptions = {
									volumeFilterEnabled: params.volumeFilterEnabled,
									volumeFilterPeriod: params.volumeFilterPeriod
								};
								const strategy = strategyType === "trend" ? new TrendStrategy(uid, profile, strategyOptions) : new VolumeAccumulationStrategy(uid, profile, strategyOptions);
								for (const candle of candles) {
									strategy.onCandle(candle);
									const newSignals = strategy.getSignals();
									totalSignals += newSignals.length;
									for (const signal of newSignals) portfolio.processSignal(signal);
									strategy.clearSignals();
									const high = quotationToNumber(candle.high);
									const low = quotationToNumber(candle.low);
									const close = quotationToNumber(candle.close);
									lastClose = close;
									portfolio.checkStopTake(high, low, close, candle.time || "");
								}
							}
						}
					}
					currentDate.setDate(currentDate.getDate() + 1);
				}
				portfolio.finalizeWithLastPrice(lastClose, "");
				onProgress({
					instrumentUid: uid,
					params,
					stats: portfolio.getStats(),
					signals: totalSignals
				});
			}
		}
	}
	cancel() {
		this.cancelled = true;
	}
	isCancelled() {
		return this.cancelled;
	}
};
//#endregion
//#region src/api/tbank/ordersTypes.ts
/** Тип идентификатора заявки */
var OrderIdType = /* @__PURE__ */ function(OrderIdType) {
	/** Тип идентификатора не указан */
	OrderIdType[OrderIdType["ORDER_ID_TYPE_UNSPECIFIED"] = 0] = "ORDER_ID_TYPE_UNSPECIFIED";
	/** Биржевой идентификатор */
	OrderIdType[OrderIdType["ORDER_ID_TYPE_EXCHANGE"] = 1] = "ORDER_ID_TYPE_EXCHANGE";
	/** Ключ идемпотентности, переданный клиентом */
	OrderIdType[OrderIdType["ORDER_ID_TYPE_REQUEST"] = 2] = "ORDER_ID_TYPE_REQUEST";
	return OrderIdType;
}({});
/** Направление операции */
var OrderDirection = /* @__PURE__ */ function(OrderDirection) {
	/** Значение не указано */
	OrderDirection[OrderDirection["ORDER_DIRECTION_UNSPECIFIED"] = 0] = "ORDER_DIRECTION_UNSPECIFIED";
	/** Покупка */
	OrderDirection[OrderDirection["ORDER_DIRECTION_BUY"] = 1] = "ORDER_DIRECTION_BUY";
	/** Продажа */
	OrderDirection[OrderDirection["ORDER_DIRECTION_SELL"] = 2] = "ORDER_DIRECTION_SELL";
	return OrderDirection;
}({});
/** Тип заявки */
var OrderType = /* @__PURE__ */ function(OrderType) {
	/** Значение не указано */
	OrderType[OrderType["ORDER_TYPE_UNSPECIFIED"] = 0] = "ORDER_TYPE_UNSPECIFIED";
	/** Лимитная */
	OrderType[OrderType["ORDER_TYPE_LIMIT"] = 1] = "ORDER_TYPE_LIMIT";
	/** Рыночная */
	OrderType[OrderType["ORDER_TYPE_MARKET"] = 2] = "ORDER_TYPE_MARKET";
	/** Лучшая цена */
	OrderType[OrderType["ORDER_TYPE_BESTPRICE"] = 3] = "ORDER_TYPE_BESTPRICE";
	return OrderType;
}({});
//#endregion
//#region src/main/services/screenerService.ts
var ScreenerService = class {
	historicalLoader;
	getToken;
	profileResolution = 50;
	valueAreaPercent = 70;
	constructor(historicalLoader, getToken) {
		this.historicalLoader = historicalLoader;
		this.getToken = getToken;
	}
	async screen(filters) {
		const token = this.getToken();
		const instruments = ((await instrumentsGrpc.shares({ instrumentStatus: 1 }, token)).instruments || []).filter((inst) => inst.apiTradeAvailableFlag === true && inst.currency?.toLowerCase() === "rub" && !inst.blockedTrading && inst.ticker && inst.figi && inst.uid);
		const results = [];
		const now = /* @__PURE__ */ new Date();
		const twoDaysAgo = /* @__PURE__ */ new Date(now.getTime() - 2880 * 60 * 1e3);
		for (const instr of instruments) {
			const uid = instr.uid;
			const figi = instr.figi;
			const ticker = instr.ticker;
			const name = instr.name;
			try {
				await new Promise((resolve) => setTimeout(resolve, 150));
				let candles = null;
				let attempts = 0;
				while (attempts < 2) try {
					candles = await this.historicalLoader.loadIntradayCandles(uid, twoDaysAgo, now, token, CandleInterval.CANDLE_INTERVAL_HOUR);
					break;
				} catch (err) {
					if (err.code === 8) {
						console.warn(`Rate limit hit for ${ticker}, waiting 3s...`);
						await new Promise((resolve) => setTimeout(resolve, 3e3));
						attempts++;
					} else throw err;
				}
				if (!candles || candles.length < 5) {
					results.push({
						figi,
						ticker,
						name,
						uid,
						lastPrice: 0,
						avgVolumePerCandle: 0,
						vaWidthPercent: 0,
						pocStrength: 0,
						poc: 0,
						vah: 0,
						val: 0,
						error: "Not enough candles"
					});
					continue;
				}
				const validCandles = candles.filter((c) => {
					const high = this.q(c.high);
					const low = this.q(c.low);
					const close = this.q(c.close);
					return Number(c.volume || "0") > 0 && high > 0 && low > 0 && close > 0;
				});
				if (validCandles.length < 3) {
					results.push({
						figi,
						ticker,
						name,
						uid,
						lastPrice: 0,
						avgVolumePerCandle: 0,
						vaWidthPercent: 0,
						pocStrength: 0,
						poc: 0,
						vah: 0,
						val: 0,
						error: "Invalid candles"
					});
					continue;
				}
				const avgVolumePerCandle = validCandles.reduce((s, c) => s + Number(c.volume || "0"), 0) / validCandles.length;
				if (filters.minAvgVolume && avgVolumePerCandle < filters.minAvgVolume) {
					results.push({
						figi,
						ticker,
						name,
						uid,
						lastPrice: 0,
						avgVolumePerCandle,
						vaWidthPercent: 0,
						pocStrength: 0,
						poc: 0,
						vah: 0,
						val: 0,
						error: "Volume too low"
					});
					continue;
				}
				const engine = new VolumeProfileEngine({
					profileResolution: this.profileResolution,
					valueAreaPercent: this.valueAreaPercent,
					skipAutoSubscribe: true
				});
				validCandles.forEach((c) => engine.feedCandle(c));
				const profile = engine.getProfile(uid);
				if (!profile || profile.totalVolume === 0) {
					results.push({
						figi,
						ticker,
						name,
						uid,
						lastPrice: 0,
						avgVolumePerCandle,
						vaWidthPercent: 0,
						pocStrength: 0,
						poc: 0,
						vah: 0,
						val: 0,
						error: "No profile"
					});
					continue;
				}
				const vaWidthPercent = (profile.valueAreaHigh - profile.valueAreaLow) / profile.poc * 100;
				if (filters.maxVaWidthPercent && vaWidthPercent > filters.maxVaWidthPercent) {
					results.push({
						figi,
						ticker,
						name,
						uid,
						lastPrice: profile.poc,
						avgVolumePerCandle,
						vaWidthPercent,
						pocStrength: 0,
						poc: profile.poc,
						vah: profile.valueAreaHigh,
						val: profile.valueAreaLow,
						error: "VA too wide"
					});
					continue;
				}
				let vaVolume = 0;
				let pocVolumeInVA = 0;
				for (const v of profile.volumeByPrice) if (v.price >= profile.valueAreaLow && v.price <= profile.valueAreaHigh) {
					vaVolume += v.volume;
					if (v.price === profile.poc) pocVolumeInVA = v.volume;
				}
				const pocStrength = vaVolume > 0 ? pocVolumeInVA / vaVolume : 0;
				if (filters.minPocStrength && pocStrength < filters.minPocStrength) {
					results.push({
						figi,
						ticker,
						name,
						uid,
						lastPrice: profile.poc,
						avgVolumePerCandle,
						vaWidthPercent,
						pocStrength,
						poc: profile.poc,
						vah: profile.valueAreaHigh,
						val: profile.valueAreaLow,
						error: "POC too weak"
					});
					continue;
				}
				results.push({
					figi,
					ticker,
					name,
					uid,
					lastPrice: profile.poc,
					avgVolumePerCandle: Math.round(avgVolumePerCandle),
					vaWidthPercent: Math.round(vaWidthPercent * 100) / 100,
					pocStrength: Math.round(pocStrength * 100) / 100,
					poc: profile.poc,
					vah: profile.valueAreaHigh,
					val: profile.valueAreaLow
				});
				engine.reset(uid);
			} catch (err) {
				results.push({
					figi,
					ticker,
					name,
					uid,
					lastPrice: 0,
					avgVolumePerCandle: 0,
					vaWidthPercent: 0,
					pocStrength: 0,
					poc: 0,
					vah: 0,
					val: 0,
					error: err.message
				});
			}
		}
		results.sort((a, b) => (a.error ? 1 : 0) - (b.error ? 1 : 0) || b.avgVolumePerCandle - a.avgVolumePerCandle);
		return results;
	}
	q(quotation) {
		if (!quotation) return 0;
		return Number(quotation.units || 0) + (quotation.nano || 0) / 1e9;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/TrendStrategyPro.ts
var TrendStrategyPro = class {
	signals = [];
	dailyProfile = null;
	instrumentUid;
	prevCandle = null;
	fvgList = [];
	hasPosition = false;
	constructor(instrumentUid, dailyProfile) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
	}
	reset() {
		this.signals = [];
		this.prevCandle = null;
		this.fvgList = [];
		this.hasPosition = false;
	}
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const vah = this.dailyProfile.valueAreaHigh;
		const val = this.dailyProfile.valueAreaLow;
		const hvnLevels = this.dailyProfile.hvn || [];
		if (this.prevCandle) {
			const prevHigh = quotationToNumber(this.prevCandle.high);
			const prevLow = quotationToNumber(this.prevCandle.low);
			const curLow = quotationToNumber(candle.low);
			const curHigh = quotationToNumber(candle.high);
			if (curLow > prevHigh) this.fvgList.push({
				type: "bullish",
				top: curLow,
				bottom: prevHigh,
				time
			});
			else if (curHigh < prevLow) this.fvgList.push({
				type: "bearish",
				top: prevLow,
				bottom: curHigh,
				time
			});
		}
		this.prevCandle = candle;
		for (const fvg of this.fvgList) {
			if (!hvnLevels.some((level) => level >= fvg.bottom && level <= fvg.top)) continue;
			if (close > vah && fvg.type === "bullish") {
				this.signals.push({
					type: "BUY",
					price: close,
					time,
					instrumentUid: this.instrumentUid,
					reason: `Trend Pro: Bullish FVG + HVN above VAH`
				});
				this.hasPosition = true;
				this.fvgList = [];
				return;
			}
			if (close < val && fvg.type === "bearish") {
				this.signals.push({
					type: "SELL",
					price: close,
					time,
					instrumentUid: this.instrumentUid,
					reason: `Trend Pro: Bearish FVG + HVN below VAL`
				});
				this.hasPosition = true;
				this.fvgList = [];
				return;
			}
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.dailyProfile = profile;
		this.fvgList = [];
		this.prevCandle = null;
		this.hasPosition = false;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/POCPullbackStrategy.ts
var POCPullbackStrategy = class {
	signals = [];
	dailyProfile = null;
	instrumentUid;
	priceAbovePOC = false;
	priceBelowPOC = false;
	hasPosition = false;
	constructor(instrumentUid, dailyProfile) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
	}
	reset() {
		this.signals = [];
		this.priceAbovePOC = false;
		this.priceBelowPOC = false;
		this.hasPosition = false;
	}
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const poc = this.dailyProfile.poc;
		if (high > poc) {
			this.priceAbovePOC = true;
			this.priceBelowPOC = false;
		}
		if (low < poc) {
			this.priceBelowPOC = true;
			this.priceAbovePOC = false;
		}
		if (this.priceAbovePOC && close <= poc) {
			this.signals.push({
				type: "BUY",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `POC Pullback long from above (POC=${poc})`
			});
			this.hasPosition = true;
			this.priceAbovePOC = false;
		}
		if (this.priceBelowPOC && close >= poc) {
			this.signals.push({
				type: "SELL",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `POC Pullback short from below (POC=${poc})`
			});
			this.hasPosition = true;
			this.priceBelowPOC = false;
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.dailyProfile = profile;
		this.priceAbovePOC = false;
		this.priceBelowPOC = false;
		this.hasPosition = false;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/DailyVAReversalStrategy.ts
var DailyVAReversalStrategy = class {
	signals = [];
	dailyProfile = null;
	instrumentUid;
	aboveVA = false;
	belowVA = false;
	hasPosition = false;
	constructor(instrumentUid, dailyProfile) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
	}
	reset() {
		this.signals = [];
		this.aboveVA = false;
		this.belowVA = false;
		this.hasPosition = false;
	}
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const vah = this.dailyProfile.valueAreaHigh;
		const val = this.dailyProfile.valueAreaLow;
		if (high > vah) {
			this.aboveVA = true;
			this.belowVA = false;
		}
		if (low < val) {
			this.belowVA = true;
			this.aboveVA = false;
		}
		if (this.aboveVA && close < vah) {
			this.signals.push({
				type: "SELL",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Return to VA after breaking high (VAH=${vah})`
			});
			this.hasPosition = true;
			this.aboveVA = false;
		}
		if (this.belowVA && close > val) {
			this.signals.push({
				type: "BUY",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Return to VA after breaking low (VAL=${val})`
			});
			this.hasPosition = true;
			this.belowVA = false;
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.dailyProfile = profile;
		this.aboveVA = false;
		this.belowVA = false;
		this.hasPosition = false;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/FVGVolumeStrategy.ts
var FVGVolumeStrategy = class {
	signals = [];
	dailyProfile = null;
	instrumentUid;
	fvgList = [];
	hasPosition = false;
	prevCandle = null;
	constructor(instrumentUid, dailyProfile) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
	}
	reset() {
		this.signals = [];
		this.fvgList = [];
		this.hasPosition = false;
		this.prevCandle = null;
	}
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		if (this.prevCandle) {
			const prevHigh = quotationToNumber(this.prevCandle.high);
			const prevLow = quotationToNumber(this.prevCandle.low);
			const curLow = quotationToNumber(candle.low);
			const curHigh = quotationToNumber(candle.high);
			if (curLow > prevHigh) this.fvgList.push({
				type: "bullish",
				top: curLow,
				bottom: prevHigh,
				time
			});
			else if (curHigh < prevLow) this.fvgList.push({
				type: "bearish",
				top: prevLow,
				bottom: curHigh,
				time
			});
		}
		this.prevCandle = candle;
		const hvnLevels = this.dailyProfile.hvn || [];
		for (const fvg of this.fvgList) if (hvnLevels.some((level) => level >= fvg.bottom && level <= fvg.top)) {
			if (fvg.type === "bullish") this.signals.push({
				type: "BUY",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Bullish FVG + Volume Cluster`
			});
			else this.signals.push({
				type: "SELL",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Bearish FVG + Volume Cluster`
			});
			this.hasPosition = true;
			this.fvgList = [];
			break;
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.dailyProfile = profile;
		this.fvgList = [];
		this.prevCandle = null;
		this.hasPosition = false;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/RejectionStrategy.ts
var RejectionStrategy = class {
	signals = [];
	dailyProfile = null;
	instrumentUid;
	hasPosition = false;
	constructor(instrumentUid, dailyProfile) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
	}
	reset() {
		this.signals = [];
		this.hasPosition = false;
	}
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const open = quotationToNumber(candle.open);
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const body = Math.abs(close - open);
		const upperWick = high - Math.max(open, close);
		const lowerWick = Math.min(open, close) - low;
		const totalRange = high - low;
		if (totalRange === 0) return;
		const isRejectionUp = lowerWick > totalRange * .6 && body < totalRange * .3;
		const isRejectionDown = upperWick > totalRange * .6 && body < totalRange * .3;
		if (!isRejectionUp && !isRejectionDown) return;
		if (!(this.dailyProfile.hvn || []).some((level) => Math.abs(close - level) < 1)) return;
		if (isRejectionDown) {
			this.signals.push({
				type: "SELL",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Rejection down from HVN`
			});
			this.hasPosition = true;
		} else if (isRejectionUp) {
			this.signals.push({
				type: "BUY",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Rejection up from HVN`
			});
			this.hasPosition = true;
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.dailyProfile = profile;
		this.hasPosition = false;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/InitialBalanceStrategy.ts
var InitialBalanceStrategy = class {
	signals = [];
	ibHigh = 0;
	ibLow = 0;
	ibPeriodMinutes;
	instrumentUid;
	profile;
	candlesInPeriod = [];
	periodExpired = false;
	constructor(instrumentUid, profile, ibMinutes = 60) {
		this.instrumentUid = instrumentUid;
		this.profile = profile;
		this.ibPeriodMinutes = ibMinutes;
	}
	onCandle(candle) {
		if (this.periodExpired) return;
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const volume = Number(candle.volume || "0");
		this.candlesInPeriod.push({
			time,
			high,
			low,
			close,
			volume
		});
		if ((new Date(time).getTime() - new Date(this.candlesInPeriod[0].time).getTime()) / 6e4 >= this.ibPeriodMinutes) {
			this.ibHigh = Math.max(...this.candlesInPeriod.map((c) => c.high));
			this.ibLow = Math.min(...this.candlesInPeriod.map((c) => c.low));
			this.periodExpired = true;
		} else return;
		if (close > this.ibHigh && volume > this.averageVolume() * 1.5) this.signals.push({
			type: "BUY",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `IB breakout up (high=${this.ibHigh})`
		});
		else if (close < this.ibLow && volume > this.averageVolume() * 1.5) this.signals.push({
			type: "SELL",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `IB breakout down (low=${this.ibLow})`
		});
	}
	averageVolume() {
		if (this.candlesInPeriod.length === 0) return 0;
		return this.candlesInPeriod.reduce((s, c) => s + c.volume, 0) / this.candlesInPeriod.length;
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	reset() {
		this.signals = [];
		this.periodExpired = false;
		this.candlesInPeriod = [];
		this.ibHigh = 0;
		this.ibLow = 0;
	}
	updateProfile(profile) {
		this.profile = profile;
		this.reset();
	}
};
//#endregion
//#region src/main/services/backtest/strategies/VABreakoutRetestStrategy.ts
var VABreakoutRetestStrategy = class {
	signals = [];
	instrumentUid;
	profile;
	brokenHigh = false;
	brokenLow = false;
	retestHigh = false;
	retestLow = false;
	constructor(instrumentUid, profile) {
		this.instrumentUid = instrumentUid;
		this.profile = profile;
	}
	onCandle(candle) {
		if (!this.profile) return;
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const volume = Number(candle.volume || "0");
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		const avgVolume = 5e4;
		if (high > this.profile.valueAreaHigh && volume > avgVolume * 1.2) {
			this.brokenHigh = true;
			this.brokenLow = false;
		}
		if (low < this.profile.valueAreaLow && volume > avgVolume * 1.2) {
			this.brokenLow = true;
			this.brokenHigh = false;
		}
		if (this.brokenHigh && !this.retestHigh) {
			if (low <= this.profile.valueAreaHigh && close > this.profile.valueAreaHigh) {
				this.signals.push({
					type: "BUY",
					price: close,
					time,
					instrumentUid: this.instrumentUid,
					reason: `Return to VAH after breakout (VAH=${this.profile.valueAreaHigh})`
				});
				this.retestHigh = true;
				this.brokenHigh = false;
			}
		}
		if (this.brokenLow && !this.retestLow) {
			if (high >= this.profile.valueAreaLow && close < this.profile.valueAreaLow) {
				this.signals.push({
					type: "SELL",
					price: close,
					time,
					instrumentUid: this.instrumentUid,
					reason: `Return to VAL after breakout (VAL=${this.profile.valueAreaLow})`
				});
				this.retestLow = true;
				this.brokenLow = false;
			}
		}
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	reset() {
		this.signals = [];
		this.brokenHigh = false;
		this.brokenLow = false;
		this.retestHigh = false;
		this.retestLow = false;
	}
	updateProfile(profile) {
		this.profile = profile;
		this.reset();
	}
};
//#endregion
//#region src/main/services/backtest/strategies/SFPStrategy.ts
var SFPStrategy = class {
	signals = [];
	instrumentUid;
	profile;
	previousHigh = 0;
	previousLow = Infinity;
	windowCandles = [];
	constructor(instrumentUid, profile) {
		this.instrumentUid = instrumentUid;
		this.profile = profile;
	}
	onCandle(candle) {
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const volume = Number(candle.volume || "0");
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		this.windowCandles.push(candle);
		if (this.windowCandles.length > 10) this.windowCandles.shift();
		if (this.windowCandles.length >= 3) {
			const prevCandles = this.windowCandles.slice(0, -1);
			this.previousHigh = Math.max(...prevCandles.map((c) => quotationToNumber(c.high)));
			this.previousLow = Math.min(...prevCandles.map((c) => quotationToNumber(c.low)));
		}
		if (high > this.previousHigh && close < this.previousHigh && volume > this.averageVolume() * 1.3) this.signals.push({
			type: "SELL",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `Swing failure – false breakout above ${this.previousHigh}`
		});
		if (low < this.previousLow && close > this.previousLow && volume > this.averageVolume() * 1.3) this.signals.push({
			type: "BUY",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `Swing failure – false breakdown below ${this.previousLow}`
		});
	}
	averageVolume() {
		if (this.windowCandles.length === 0) return 0;
		return this.windowCandles.reduce((s, c) => s + Number(c.volume || "0"), 0) / this.windowCandles.length;
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	reset() {
		this.signals = [];
		this.windowCandles = [];
		this.previousHigh = 0;
		this.previousLow = Infinity;
	}
	updateProfile(profile) {
		this.profile = profile;
		this.reset();
	}
};
//#endregion
//#region src/main/services/backtest/strategies/AnchoredVWAPStrategy.ts
var AnchoredVWAPStrategy = class {
	signals = [];
	instrumentUid;
	profile;
	anchorTime;
	vwapNumerator = 0;
	vwapDenominator = 0;
	avwapValues = [];
	currentAVWAP = 0;
	trendDirection = null;
	trendConfirmed = false;
	constructor(instrumentUid, profile, anchorTime) {
		this.instrumentUid = instrumentUid;
		this.profile = profile;
		this.anchorTime = anchorTime ? anchorTime.getTime() : Date.now() - 36e5;
	}
	onCandle(candle) {
		if (new Date(candle.time || Date.now()).getTime() < this.anchorTime) return;
		const high = quotationToNumber(candle.high);
		const low = quotationToNumber(candle.low);
		const close = quotationToNumber(candle.close);
		const volume = Number(candle.volume || "0");
		const typicalPrice = (high + low + close) / 3;
		this.vwapNumerator += typicalPrice * volume;
		this.vwapDenominator += volume;
		this.currentAVWAP = this.vwapDenominator > 0 ? this.vwapNumerator / this.vwapDenominator : close;
		this.avwapValues.push(this.currentAVWAP);
		if (this.avwapValues.length > 20) this.avwapValues.shift();
		if (this.avwapValues.length >= 5) {
			const first = this.avwapValues[this.avwapValues.length - 5];
			const change = (this.avwapValues[this.avwapValues.length - 1] - first) / first;
			if (change > .001) {
				this.trendDirection = "up";
				this.trendConfirmed = true;
			} else if (change < -.001) {
				this.trendDirection = "down";
				this.trendConfirmed = true;
			} else this.trendConfirmed = false;
		}
		if (!this.trendConfirmed) return;
		if (this.trendDirection === "up" && low <= this.currentAVWAP && close > this.currentAVWAP) this.signals.push({
			type: "BUY",
			price: close,
			time: candle.time || (/* @__PURE__ */ new Date()).toISOString(),
			instrumentUid: this.instrumentUid,
			reason: `Bounce off AVWAP in uptrend (AVWAP=${this.currentAVWAP.toFixed(2)})`
		});
		else if (this.trendDirection === "down" && high >= this.currentAVWAP && close < this.currentAVWAP) this.signals.push({
			type: "SELL",
			price: close,
			time: candle.time || (/* @__PURE__ */ new Date()).toISOString(),
			instrumentUid: this.instrumentUid,
			reason: `Bounce off AVWAP in downtrend (AVWAP=${this.currentAVWAP.toFixed(2)})`
		});
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	reset() {
		this.signals = [];
		this.vwapNumerator = 0;
		this.vwapDenominator = 0;
		this.avwapValues = [];
		this.currentAVWAP = 0;
		this.trendConfirmed = false;
		this.trendDirection = null;
	}
	updateProfile(profile) {
		this.profile = profile;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/AbsorptionStrategy.ts
var AbsorptionStrategy = class {
	signals = [];
	instrumentUid;
	profile;
	orderFlow;
	constructor(instrumentUid, profile, orderFlow) {
		this.instrumentUid = instrumentUid;
		this.profile = profile;
		this.orderFlow = orderFlow;
	}
	onCandle(candle) {
		const absorption = this.orderFlow.detectAbsorption(this.instrumentUid);
		if (!absorption) return;
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		if (absorption.side === "ask") this.signals.push({
			type: "BUY",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `Absorption of ask wall at ${absorption.priceLevel}`
		});
		else if (absorption.side === "bid") this.signals.push({
			type: "SELL",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `Absorption of bid wall at ${absorption.priceLevel}`
		});
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	reset() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.profile = profile;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/ExhaustionStrategy.ts
var ExhaustionStrategy = class {
	signals = [];
	instrumentUid;
	profile;
	orderFlow;
	constructor(instrumentUid, profile, orderFlow) {
		this.instrumentUid = instrumentUid;
		this.profile = profile;
		this.orderFlow = orderFlow;
	}
	onCandle(candle) {
		const exhaustion = this.orderFlow.detectExhaustion(this.instrumentUid);
		if (!exhaustion) return;
		const close = quotationToNumber(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		if (exhaustion.type === "bearish") this.signals.push({
			type: "SELL",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `Bearish exhaustion (price high, delta negative)`
		});
		else if (exhaustion.type === "bullish") this.signals.push({
			type: "BUY",
			price: close,
			time,
			instrumentUid: this.instrumentUid,
			reason: `Bullish exhaustion (price low, delta positive)`
		});
	}
	getSignals() {
		return this.signals;
	}
	clearSignals() {
		this.signals = [];
	}
	reset() {
		this.signals = [];
	}
	updateProfile(profile) {
		this.profile = profile;
	}
};
//#endregion
//#region src/main/services/backtest/strategies/strategyFactory.ts
function createStrategy(name, instrumentUid, profile, orderFlow, options) {
	switch (name) {
		case "volume_accumulation": return new VolumeAccumulationStrategy(instrumentUid, profile, options);
		case "trend": return new TrendStrategy(instrumentUid, profile, options);
		case "trend_pro": return new TrendStrategyPro(instrumentUid, profile);
		case "poc_pullback": return new POCPullbackStrategy(instrumentUid, profile);
		case "daily_va_return": return new DailyVAReversalStrategy(instrumentUid, profile);
		case "fvg_volume": return new FVGVolumeStrategy(instrumentUid, profile);
		case "rejection": return new RejectionStrategy(instrumentUid, profile);
		case "initial_balance": return new InitialBalanceStrategy(instrumentUid, profile, options?.ibMinutes || 60);
		case "va_breakout_retest": return new VABreakoutRetestStrategy(instrumentUid, profile);
		case "sfp": return new SFPStrategy(instrumentUid, profile);
		case "anchored_vwap": return new AnchoredVWAPStrategy(instrumentUid, profile, options?.anchorTime ? new Date(options.anchorTime) : void 0);
		case "absorption":
			if (!orderFlow) throw new Error("AbsorptionStrategy requires OrderFlowEngine");
			return new AbsorptionStrategy(instrumentUid, profile, orderFlow);
		case "exhaustion":
			if (!orderFlow) throw new Error("ExhaustionStrategy requires OrderFlowEngine");
			return new ExhaustionStrategy(instrumentUid, profile, orderFlow);
		default: throw new Error(`Unknown strategy: ${name}`);
	}
}
function getAvailableStrategies() {
	return [
		"volume_accumulation",
		"trend",
		"trend_pro",
		"poc_pullback",
		"daily_va_return",
		"fvg_volume",
		"rejection",
		"initial_balance",
		"va_breakout_retest",
		"sfp",
		"anchored_vwap",
		"absorption",
		"exhaustion"
	];
}
//#endregion
//#region src/main/ipcHandlers/tradingAssistantHandlers.ts
var instrumentFigiMap = /* @__PURE__ */ new Map();
var orderManagerInstance = null;
var setOrderManagerInstance = (manager) => {
	orderManagerInstance = manager;
};
async function runBacktestInternal(instrumentUid, dateFrom, dateTo, intervalStr, token, params) {
	const loader = new HistoricalDataLoader();
	const interval = {
		"1min": CandleInterval.CANDLE_INTERVAL_1_MIN,
		"5min": CandleInterval.CANDLE_INTERVAL_5_MIN,
		"15min": CandleInterval.CANDLE_INTERVAL_15_MIN,
		"1hour": CandleInterval.CANDLE_INTERVAL_HOUR
	}[intervalStr] || CandleInterval.CANDLE_INTERVAL_1_MIN;
	const allCandles = [];
	const allSignals = [];
	console.log(`[LOCAL] Portfolio config:`, {
		initialCapital: 1e5,
		stopLossPercent: params.stopLossPercent,
		takeProfitPercent: params.takeProfitPercent,
		trailingDistancePercent: params.trailingDistancePercent,
		lotQuantity: params.lots,
		positionSizing: params.positionSizing,
		riskPercent: params.riskPercent
	});
	const portfolio = new VirtualPortfolio({
		initialCapital: 1e5,
		stopLossPercent: params.stopLossPercent || 0,
		takeProfitPercent: params.takeProfitPercent || 0,
		trailingDistancePercent: params.trailingDistancePercent || 0,
		lotQuantity: params.lots || 1,
		positionSizing: params.positionSizing || "fixed",
		riskPercent: params.riskPercent || 1
	});
	const strategyType = params.strategyType || "volume_accumulation";
	try {
		let currentDate = /* @__PURE__ */ new Date(dateFrom + "T00:00:00Z");
		const endDate = /* @__PURE__ */ new Date(dateTo + "T00:00:00Z");
		while (currentDate <= endDate) {
			const dateStr = currentDate.toISOString().split("T")[0];
			const dayFrom = /* @__PURE__ */ new Date(dateStr + "T07:00:00Z");
			const dayTo = /* @__PURE__ */ new Date(dateStr + "T16:00:00Z");
			const candles = await loader.loadIntradayCandles(instrumentUid, dayFrom, dayTo, token, interval);
			if (candles.length > 0) {
				const engine = new VolumeProfileEngine({
					profileResolution: params.profileResolution || 50,
					valueAreaPercent: params.valueAreaPercent || 70
				});
				candles.forEach((c) => engine.onCandle?.(c));
				const profile = engine.getProfile(instrumentUid);
				let strategy;
				try {
					strategy = createStrategy(strategyType, instrumentUid, profile, void 0, {
						volumeFilterEnabled: params.volumeFilterEnabled,
						volumeFilterPeriod: params.volumeFilterPeriod,
						ibMinutes: params.ibMinutes || 60,
						anchorTime: params.anchorTime
					});
				} catch (e) {
					console.error("Failed to create strategy:", e);
					strategy = new VolumeAccumulationStrategy(instrumentUid, profile, {
						volumeFilterEnabled: params.volumeFilterEnabled,
						volumeFilterPeriod: params.volumeFilterPeriod
					});
				}
				for (const candle of candles) {
					strategy.onCandle(candle);
					const newSignals = strategy.getSignals();
					for (const signal of newSignals) {
						portfolio.processSignal(signal);
						allSignals.push(signal);
					}
					strategy.clearSignals();
					const high = quotationToNumber(candle.high);
					const low = quotationToNumber(candle.low);
					const close = quotationToNumber(candle.close);
					portfolio.checkStopTake(high, low, close, candle.time || "");
				}
				allCandles.push(...candles);
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}
		if (allCandles.length > 0) {
			const lastCandle = allCandles[allCandles.length - 1];
			const lastPrice = quotationToNumber(lastCandle.close);
			portfolio.finalizeWithLastPrice(lastPrice, lastCandle.time || "");
		} else portfolio.finalizeWithLastPrice(0, "");
		const stats = portfolio.getStats();
		return {
			stats: {
				totalSignals: allSignals.length,
				buySignals: allSignals.filter((s) => s.type === "BUY").length,
				sellSignals: allSignals.filter((s) => s.type === "SELL").length,
				portfolio: stats
			},
			signals: allSignals,
			candles: allCandles,
			trades: portfolio.getTrades()
		};
	} catch (error) {
		console.error("Backtest error:", error);
		return null;
	}
}
var autonomousTraderInstance = null;
var setAutonomousTraderInstance = (instance) => {
	autonomousTraderInstance = instance;
};
var registerTradingAssistantHandlers = (historicalLoader, profileEngine, getToken, strategyManager, compositeProfileService, orderFlowEngine) => {
	electron.ipcMain.handle("trading-assistant:get-profile", (_, instrumentUid) => {
		const profile = volumeProfileEngine.getProfile(instrumentUid);
		return profile ? { ...profile } : null;
	});
	electron.ipcMain.on("trading-assistant:subscribe", (event) => {
		const win = electron.BrowserWindow.fromWebContents(event.sender);
		if (!win) return;
		const onProfileUpdate = (profile) => {
			if (win && !win.isDestroyed()) try {
				win.webContents.send("trading-assistant:profile-update", profile);
			} catch {}
		};
		const onSignal = (signal) => {
			if (win && !win.isDestroyed()) try {
				win.webContents.send("trading-assistant:signal", signal);
			} catch {}
		};
		volumeProfileEngine.on("profileUpdate", onProfileUpdate);
		volumeProfileEngine.on("signal", onSignal);
		win.on("closed", () => {
			volumeProfileEngine.off("profileUpdate", onProfileUpdate);
			volumeProfileEngine.off("signal", onSignal);
		});
	});
	electron.ipcMain.on("trading-assistant:unsubscribe", (event) => {});
	electron.ipcMain.handle("trading-assistant:run-backtest", async (_, instrumentUid, dateFrom, dateTo, intervalStr, token, params) => {
		const loader = new HistoricalDataLoader();
		const interval = {
			"1min": CandleInterval.CANDLE_INTERVAL_1_MIN,
			"5min": CandleInterval.CANDLE_INTERVAL_5_MIN,
			"15min": CandleInterval.CANDLE_INTERVAL_15_MIN,
			"1hour": CandleInterval.CANDLE_INTERVAL_HOUR
		}[intervalStr] || CandleInterval.CANDLE_INTERVAL_1_MIN;
		const allCandles = [];
		const allSignals = [];
		const portfolio = new VirtualPortfolio({
			initialCapital: 1e5,
			stopLossPercent: params.stopLossPercent || 0,
			takeProfitPercent: params.takeProfitPercent || 0,
			trailingDistancePercent: params.trailingDistancePercent || 0,
			lotQuantity: params.lots || 1,
			positionSizing: params.positionSizing || "fixed",
			riskPercent: params.riskPercent || 1
		});
		const strategyType = params.strategyType || "volume_accumulation";
		try {
			let currentDate = /* @__PURE__ */ new Date(dateFrom + "T00:00:00Z");
			const endDate = /* @__PURE__ */ new Date(dateTo + "T00:00:00Z");
			while (currentDate <= endDate) {
				const dateStr = currentDate.toISOString().split("T")[0];
				const dayFrom = /* @__PURE__ */ new Date(dateStr + "T07:00:00Z");
				const dayTo = /* @__PURE__ */ new Date(dateStr + "T16:00:00Z");
				const candles = await loader.loadIntradayCandles(instrumentUid, dayFrom, dayTo, token, interval);
				if (candles.length > 0) {
					const engine = new VolumeProfileEngine({
						profileResolution: params.profileResolution || 50,
						valueAreaPercent: params.valueAreaPercent || 70
					});
					candles.forEach((c) => engine.onCandle?.(c));
					const profile = engine.getProfile(instrumentUid);
					let strategy;
					try {
						strategy = createStrategy(strategyType, instrumentUid, profile, void 0, {
							volumeFilterEnabled: params.volumeFilterEnabled,
							volumeFilterPeriod: params.volumeFilterPeriod,
							ibMinutes: params.ibMinutes || 60,
							anchorTime: params.anchorTime
						});
					} catch (e) {
						console.error("Failed to create strategy:", e);
						strategy = new VolumeAccumulationStrategy(instrumentUid, profile, {
							volumeFilterEnabled: params.volumeFilterEnabled,
							volumeFilterPeriod: params.volumeFilterPeriod
						});
					}
					for (const candle of candles) {
						strategy.onCandle(candle);
						const newSignals = strategy.getSignals();
						for (const signal of newSignals) {
							portfolio.processSignal(signal);
							allSignals.push(signal);
						}
						strategy.clearSignals();
						const high = quotationToNumber(candle.high);
						const low = quotationToNumber(candle.low);
						const close = quotationToNumber(candle.close);
						portfolio.checkStopTake(high, low, close, candle.time || "");
					}
					allCandles.push(...candles);
				}
				currentDate.setDate(currentDate.getDate() + 1);
			}
			if (allCandles.length > 0) {
				const lastCandle = allCandles[allCandles.length - 1];
				const lastPrice = quotationToNumber(lastCandle.close);
				portfolio.finalizeWithLastPrice(lastPrice, lastCandle.time || "");
			} else portfolio.finalizeWithLastPrice(0, "");
			const stats = portfolio.getStats();
			const backtestStats = {
				totalSignals: allSignals.length,
				buySignals: allSignals.filter((s) => s.type === "BUY").length,
				sellSignals: allSignals.filter((s) => s.type === "SELL").length,
				portfolio: stats
			};
			const trades = portfolio.getTrades();
			let lastProfile = null;
			if (allCandles.length > 0) {
				const lastEngine = new VolumeProfileEngine({
					profileResolution: params.profileResolution || 50,
					valueAreaPercent: params.valueAreaPercent || 70
				});
				const lastDayCandles = allCandles.filter((c) => c.time?.startsWith(dateTo));
				if (lastDayCandles.length === 0) allCandles.slice(-540).forEach((c) => lastEngine.onCandle?.(c));
				else lastDayCandles.forEach((c) => lastEngine.onCandle?.(c));
				lastProfile = lastEngine.getProfile(instrumentUid);
			}
			return {
				profile: lastProfile,
				stats: backtestStats,
				signals: allSignals,
				candles: allCandles,
				trades
			};
		} catch (error) {
			console.error("Backtest error:", error);
			return null;
		}
	});
	electron.ipcMain.handle("trading-assistant:batch-backtest", async (event, instrumentUids, dateFrom, dateTo, intervalStr, token, paramSets, strategyType, profileResolution, valueAreaPercent) => {
		const interval = {
			"1min": CandleInterval.CANDLE_INTERVAL_1_MIN,
			"5min": CandleInterval.CANDLE_INTERVAL_5_MIN,
			"15min": CandleInterval.CANDLE_INTERVAL_15_MIN,
			"1hour": CandleInterval.CANDLE_INTERVAL_HOUR
		}[intervalStr] || CandleInterval.CANDLE_INTERVAL_1_MIN;
		const runner = new BatchBacktestRunner();
		const total = instrumentUids.length * paramSets.length;
		let completed = 0;
		currentBatchRunner = runner;
		await runner.run(instrumentUids, dateFrom, dateTo, interval, token, paramSets, strategyType, profileResolution, valueAreaPercent, (item) => {
			completed++;
			event.sender.send("trading-assistant:batch-progress", {
				item,
				completed,
				total
			});
		});
		currentBatchRunner = null;
		event.sender.send("trading-assistant:batch-complete", { total: completed });
		return { completed };
	});
	electron.ipcMain.handle("trading-assistant:batch-v2", async (event, instrumentUids, dateFrom, dateTo, intervalStr, token, paramSets, strategyType, profileResolution, valueAreaPercent) => {
		const total = instrumentUids.length * paramSets.length;
		let completed = 0;
		const runner = {
			cancelled: false,
			cancel: () => {
				runner.cancelled = true;
			}
		};
		currentBatchRunner = runner;
		for (const uid of instrumentUids) {
			if (runner.cancelled) break;
			for (const params of paramSets) {
				if (runner.cancelled) break;
				const result = await runBacktestInternal(uid, dateFrom, dateTo, intervalStr, token, {
					...params,
					strategyType,
					profileResolution,
					valueAreaPercent
				});
				completed++;
				if (result) event.sender.send("trading-assistant:batch-progress", {
					item: {
						instrumentUid: uid,
						params,
						stats: result.stats.portfolio,
						signals: result.signals?.length || 0
					},
					completed,
					total
				});
				else event.sender.send("trading-assistant:batch-progress", {
					item: null,
					completed,
					total
				});
			}
		}
		currentBatchRunner = null;
		event.sender.send("trading-assistant:batch-complete", { total: completed });
		return { completed };
	});
	let currentBatchRunner = null;
	electron.ipcMain.handle("trading-assistant:batch-stop", async () => {
		if (currentBatchRunner) {
			currentBatchRunner.cancel();
			return true;
		}
		return false;
	});
	electron.ipcMain.handle("trading-assistant:send-backtest-signals", async (_, signals) => {
		if (!orderManagerInstance) return {
			success: false,
			error: "OrderManager не инициализирован"
		};
		for (const signal of signals) await orderManagerInstance.processSignal(signal);
		return { success: true };
	});
	electron.ipcMain.handle("trading-assistant:toggle-trading", async (_, enabled) => {
		if (orderManagerInstance) {
			orderManagerInstance.setRunning(enabled);
			return true;
		}
		return false;
	});
	electron.ipcMain.handle("trading-assistant:get-trading-status", async () => {
		return orderManagerInstance ? orderManagerInstance.isRunning : false;
	});
	electron.ipcMain.handle("trading-assistant:set-lot-quantity", async (_, qty) => {
		if (orderManagerInstance) orderManagerInstance.config.lotQuantity = qty;
	});
	electron.ipcMain.handle("trading-assistant:get-accounts", async (_, token) => {
		if (!token) return [];
		const maxRetries = 3;
		let attempt = 0;
		while (attempt < maxRetries) try {
			console.log(`[GetAccounts] Попытка ${attempt + 1} из ${maxRetries}`);
			const accounts = (await sandboxGrpc.getSandboxAccounts({}, token)).accounts || [];
			console.log(`[GetAccounts] Получено ${accounts.length} счетов`);
			return accounts.map((acc) => ({
				id: acc.id,
				name: acc.name || acc.id
			}));
		} catch (error) {
			attempt++;
			console.error(`[GetAccounts] Ошибка (попытка ${attempt}):`, error.message);
			if (attempt >= maxRetries) throw new Error(error.message || "Неизвестная ошибка");
			await new Promise((resolve) => setTimeout(resolve, 1e3));
		}
	});
	electron.ipcMain.handle("trading-assistant:create-account", async () => {
		const token = process.env.VITE_TSandBox || "";
		if (!token) return {
			success: false,
			error: "Токен песочницы не задан"
		};
		try {
			return {
				success: true,
				accountId: (await sandboxGrpc.openSandboxAccount({}, token)).accountId
			};
		} catch (error) {
			console.error("[CreateAccount] Ошибка:", error);
			return {
				success: false,
				error: error.message
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:close-account", async (_, accountId) => {
		const token = process.env.VITE_TSandBox || "";
		if (!token || !accountId) return {
			success: false,
			error: "Токен или accountId не задан"
		};
		try {
			await sandboxGrpc.closeSandboxAccount({ accountId }, token);
			return { success: true };
		} catch (error) {
			console.error("[CloseAccount] Ошибка:", error);
			return {
				success: false,
				error: error.message
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:pay-in", async (_, amount, accountId) => {
		const token = process.env.VITE_TSandBox || "";
		if (!token || !accountId || amount <= 0) return {
			success: false,
			error: "Токен, счёт или сумма не заданы"
		};
		try {
			return {
				success: true,
				balance: (await sandboxGrpc.sandboxPayIn({
					accountId,
					amount: {
						currency: "RUB",
						units: Math.floor(amount),
						nano: Math.round(amount % 1 * 1e9)
					}
				}, token)).balance
			};
		} catch (error) {
			console.error("[PayIn] Ошибка:", error);
			return {
				success: false,
				error: error.message
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:get-balance", async (_, accountId) => {
		const token = process.env.VITE_TSandBox || "";
		if (!token || !accountId) return {
			success: false,
			error: "Токен или счёт не заданы"
		};
		try {
			const total = (await sandboxGrpc.getSandboxPortfolio({ accountId }, token)).totalAmountPortfolio;
			if (!total) return {
				success: false,
				error: "Нет данных о балансе"
			};
			return {
				success: true,
				balance: (Number(total.units || "0") + (total.nano || 0) / 1e9).toFixed(2),
				currency: total.currency || "RUB"
			};
		} catch (error) {
			console.error("[GetBalance] Ошибка:", error);
			return {
				success: false,
				error: error.message
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:update-config", async (_, config) => {
		if (orderManagerInstance) {
			orderManagerInstance.updateConfig(config);
			return true;
		}
		return false;
	});
	electron.ipcMain.handle("trading-assistant:get-today-candles", async (_, instrumentUid, token, interval) => {
		const loader = new HistoricalDataLoader();
		const today = /* @__PURE__ */ new Date();
		const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0);
		const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
		const intervalMap = {
			"1min": CandleInterval.CANDLE_INTERVAL_1_MIN,
			"5min": CandleInterval.CANDLE_INTERVAL_5_MIN,
			"15min": CandleInterval.CANDLE_INTERVAL_15_MIN,
			"1hour": CandleInterval.CANDLE_INTERVAL_HOUR
		};
		try {
			return await loader.loadIntradayCandles(instrumentUid, from, to, token, intervalMap[interval] || CandleInterval.CANDLE_INTERVAL_1_MIN);
		} catch (e) {
			console.error(e);
			return [];
		}
	});
	electron.ipcMain.handle("trading-assistant:load-historical-profile", async (_, instrumentUid, candles) => {
		const engine = volumeProfileEngine;
		candles.forEach((c) => {
			const streamCandle = {
				instrumentUid,
				open: c.open,
				high: c.high,
				low: c.low,
				close: c.close,
				volume: c.volume?.toString() || "0",
				time: c.time
			};
			engine.onCandle(streamCandle);
		});
		return true;
	});
	electron.ipcMain.handle("trading-assistant:get-all-instruments", async (_, token) => {
		if (!token) return [];
		const maxRetries = 3;
		let attempt = 0;
		while (attempt < maxRetries) try {
			console.log(`[GetAllInstruments] Попытка ${attempt + 1} из ${maxRetries}`);
			const instruments = ((await instrumentsGrpc.shares({ instrumentStatus: 1 }, token)).instruments || []).filter((inst) => inst.apiTradeAvailableFlag === true && inst.currency?.toLowerCase() === "rub");
			instruments.forEach((inst) => {
				if (inst.uid && inst.figi) instrumentFigiMap.set(inst.uid, inst.figi);
			});
			console.log(`[GetAllInstruments] Найдено ${instruments.length} российских акций`);
			return instruments.map((inst) => ({
				uid: inst.uid || inst.figi,
				name: inst.name || inst.ticker,
				ticker: inst.ticker,
				figi: inst.figi
			}));
		} catch (e) {
			attempt++;
			console.error(`[GetAllInstruments] Ошибка (попытка ${attempt}):`, e.message);
			if (attempt >= maxRetries) return [];
			await new Promise((resolve) => setTimeout(resolve, 1e3));
		}
		return [];
	});
	marketDataBus.on("candle", (candle) => {
		const win = getTradingAssistantWindow();
		if (win && !win.isDestroyed()) try {
			win.webContents.send("candle-data", candle);
		} catch {}
	});
	marketDataBus.on("lastPrice", (data) => {
		const win = getTradingAssistantWindow();
		if (win && !win.isDestroyed()) try {
			win.webContents.send("last-price-data", data);
		} catch {}
	});
	electron.ipcMain.handle("trading-assistant:get-positions", async (_, accountId) => {
		const token = process.env.VITE_TSandBox || "";
		if (!token || !accountId) return {
			money: [],
			securities: []
		};
		try {
			const response = await sandboxGrpc.getSandboxPositions({ accountId }, token);
			return {
				money: response.money || [],
				securities: response.securities || []
			};
		} catch (e) {
			console.error("[GetPositions]", e);
			return {
				money: [],
				securities: []
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:get-orders", async (_, accountId) => {
		const token = process.env.VITE_TSandBox || "";
		if (!token || !accountId) return [];
		try {
			return (await sandboxGrpc.getSandboxOrders({ accountId }, token)).orders || [];
		} catch (e) {
			console.error("[GetOrders]", e);
			return [];
		}
	});
	electron.ipcMain.handle("trading-assistant:close-position", async (_, instrumentUid, accountId, quantity, direction) => {
		const token = process.env.VITE_TSandBox || "";
		if (!token || !accountId || !instrumentUid || quantity <= 0) return {
			success: false,
			error: "Неверные параметры"
		};
		try {
			const orderDirection = direction === "long" ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY;
			console.log(`[ClosePosition] Закрываем ${quantity} ${instrumentUid} по рынку, направление: ${orderDirection}`);
			const order = await sandboxGrpc.postSandboxOrder({
				instrumentId: instrumentUid,
				direction: orderDirection,
				orderType: OrderType.ORDER_TYPE_MARKET,
				quantity,
				accountId
			}, token);
			console.log(`[ClosePosition] Ордер отправлен: ${order.orderId}`);
			return {
				success: true,
				orderId: order.orderId
			};
		} catch (error) {
			console.error("[ClosePosition] Ошибка:", error);
			return {
				success: false,
				error: error.message || "Неизвестная ошибка"
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:get-operations", async (_, accountId, from, to, cursor = "") => {
		const token = process.env.VITE_TSandBox || "";
		if (!token || !accountId) return {
			operations: [],
			hasMore: false,
			nextCursor: ""
		};
		try {
			const request = {
				accountId,
				limit: 50
			};
			if (from) request.from = {
				seconds: Math.floor((/* @__PURE__ */ new Date(from + "T00:00:00Z")).getTime() / 1e3),
				nanos: 0
			};
			if (to) request.to = {
				seconds: Math.floor((/* @__PURE__ */ new Date(to + "T23:59:59Z")).getTime() / 1e3),
				nanos: 0
			};
			if (cursor) request.cursor = cursor;
			const response = await sandboxGrpc.getSandboxOperationsByCursor(request, token);
			return {
				operations: response.items || [],
				hasMore: response.hasNext || false,
				nextCursor: response.nextCursor || ""
			};
		} catch (e) {
			console.error("[GetOperations]", e);
			return {
				operations: [],
				hasMore: false,
				nextCursor: ""
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:save-json", async (_, data, defaultName) => {
		const { filePath } = await electron.dialog.showSaveDialog({
			defaultPath: defaultName,
			filters: [{
				name: "JSON Files",
				extensions: ["json"]
			}]
		});
		if (!filePath) return {
			success: false,
			error: "Отменено пользователем"
		};
		try {
			fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
			return {
				success: true,
				filePath
			};
		} catch (e) {
			return {
				success: false,
				error: e.message
			};
		}
	});
	electron.ipcMain.handle("trading-assistant:screener-run", async (_event, filters, token) => {
		if (!token) {
			console.warn("screener:run token is empty");
			return [];
		}
		return await new ScreenerService(new HistoricalDataLoader(), () => token).screen(filters);
	});
	electron.ipcMain.handle("cloud:createTask", async (_event, serverUrl, instrumentUid, dateFrom, dateTo, interval, strategy, params) => {
		try {
			const token = await getCloudToken(serverUrl);
			return await (await fetch(`${serverUrl}/api/backtest/tasks`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${token}`
				},
				body: JSON.stringify({
					instrumentUid,
					dateFrom,
					dateTo,
					interval,
					strategy,
					params
				})
			})).json();
		} catch (err) {
			return { error: err.message };
		}
	});
	electron.ipcMain.handle("cloud:getTaskStatus", async (_event, taskId) => {
		const url = process.env.VITE_CLOUD_API_URL;
		if (!url) return { error: "CLOUD_API_URL not set" };
		const token = await getCloudToken(url);
		return await (await fetch(`${url}/api/backtest/tasks/${taskId}`, { headers: { "Authorization": `Bearer ${token}` } })).json();
	});
	electron.ipcMain.handle("cloud:getTaskResult", async (_event, taskId) => {
		const url = process.env.VITE_CLOUD_API_URL;
		if (!url) return { error: "CLOUD_API_URL not set" };
		const token = await getCloudToken(url);
		return await (await fetch(`${url}/api/backtest/results/${taskId}`, { headers: { "Authorization": `Bearer ${token}` } })).json();
	});
	electron.ipcMain.handle("cloud:getTasks", async () => {
		const url = process.env.VITE_CLOUD_API_URL;
		if (!url) return [];
		const token = await getCloudToken(url);
		return await (await fetch(`${url}/api/backtest/tasks`, { headers: { "Authorization": `Bearer ${token}` } })).json();
	});
	electron.ipcMain.handle("cloud:testConnection", async (_event, serverUrl) => {
		try {
			const res = await fetch(`${serverUrl}/`);
			return {
				ok: res.ok,
				status: res.status
			};
		} catch (err) {
			return {
				ok: false,
				error: err.message
			};
		}
	});
	let cachedToken = null;
	let tokenExpiry = 0;
	async function getCloudToken(serverUrl) {
		if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
		const data = await (await fetch(`${serverUrl}/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: process.env.CLOUD_EMAIL || "ll@me.com",
				password: process.env.CLOUD_PASSWORD || "7777"
			})
		})).json();
		if (!data.token) throw new Error("Login failed: " + JSON.stringify(data));
		cachedToken = data.token;
		tokenExpiry = Date.now() + 20 * 3600 * 1e3;
		return cachedToken;
	}
	electron.ipcMain.handle("trading-assistant:get-market-phase", async (_, instrumentUid) => {
		return await strategyManager.getCurrentPhase(instrumentUid);
	});
	electron.ipcMain.handle("trading-assistant:update-phase-mapping", (_, phase, strategyNames) => {
		strategyManager.updatePhaseMapping(phase, strategyNames);
		return true;
	});
	electron.ipcMain.handle("trading-assistant:get-orderflow-delta", (_, instrumentUid) => {
		return orderFlowEngine.getDelta(instrumentUid);
	});
	electron.ipcMain.handle("trading-assistant:composite-profile", async (_, instrumentUid, days, token) => {
		return await compositeProfileService.buildComposite(instrumentUid, days, token);
	});
	electron.ipcMain.handle("cloud:createBatch", async (_event, batchConfig) => {
		const { serverUrl, ...batch } = batchConfig;
		console.log("\x1B[1;33m[IPC] Sending batch to:\x1B[0m", `${serverUrl}/api/backtest/batch`, "with body:", JSON.stringify(batch));
		try {
			const token = await getCloudToken(serverUrl);
			console.log("\x1B[1;33m[IPC] cloud:createBatch called with serverUrl:\x1B[0m", batchConfig.serverUrl);
			console.log("\x1B[1;33m[IPC] batch body:\x1B[0m", JSON.stringify(batch));
			const resjson = await (await fetch(`${serverUrl}/api/backtest/batch`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${token}`
				},
				body: JSON.stringify(batch)
			})).json();
			console.log("\x1B[1;33m[IPC] batch response:\x1B[0m", JSON.stringify(resjson));
			return resjson;
		} catch (err) {
			return { error: err.message };
		}
	});
	electron.ipcMain.handle("cloud:getBatchStatus", async (_event, serverUrl, batchId) => {
		try {
			const token = await getCloudToken(serverUrl);
			return await (await fetch(`${serverUrl}/api/backtest/batch/${batchId}`, { headers: { "Authorization": `Bearer ${token}` } })).json();
		} catch (err) {
			return { error: err.message };
		}
	});
	electron.ipcMain.handle("cloud:getBatchResults", async (_event, serverUrl, batchId) => {
		try {
			const token = await getCloudToken(serverUrl);
			return await (await fetch(`${serverUrl}/api/backtest/batch/${batchId}/results`, { headers: { "Authorization": `Bearer ${token}` } })).json();
		} catch (err) {
			return { error: err.message };
		}
	});
	electron.ipcMain.handle("cloud:getInstruments", async (_event, serverUrl) => {
		try {
			const token = await getCloudToken(serverUrl);
			return await (await fetch(`${serverUrl}/api/screener`, { headers: { "Authorization": `Bearer ${token}` } })).json();
		} catch (err) {
			return { error: err.message };
		}
	});
	electron.ipcMain.handle("cloud:getBatches", async (_event, serverUrl) => {
		const token = await getCloudToken(serverUrl);
		return await (await fetch(`${serverUrl}/api/backtest/batches`, { headers: { "Authorization": `Bearer ${token}` } })).json();
	});
	electron.ipcMain.handle("cloud:deleteBatch", async (_event, serverUrl, batchId) => {
		const token = await getCloudToken(serverUrl);
		return await (await fetch(`${serverUrl}/api/backtest/batch/${batchId}`, {
			method: "DELETE",
			headers: { "Authorization": `Bearer ${token}` }
		})).json();
	});
	electron.ipcMain.handle("cloud:getSchedulerTasks", async (_event, serverUrl) => {
		const token = await getCloudToken(serverUrl);
		return await (await fetch(`${serverUrl}/api/scheduler`, { headers: { "Authorization": `Bearer ${token}` } })).json();
	});
	electron.ipcMain.handle("cloud:addSchedulerTask", async (_event, serverUrl, task) => {
		const token = await getCloudToken(serverUrl);
		return await (await fetch(`${serverUrl}/api/scheduler`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${token}`
			},
			body: JSON.stringify(task)
		})).json();
	});
	electron.ipcMain.handle("cloud:deleteSchedulerTask", async (_event, serverUrl, id) => {
		const token = await getCloudToken(serverUrl);
		return await (await fetch(`${serverUrl}/api/scheduler/${id}`, {
			method: "DELETE",
			headers: { "Authorization": `Bearer ${token}` }
		})).json();
	});
	electron.ipcMain.handle("trading-assistant:start-auto-trader", async (event, instrumentUid) => {
		if (!autonomousTraderInstance) return {
			success: false,
			error: "AutoTrader not initialized"
		};
		const token = process.env.VITE_TReadOnly || "";
		await autonomousTraderInstance.start(instrumentUid, token);
		const win = electron.BrowserWindow.fromWebContents(event.sender);
		if (!win) return { success: true };
		const onSignal = (data) => {
			console.log("[IPC] Получен signal от автотрейдера");
			if (!win.isDestroyed()) {
				win.webContents.send("auto-trader:signal", data);
				console.log("[IPC] signal отправлен в рендерер");
			} else console.log("[IPC] Окно уничтожено, signal не отправлен");
		};
		const onOrderSent = (data) => {
			if (!win.isDestroyed()) win.webContents.send("auto-trader:order-sent", data);
		};
		const onOrderError = (data) => {
			if (!win.isDestroyed()) win.webContents.send("auto-trader:order-error", data);
		};
		autonomousTraderInstance.on("signal", onSignal);
		autonomousTraderInstance.on("order-sent", onOrderSent);
		autonomousTraderInstance.on("order-error", onOrderError);
		return { success: true };
	});
	electron.ipcMain.handle("trading-assistant:stop-auto-trader", async (_, instrumentUid) => {
		if (!autonomousTraderInstance) return {
			success: false,
			error: "AutoTrader not initialized"
		};
		autonomousTraderInstance.stop(instrumentUid);
		return { success: true };
	});
	electron.ipcMain.handle("trading-assistant:get-active-auto-traders", async () => {
		return autonomousTraderInstance ? autonomousTraderInstance.getActiveInstruments() : [];
	});
	electron.ipcMain.handle("trading-assistant:get-orderflow-snapshot", (_, instrumentUid) => {
		return {
			delta: orderFlowEngine.getDelta(instrumentUid),
			absorption: orderFlowEngine.detectAbsorption(instrumentUid),
			exhaustion: orderFlowEngine.detectExhaustion(instrumentUid)
		};
	});
	electron.ipcMain.handle("test-stop-order", async (_, request) => {
		const token = process.env.VITE_TSandBox || "";
		if (!token) return {
			success: false,
			error: "Токен песочницы не задан"
		};
		try {
			return {
				success: true,
				resp: await sandboxGrpc.postSandboxStopOrder(request, token)
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	});
};
//#endregion
//#region src/shared/types/promptgenerator.ts
/**
* Валидирует промпт на соответствие структуре
*/
function validatePromptTemplate(prompt) {
	try {
		return !!prompt.id && !!prompt.title && !!prompt.version && !!prompt.createdAt && !!prompt.updatedAt && validateRole(prompt.role) && validateProjectContext(prompt.projectContext) && (prompt.codeContext ? validateCodeContext(prompt.codeContext) : true);
	} catch {
		return false;
	}
}
function validateRole(role) {
	return !!role.position && !!role.experience && !!role.specialization && !!role.communicationStyle;
}
function validateProjectContext(context) {
	return Array.isArray(context.technologies) && !!context.architecture?.type && Array.isArray(context.architecture?.components);
}
function validateCodeContext(context) {
	if (!context.enabled) return true;
	if (!context.language) return false;
	if (context.sourceType === void 0) return !!context.codeSnippet && typeof context.codeSnippet === "string";
	switch (context.sourceType) {
		case "snippet": return typeof context.codeSources === "string" && !!context.codeSources;
		case "multiple-snippets":
			if (!Array.isArray(context.codeSources)) return false;
			return context.codeSources.every((source) => typeof source === "object" && "code" in source && !!source.code);
		case "file-paths":
			if (!Array.isArray(context.codeSources)) return false;
			return context.codeSources.every((source) => typeof source === "object" && "path" in source && !!source.path);
		default: return false;
	}
}
//#endregion
//#region src/main/services/tbank/UsersGrpcService.ts
var client$4 = createGrpcClient("users.proto", "UsersService");
var usersGrpc = {
	getInfo: (token) => new Promise((resolve, reject) => {
		client$4.GetInfo({}, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAccounts: (request, token) => new Promise((resolve, reject) => {
		client$4.GetAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getMarginAttributes: (request, token) => new Promise((resolve, reject) => {
		client$4.GetMarginAttributes(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getUserTariff: (request, token) => new Promise((resolve, reject) => {
		client$4.GetUserTariff(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencyTransfer: (request, token) => new Promise((resolve, reject) => {
		client$4.CurrencyTransfer(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	payIn: (request, token) => new Promise((resolve, reject) => {
		client$4.PayIn(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBankAccounts: (request, token) => new Promise((resolve, reject) => {
		client$4.GetBankAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/OperationsGrpcService.ts
var client$3 = createGrpcClient("operations.proto", "OperationsService");
var operationsGrpc = {
	getOperations: (request, token) => new Promise((resolve, reject) => {
		client$3.GetOperations(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getPortfolio: (request, token) => new Promise((resolve, reject) => {
		client$3.GetPortfolio(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getPositions: (request, token) => new Promise((resolve, reject) => {
		client$3.GetPositions(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getWithdrawLimits: (request, token) => new Promise((resolve, reject) => {
		client$3.GetWithdrawLimits(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrokerReport: (request, token) => new Promise((resolve, reject) => {
		client$3.GetBrokerReport(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getDividendsForeignIssuer: (request, token) => new Promise((resolve, reject) => {
		client$3.GetDividendsForeignIssuer(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOperationsByCursor: (request, token) => new Promise((resolve, reject) => {
		client$3.GetOperationsByCursor(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/OrdersGrpcService.ts
var client$2 = createGrpcClient("orders.proto", "OrdersService");
var ordersGrpc = {
	postOrder: (request, token) => new Promise((resolve, reject) => {
		client$2.PostOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postOrderAsync: (request, token) => new Promise((resolve, reject) => {
		client$2.PostOrderAsync(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	cancelOrder: (request, token) => new Promise((resolve, reject) => {
		client$2.CancelOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrderState: (request, token) => new Promise((resolve, reject) => {
		client$2.GetOrderState(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrders: (request, token) => new Promise((resolve, reject) => {
		client$2.GetOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	replaceOrder: (request, token) => new Promise((resolve, reject) => {
		client$2.ReplaceOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getMaxLots: (request, token) => new Promise((resolve, reject) => {
		client$2.GetMaxLots(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrderPrice: (request, token) => new Promise((resolve, reject) => {
		client$2.GetOrderPrice(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/StopOrdersGrpcService.ts
var client$1 = createGrpcClient("stoporders.proto", "StopOrdersService");
var stopOrdersGrpc = {
	cancelStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$1.CancelStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getStopOrders: (request, token) => new Promise((resolve, reject) => {
		client$1.GetStopOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$1.PostStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/SignalGrpcService.ts
var client = createGrpcClient("signals.proto", "SignalService");
//#endregion
//#region src/main/ipcHandlers/grpcHandlers.ts
var grpcServices = {
	users: usersGrpc,
	instruments: instrumentsGrpc,
	marketdata: marketDataGrpc,
	operations: operationsGrpc,
	orders: ordersGrpc,
	stoporders: stopOrdersGrpc,
	sandbox: sandboxGrpc,
	signal: {
		getSignals: (request, token) => new Promise((resolve, reject) => {
			client.GetSignals(request, createMetadata(token), (err, response) => {
				if (err) reject(err);
				else resolve(response);
			});
		}),
		getStrategies: (request, token) => new Promise((resolve, reject) => {
			client.GetStrategies(request, createMetadata(token), (err, response) => {
				if (err) reject(err);
				else resolve(response);
			});
		})
	}
};
function registerGrpcHandlers() {
	electron.ipcMain.handle("grpc-call", async (_, serviceName, methodName, token, request) => {
		const service = grpcServices[serviceName];
		if (!service) throw new Error(`Unknown gRPC service: ${serviceName}`);
		if (typeof service[methodName] !== "function") throw new Error(`Unknown method: ${methodName} in ${serviceName}`);
		return await service[methodName](request, token);
	});
}
//#endregion
//#region src/main/services/taskStore.ts
var DATA_DIR = electron.app.getPath("userData");
var TASKS_FILE = path.join(DATA_DIR, "tasks.json");
function readTasks() {
	console.log("[TaskStore] Читаю файл:", TASKS_FILE);
	try {
		if (!fs.existsSync(TASKS_FILE)) return [];
		const raw = fs.readFileSync(TASKS_FILE, "utf-8");
		return JSON.parse(raw);
	} catch (err) {
		console.error("Ошибка чтения tasks.json:", err);
		return [];
	}
}
function writeTasks(tasks) {
	try {
		fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
	} catch (err) {
		console.error("Ошибка записи tasks.json:", err);
	}
}
var TaskStore = class {
	getAll() {
		return readTasks();
	}
	add(task) {
		const tasks = readTasks();
		console.log("[TaskStore] add – до записи:", tasks.length);
		tasks.push(task);
		writeTasks(tasks);
		console.log("[TaskStore] add – после записи, всего:", tasks.length);
	}
	update(updated) {
		writeTasks(readTasks().map((t) => t.id === updated.id ? updated : t));
		console.log("[TaskStore] update – обновлена задача", updated.id);
	}
	delete(id) {
		writeTasks(readTasks().filter((t) => t.id !== id));
	}
};
var taskStore = new TaskStore();
//#endregion
//#region src/main/windows/tasksWindow.ts
var tasksWindow = null;
var preloadPath = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createTasksWindow = () => {
	if (tasksWindow && !tasksWindow.isDestroyed()) {
		tasksWindow.focus();
		return tasksWindow;
	}
	tasksWindow = new electron.BrowserWindow({
		width: 900,
		height: 700,
		title: "Планировщик задач",
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	const menu = electron.Menu.buildFromTemplate(tasksWindowMenuTemplate);
	tasksWindow.setMenu(menu);
	if (process.env.NODE_ENV === "development") tasksWindow.loadURL(`${DEV_SERVER_URL}/#/tasks`);
	else tasksWindow.loadFile(getMainWindowProdPath(), { hash: "/tasks" });
	tasksWindow.on("closed", () => {
		tasksWindow = null;
	});
	return tasksWindow;
};
var getTasksWindow = () => tasksWindow;
//#endregion
//#region src/main/services/scheduler.ts
var Scheduler = class {
	timer;
	CHECK_INTERVAL = 3e4;
	cronJobs = /* @__PURE__ */ new Map();
	start() {
		console.log("[Scheduler] Started");
		this.checkTasks();
		this.timer = setInterval(() => this.checkTasks(), this.CHECK_INTERVAL);
		const tasks = taskStore.getAll().filter((t) => t.enabled && t.schedule.type === "cron");
		for (const task of tasks) this.registerCronJob(task);
	}
	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = void 0;
		}
		for (const [id, job] of this.cronJobs) job.stop();
		this.cronJobs.clear();
		console.log("[Scheduler] Stopped");
	}
	/** Перезагружает cron‑задачу при её изменении */
	refreshCronJob(task) {
		if (task.schedule.type !== "cron") return;
		this.unregisterCronJob(task.id);
		if (task.enabled) this.registerCronJob(task);
	}
	registerCronJob(task) {
		if (!_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_node_cron_dist_esm_node_cron_js.validate(task.schedule.value)) {
			console.error(`[Scheduler] Некорректное cron-выражение для задачи ${task.id}: ${task.schedule.value}`);
			return;
		}
		const job = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_node_cron_dist_esm_node_cron_js.schedule(task.schedule.value, () => {
			console.log(`[Scheduler] Cron-запуск задачи ${task.id} (${task.name})`);
			this.executeTask(task);
			task.lastRun = (/* @__PURE__ */ new Date()).toISOString();
			taskStore.update(task);
		}, { timezone: "Europe/Moscow" });
		this.cronJobs.set(task.id, job);
		console.log(`[Scheduler] Cron-задача ${task.id} зарегистрирована`);
	}
	unregisterCronJob(taskId) {
		const job = this.cronJobs.get(taskId);
		if (job) {
			job.stop();
			this.cronJobs.delete(taskId);
		}
	}
	checkTasks() {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const tasks = taskStore.getAll().filter((t) => t.enabled && t.schedule.type !== "cron");
		for (const task of tasks) {
			if (!task.nextRun) {
				this.calculateNextRun(task);
				taskStore.update(task);
				continue;
			}
			if (task.nextRun <= now) {
				this.executeTask(task);
				this.calculateNextRun(task);
				task.lastRun = now;
				taskStore.update(task);
			}
		}
	}
	calculateNextRun(task) {
		const now = /* @__PURE__ */ new Date();
		switch (task.schedule.type) {
			case "once":
				if (!task.lastRun) task.nextRun = task.schedule.value;
				else task.nextRun = void 0;
				break;
			case "interval": {
				const ms = parseInt(task.schedule.value, 10);
				const base = task.lastRun ? new Date(task.lastRun) : now;
				task.nextRun = new Date(base.getTime() + ms).toISOString();
				break;
			}
			case "cron":
				task.nextRun = void 0;
				break;
		}
	}
	async executeTask(task) {
		console.log(`[Scheduler] Executing task ${task.id} (${task.name})`);
		try {
			switch (task.action.type) {
				case "reminder":
					new electron.Notification({
						title: task.action.payload.title || "Напоминание",
						body: task.action.payload.body || task.name
					}).show();
					break;
				case "react-command": {
					const tasksWin = getTasksWindow();
					if (tasksWin && !tasksWin.isDestroyed()) {
						tasksWin.webContents.send("task:react-command", task.action.payload.command, task.action.payload.args);
						console.log(`[Scheduler] React-команда отправлена: ${task.action.payload.command}`);
					} else console.warn("[Scheduler] Окно задач не открыто, команда не отправлена");
					break;
				}
				case "main-function": {
					const { functionName, args } = task.action.payload;
					if (functionName) await this.callRegisteredFunction(functionName, args);
					else console.warn(`[Scheduler] Не указано имя функции для задачи ${task.id}`);
					break;
				}
				case "script": {
					const scriptPath = task.action.payload.path;
					if (!scriptPath) {
						console.warn("[Scheduler] Не указан путь к скрипту");
						return;
					}
					const allowedDir = path.default.join(electron.app.getPath("userData"), "scripts");
					const resolvedPath = path.default.resolve(scriptPath);
					if (!resolvedPath.startsWith(allowedDir)) {
						console.warn(`[Scheduler] Попытка запуска скрипта вне разрешённой папки: ${resolvedPath}`);
						return;
					}
					const args = Array.isArray(task.action.payload.args) ? task.action.payload.args : [];
					console.log(`[Scheduler] Запуск скрипта: ${resolvedPath} с аргументами:`, args);
					const child = (0, child_process.spawn)(resolvedPath, args, {
						shell: true,
						cwd: path.default.dirname(resolvedPath),
						env: { ...process.env }
					});
					child.stdout?.on("data", (data) => {
						console.log(`[Script stdout] ${data}`);
					});
					child.stderr?.on("data", (data) => {
						console.error(`[Script stderr] ${data}`);
					});
					child.on("close", (code) => {
						console.log(`[Scheduler] Скрипт завершился с кодом ${code}`);
					});
					child.on("error", (err) => {
						console.error(`[Scheduler] Ошибка запуска скрипта: ${err.message}`);
					});
					break;
				}
				default: console.warn(`[Scheduler] Неизвестный тип действия: ${task.action.type}`);
			}
		} catch (e) {
			console.error(`[Scheduler] Ошибка выполнения задачи ${task.id}`, e);
		}
	}
	async callRegisteredFunction(name, args) {
		if (!name) {
			console.warn("[Scheduler] Имя функции не задано");
			return;
		}
		const fn = { "refreshBonds": async () => {} }[name];
		if (fn) await fn();
		else console.warn(`[Scheduler] Функция ${name} не найдена`);
	}
};
var scheduler = new Scheduler();
//#endregion
//#region src/main/ipcHandlers/tasksHandlers.ts
function registerTasksHandlers() {
	electron.ipcMain.handle("tasks:getAll", () => {
		const tasks = taskStore.getAll();
		console.log("[IPC] tasks:getAll – вернул", tasks.length, "задач");
		return tasks;
	});
	electron.ipcMain.handle("tasks:add", async (_event, taskData) => {
		try {
			console.log("[tasks:add] Получены данные:", taskData);
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const newTask = {
				id: (0, _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_uuid_dist_node_index_js.v4)(),
				...taskData,
				createdAt: now,
				updatedAt: now
			};
			console.log("[tasks:add] Создана задача:", newTask.id);
			taskStore.add(newTask);
			console.log("[tasks:add] taskStore.add выполнен");
			scheduler.refreshCronJob(newTask);
			console.log("[tasks:add] Успешно, возвращаю задачу");
			return newTask;
		} catch (e) {
			console.error("[tasks:add] Ошибка:", e);
			return null;
		}
	});
	electron.ipcMain.handle("tasks:update", async (_event, task) => {
		try {
			console.log("[tasks:update] Обновляю задачу:", task.id);
			task.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
			taskStore.update(task);
			scheduler.refreshCronJob(task);
			return task;
		} catch (e) {
			console.error("[tasks:update] Ошибка:", e);
			return null;
		}
	});
	electron.ipcMain.handle("tasks:delete", (_event, id) => {
		taskStore.delete(id);
	});
	electron.ipcMain.handle("tasks:open-window", () => {
		const win = getTasksWindow();
		if (win && !win.isDestroyed()) {
			win.focus();
			return;
		}
		createTasksWindow();
	});
	electron.ipcMain.handle("open-tasks-window", () => {
		const win = getTasksWindow();
		if (win && !win.isDestroyed()) {
			win.focus();
			return;
		}
		createTasksWindow();
	});
}
//#endregion
//#region src/api/tbank/stopordersTypes.ts
var StopOrderDirection = /* @__PURE__ */ function(StopOrderDirection) {
	StopOrderDirection[StopOrderDirection["STOP_ORDER_DIRECTION_UNSPECIFIED"] = 0] = "STOP_ORDER_DIRECTION_UNSPECIFIED";
	StopOrderDirection[StopOrderDirection["STOP_ORDER_DIRECTION_BUY"] = 1] = "STOP_ORDER_DIRECTION_BUY";
	StopOrderDirection[StopOrderDirection["STOP_ORDER_DIRECTION_SELL"] = 2] = "STOP_ORDER_DIRECTION_SELL";
	return StopOrderDirection;
}({});
var StopOrderType = /* @__PURE__ */ function(StopOrderType) {
	StopOrderType[StopOrderType["STOP_ORDER_TYPE_UNSPECIFIED"] = 0] = "STOP_ORDER_TYPE_UNSPECIFIED";
	StopOrderType[StopOrderType["STOP_ORDER_TYPE_TAKE_PROFIT"] = 1] = "STOP_ORDER_TYPE_TAKE_PROFIT";
	StopOrderType[StopOrderType["STOP_ORDER_TYPE_STOP_LOSS"] = 2] = "STOP_ORDER_TYPE_STOP_LOSS";
	StopOrderType[StopOrderType["STOP_ORDER_TYPE_STOP_LIMIT"] = 3] = "STOP_ORDER_TYPE_STOP_LIMIT";
	return StopOrderType;
}({});
var ExchangeOrderType = /* @__PURE__ */ function(ExchangeOrderType) {
	ExchangeOrderType[ExchangeOrderType["EXCHANGE_ORDER_TYPE_UNSPECIFIED"] = 0] = "EXCHANGE_ORDER_TYPE_UNSPECIFIED";
	ExchangeOrderType[ExchangeOrderType["EXCHANGE_ORDER_TYPE_MARKET"] = 1] = "EXCHANGE_ORDER_TYPE_MARKET";
	ExchangeOrderType[ExchangeOrderType["EXCHANGE_ORDER_TYPE_LIMIT"] = 2] = "EXCHANGE_ORDER_TYPE_LIMIT";
	return ExchangeOrderType;
}({});
var StopOrderExpirationType = /* @__PURE__ */ function(StopOrderExpirationType) {
	StopOrderExpirationType[StopOrderExpirationType["STOP_ORDER_EXPIRATION_TYPE_UNSPECIFIED"] = 0] = "STOP_ORDER_EXPIRATION_TYPE_UNSPECIFIED";
	StopOrderExpirationType[StopOrderExpirationType["STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL"] = 1] = "STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL";
	StopOrderExpirationType[StopOrderExpirationType["STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_DATE"] = 2] = "STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_DATE";
	return StopOrderExpirationType;
}({});
//#endregion
//#region src/main/services/orderManager.ts
var OrderManager = class {
	config;
	activeOrderId = null;
	isRunning = false;
	lastOrderTime = 0;
	activeStopOrderId = null;
	trailingActive = false;
	trailingPercent = 0;
	trailingInstrumentUid = null;
	trailingEntryPrice = null;
	trailingStopOrderId = null;
	trailingInterval = null;
	dailyLossCurrent = 0;
	lastLossResetDate = "";
	lastEntryPrice = 0;
	orderFlow;
	historicalLoader;
	activeTakeProfitOrderId = null;
	constructor(config = {}, orderFlow, historicalLoader) {
		this.config = {
			lotQuantity: 1,
			useMarketOrder: true,
			demoMode: true,
			token: "",
			accountId: "",
			stopLossPercent: 0,
			takeProfitPercent: 0,
			trailingEnabled: false,
			trailingPercent: 1,
			marketDataToken: "",
			dailyLossLimit: 0,
			maxSignalsPerDay: 0,
			minIntervalMinutes: 15,
			useDynamicSizing: false,
			atrPeriod: 14,
			atrMultiplier: 2,
			riskAmount: 1e3,
			trailingMode: "percent",
			volatilityMultiplier: 2,
			stopMode: "stop_order",
			entryMode: "market",
			...config
		};
		this.orderFlow = orderFlow;
		this.historicalLoader = historicalLoader;
	}
	generateUUID() {
		return crypto.randomUUID();
	}
	updateConfig(patch) {
		this.config = {
			...this.config,
			...patch
		};
		this.dailyLossCurrent = 0;
		this.lastLossResetDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
	}
	setRunning(state) {
		this.isRunning = state;
		console.log(`[OrderManager] Автоторговля ${state ? "запущена" : "остановлена"}`);
	}
	async processSignal(signal) {
		if (!this.isRunning) return;
		if (this.config.demoMode) {
			console.log(`[OrderManager][DEMO] ${signal.type} ${this.config.lotQuantity} лотов по цене ${signal.price}`);
			return;
		}
		if (!this.config.token || !this.config.accountId) return;
		const now = Date.now();
		if (now - this.lastOrderTime < 300 * 1e3) {
			console.log("[OrderManager] Кулдаун, пропускаем сигнал");
			return;
		}
		const direction = signal.type === "BUY" ? OrderDirection.ORDER_DIRECTION_BUY : OrderDirection.ORDER_DIRECTION_SELL;
		let quantity = this.config.lotQuantity;
		if (this.config.useDynamicSizing && this.historicalLoader) {
			const atr = await this.calculateATR(signal.instrumentUid, this.config.token);
			if (atr && atr > 0 && this.config.riskAmount) {
				const riskPerLot = atr * this.config.atrMultiplier;
				quantity = Math.floor(this.config.riskAmount / riskPerLot);
				if (quantity < 1) quantity = 1;
			}
		}
		if (this.lastEntryPrice > 0) {
			const prevProfit = signal.type === "BUY" ? signal.price - this.lastEntryPrice : this.lastEntryPrice - signal.price;
			this.updateDailyLoss(prevProfit);
		}
		try {
			let entryOrderResult = null;
			if (this.config.entryMode === "limit" && signal.targetPrice) {
				const limitPrice = signal.targetPrice;
				const orderId = this.generateUUID();
				console.log(`[OrderManager] Выставляю лимитный ордер на ${limitPrice}, orderId=${orderId}`);
				entryOrderResult = await sandboxGrpc.postSandboxOrder({
					instrumentId: signal.instrumentUid,
					direction,
					orderType: OrderType.ORDER_TYPE_LIMIT,
					quantity,
					price: {
						units: Math.floor(limitPrice),
						nano: Math.round(limitPrice % 1 * 1e9)
					},
					accountId: this.config.accountId,
					orderId
				}, this.config.token);
				this.activeOrderId = entryOrderResult.orderId ?? null;
				this.lastOrderTime = now;
				this.lastEntryPrice = limitPrice;
				console.log(`[OrderManager] Лимитный ордер отправлен: ${this.activeOrderId}`);
			} else {
				const orderId = this.generateUUID();
				console.log("[OrderManager] Выставляю рыночный ордер, orderId=", orderId);
				entryOrderResult = await sandboxGrpc.postSandboxOrder({
					instrumentId: signal.instrumentUid,
					direction,
					orderType: OrderType.ORDER_TYPE_MARKET,
					quantity,
					price: this.config.useMarketOrder ? void 0 : {
						units: Math.floor(signal.price),
						nano: Math.round(signal.price % 1 * 1e9)
					},
					accountId: this.config.accountId,
					orderId
				}, this.config.token);
				this.activeOrderId = entryOrderResult.orderId ?? null;
				this.lastOrderTime = now;
				this.lastEntryPrice = signal.price;
				console.log(`[OrderManager] Рыночный ордер отправлен: ${this.activeOrderId}`);
			}
			const entryPrice = this.lastEntryPrice;
			let stopOrderId = null;
			if (this.config.stopMode === "stop_order") stopOrderId = await this.placeStopOrders(signal);
			else stopOrderId = (await this.placeProtectiveOrders(signal, entryPrice)).stopOrderId;
			if (this.config.trailingEnabled && stopOrderId) this.startTrailing(signal.instrumentUid, entryPrice, stopOrderId, this.config.trailingPercent);
		} catch (error) {
			console.error("[OrderManager] Ошибка отправки ордера:", error);
		}
	}
	async placeStopOrders(signal) {
		const { stopLossPercent, takeProfitPercent, lotQuantity, token, accountId } = this.config;
		if (stopLossPercent <= 0 && takeProfitPercent <= 0) return null;
		if (!accountId || !token || !signal.instrumentUid) return null;
		const entryPrice = signal.price;
		const isBuy = signal.type === "BUY";
		let stopOrderId = null;
		if (stopLossPercent > 0) {
			const slPrice = isBuy ? entryPrice * (1 - stopLossPercent / 100) : entryPrice * (1 + stopLossPercent / 100);
			try {
				stopOrderId = (await sandboxGrpc.postSandboxStopOrder({
					instrumentId: signal.instrumentUid,
					direction: isBuy ? StopOrderDirection.STOP_ORDER_DIRECTION_SELL : StopOrderDirection.STOP_ORDER_DIRECTION_BUY,
					stopOrderType: StopOrderType.STOP_ORDER_TYPE_STOP_LOSS,
					price: {
						units: Math.floor(slPrice),
						nano: Math.round(slPrice % 1 * 1e9)
					},
					stopPrice: {
						units: Math.floor(slPrice),
						nano: Math.round(slPrice % 1 * 1e9)
					},
					quantity: lotQuantity,
					accountId,
					expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL,
					exchangeOrderType: ExchangeOrderType.EXCHANGE_ORDER_TYPE_MARKET,
					orderId: this.generateUUID()
				}, token)).stopOrderId || null;
				console.log(`[OrderManager] Стоп‑лосс установлен на ${slPrice}, stopOrderId=${stopOrderId}`);
			} catch (e) {
				console.error("[OrderManager] Ошибка установки стоп‑лосса:", e);
			}
		}
		if (takeProfitPercent > 0) {
			const tpPrice = isBuy ? entryPrice * (1 + takeProfitPercent / 100) : entryPrice * (1 - takeProfitPercent / 100);
			try {
				await sandboxGrpc.postSandboxStopOrder({
					instrumentId: signal.instrumentUid,
					direction: isBuy ? StopOrderDirection.STOP_ORDER_DIRECTION_SELL : StopOrderDirection.STOP_ORDER_DIRECTION_BUY,
					stopOrderType: StopOrderType.STOP_ORDER_TYPE_TAKE_PROFIT,
					price: {
						units: Math.floor(tpPrice),
						nano: Math.round(tpPrice % 1 * 1e9)
					},
					stopPrice: {
						units: Math.floor(tpPrice),
						nano: Math.round(tpPrice % 1 * 1e9)
					},
					quantity: lotQuantity,
					accountId,
					expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL,
					exchangeOrderType: ExchangeOrderType.EXCHANGE_ORDER_TYPE_MARKET,
					orderId: this.generateUUID()
				}, token);
				console.log(`[OrderManager] Тейк‑профит установлен на ${tpPrice}`);
			} catch (e) {
				console.error("[OrderManager] Ошибка установки тейк‑профита:", e);
			}
		}
		return stopOrderId;
	}
	async placeProtectiveOrders(signal, entryPrice) {
		const { stopLossPercent, takeProfitPercent, lotQuantity, token, accountId, trailingMode, volatilityMultiplier } = this.config;
		if (stopLossPercent <= 0 && takeProfitPercent <= 0 && trailingMode !== "volatility") return {
			stopOrderId: null,
			takeProfitOrderId: null
		};
		if (!accountId || !token || !signal.instrumentUid) return {
			stopOrderId: null,
			takeProfitOrderId: null
		};
		const isBuy = signal.type === "BUY";
		let stopOrderId = null;
		let takeProfitOrderId = null;
		if (stopLossPercent > 0 || trailingMode === "volatility") {
			let slPrice = null;
			if (trailingMode === "volatility" && volatilityMultiplier && this.historicalLoader) {
				const atr = await this.calculateATR(signal.instrumentUid, token);
				if (atr && atr > 0) slPrice = isBuy ? entryPrice - atr * volatilityMultiplier : entryPrice + atr * volatilityMultiplier;
			} else if (stopLossPercent > 0) slPrice = isBuy ? entryPrice * (1 - stopLossPercent / 100) : entryPrice * (1 + stopLossPercent / 100);
			if (slPrice) try {
				const orderId = `sl_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
				stopOrderId = (await sandboxGrpc.postSandboxOrder({
					instrumentId: signal.instrumentUid,
					direction: isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY,
					orderType: OrderType.ORDER_TYPE_LIMIT,
					quantity: lotQuantity,
					price: {
						units: Math.floor(slPrice),
						nano: Math.round(slPrice % 1 * 1e9)
					},
					accountId,
					orderId
				}, token)).orderId || null;
				console.log(`[OrderManager] Стоп‑лосс (лимитный) выставлен на ${slPrice}, orderId=${stopOrderId}`);
			} catch (e) {
				console.error("[OrderManager] Ошибка выставления стоп‑лосса:", e);
			}
		}
		if (takeProfitPercent > 0) {
			const tpPrice = isBuy ? entryPrice * (1 + takeProfitPercent / 100) : entryPrice * (1 - takeProfitPercent / 100);
			try {
				const orderId = `tp_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
				takeProfitOrderId = (await sandboxGrpc.postSandboxOrder({
					instrumentId: signal.instrumentUid,
					direction: isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY,
					orderType: OrderType.ORDER_TYPE_LIMIT,
					quantity: lotQuantity,
					price: {
						units: Math.floor(tpPrice),
						nano: Math.round(tpPrice % 1 * 1e9)
					},
					accountId,
					orderId
				}, token)).orderId || null;
				console.log(`[OrderManager] Тейк‑профит (лимитный) выставлен на ${tpPrice}, orderId=${takeProfitOrderId}`);
			} catch (e) {
				console.error("[OrderManager] Ошибка выставления тейк‑профита:", e);
			}
		}
		return {
			stopOrderId,
			takeProfitOrderId
		};
	}
	async cancelActiveOrder() {
		if (!this.activeOrderId || !this.config.token || !this.config.accountId) return;
		try {
			await sandboxGrpc.cancelSandboxOrder({
				orderId: this.activeOrderId,
				accountId: this.config.accountId,
				orderIdType: OrderIdType.ORDER_ID_TYPE_EXCHANGE
			}, this.config.token);
			console.log(`[OrderManager] Ордер ${this.activeOrderId} отменён`);
			this.activeOrderId = null;
		} catch (e) {
			console.error("[OrderManager] Ошибка отмены ордера:", e);
		}
	}
	startTrailing(instrumentUid, entryPrice, stopOrderId, trailPercent) {
		if (this.trailingActive) {
			console.log("[OrderManager] Трейлинг уже активен, перезапускаем с новым стоп‑ордером");
			this.stopTrailing();
		}
		this.trailingActive = true;
		this.trailingInstrumentUid = instrumentUid;
		this.trailingEntryPrice = entryPrice;
		this.trailingStopOrderId = stopOrderId;
		this.trailingPercent = trailPercent;
		this.trailingInterval = setInterval(() => this.checkAndUpdateTrailing(), 1e4);
	}
	stopTrailing() {
		this.trailingActive = false;
		if (this.trailingInterval) {
			clearInterval(this.trailingInterval);
			this.trailingInterval = null;
		}
		this.trailingInstrumentUid = null;
		this.trailingEntryPrice = null;
		this.trailingStopOrderId = null;
	}
	async checkAndUpdateTrailing() {
		if (!this.trailingActive || !this.trailingStopOrderId || !this.trailingInstrumentUid || !this.trailingEntryPrice) return;
		try {
			const lastPrice = await this.getLastPrice(this.trailingInstrumentUid);
			if (!lastPrice) return;
			let newStopPrice;
			if (this.config.trailingMode === "volatility" && this.config.volatilityMultiplier && this.historicalLoader) {
				const atr = await this.calculateATR(this.trailingInstrumentUid, this.config.token);
				if (!atr) return;
				newStopPrice = lastPrice - atr * this.config.volatilityMultiplier;
			} else newStopPrice = lastPrice * (1 - this.config.trailingPercent / 100);
			if (newStopPrice > this.trailingEntryPrice || false) {
				await sandboxGrpc.replaceSandboxOrder({
					accountId: this.config.accountId,
					orderId: this.trailingStopOrderId,
					price: {
						units: Math.floor(newStopPrice),
						nano: Math.round(newStopPrice % 1 * 1e9)
					},
					quantity: this.config.lotQuantity
				}, this.config.token);
				this.trailingEntryPrice = newStopPrice;
				console.log(`[OrderManager] Трейлинг‑стоп обновлён до ${newStopPrice}`);
			}
		} catch (e) {
			console.error("[OrderManager] Ошибка трейлинга:", e);
		}
	}
	async getLastPrice(instrumentUid) {
		if (!this.config.marketDataToken) return null;
		try {
			const p = (await marketDataGrpc.getLastPrices({
				instrumentId: [instrumentUid],
				lastPriceType: 1
			}, this.config.marketDataToken)).lastPrices?.[0]?.price;
			return p ? Number(p.units) + Number(p.nano) / 1e9 : null;
		} catch (e) {
			console.error("[OrderManager] Не удалось получить lastPrice:", e);
			return null;
		}
	}
	updateDailyLoss(profit) {
		const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
		if (today !== this.lastLossResetDate) {
			this.dailyLossCurrent = 0;
			this.lastLossResetDate = today;
		}
		if (profit < 0) {
			this.dailyLossCurrent += Math.abs(profit);
			console.log(`[OrderManager] Текущий дневной убыток: ${this.dailyLossCurrent.toFixed(2)} / лимит: ${this.config.dailyLossLimit}`);
			if (this.config.dailyLossLimit > 0 && this.dailyLossCurrent >= this.config.dailyLossLimit) {
				console.log("[OrderManager] Достигнут дневной лимит убытка, автоторговля остановлена");
				this.setRunning(false);
			}
		}
	}
	getConfig() {
		return this.config;
	}
	async calculateATR(instrumentUid, token) {
		if (!this.historicalLoader) return null;
		try {
			const now = /* @__PURE__ */ new Date();
			const from = /* @__PURE__ */ new Date(now.getTime() - (this.config.atrPeriod + 1) * 864e5);
			const candles = await this.historicalLoader.loadIntradayCandles(instrumentUid, from, now, token, 4);
			if (candles.length < this.config.atrPeriod) return null;
			let trueRanges = [];
			for (let i = 1; i < candles.length; i++) {
				const prev = candles[i - 1];
				const curr = candles[i];
				const high = Number(curr.high?.units || 0) + Number(curr.high?.nano || 0) / 1e9;
				const low = Number(curr.low?.units || 0) + Number(curr.low?.nano || 0) / 1e9;
				const prevClose = Number(prev.close?.units || 0) + Number(prev.close?.nano || 0) / 1e9;
				const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
				trueRanges.push(tr);
			}
			return trueRanges.reduce((s, v) => s + v, 0) / trueRanges.length;
		} catch {
			return null;
		}
	}
};
//#endregion
//#region src/main/services/compositeProfile.ts
var CompositeProfileService = class {
	historicalLoader;
	profileEngine;
	defaultDays;
	cache = /* @__PURE__ */ new Map();
	constructor(historicalLoader, profileEngine, defaultDays = 10) {
		this.historicalLoader = historicalLoader;
		this.profileEngine = profileEngine;
		this.defaultDays = defaultDays;
	}
	/**
	* Строит композитный профиль за N дней.
	* Использует уже загруженные дневные профили через VolumeProfileEngine,
	* но для истории создаёт временные экземпляры движка.
	*/
	async buildComposite(instrumentUid, days = this.defaultDays, token) {
		const cacheKey = `${instrumentUid}_${days}`;
		if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
		const profiles = [];
		const now = /* @__PURE__ */ new Date();
		for (let d = 0; d < days; d++) {
			const date = /* @__PURE__ */ new Date(now.getTime() - d * 864e5);
			const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0);
			const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 0, 0);
			try {
				const candles = await this.historicalLoader.loadIntradayCandles(instrumentUid, from, to, token, 4);
				if (!candles || candles.length === 0) continue;
				const engine = new VolumeProfileEngine({
					profileResolution: 50,
					valueAreaPercent: 70,
					skipAutoSubscribe: true
				});
				candles.forEach((c) => engine.feedCandle(c));
				const profile = engine.getProfile(instrumentUid);
				if (profile) profiles.push(profile);
			} catch (err) {
				console.warn(`CompositeProfile: error loading day ${date.toISOString().slice(0, 10)}`, err);
			}
		}
		if (profiles.length === 0) return null;
		const pocFrequency = /* @__PURE__ */ new Map();
		let totalVAHigh = 0;
		let totalVALow = 0;
		const allHVN = [];
		const allLVN = [];
		for (const p of profiles) {
			const poc = p.poc;
			pocFrequency.set(poc, (pocFrequency.get(poc) || 0) + 1);
			totalVAHigh += p.valueAreaHigh;
			totalVALow += p.valueAreaLow;
			allHVN.push(...p.hvn);
			allLVN.push(...p.lvn);
		}
		let mainPoc = profiles[0].poc;
		let maxCount = 0;
		pocFrequency.forEach((count, price) => {
			if (count > maxCount) {
				maxCount = count;
				mainPoc = price;
			}
		});
		const swingHighs = this.clusterLevels(allHVN, .5);
		const swingLows = this.clusterLevels(allLVN, .5);
		const result = {
			instrumentUid,
			poc: mainPoc,
			recurringPocs: pocFrequency,
			swingHighs,
			swingLows,
			avgVAHigh: totalVAHigh / profiles.length,
			avgVALow: totalVALow / profiles.length,
			daysUsed: profiles.length
		};
		this.cache.set(cacheKey, result);
		return result;
	}
	/** Простая кластеризация уровней: группирует близкие цены (±percent) */
	clusterLevels(levels, percent) {
		if (levels.length === 0) return [];
		const sorted = [...levels].sort((a, b) => a - b);
		const clusters = [];
		let currentCluster = [sorted[0]];
		for (let i = 1; i < sorted.length; i++) {
			const prev = currentCluster[currentCluster.length - 1];
			if ((sorted[i] - prev) / prev <= percent / 100) currentCluster.push(sorted[i]);
			else {
				clusters.push(currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length);
				currentCluster = [sorted[i]];
			}
		}
		clusters.push(currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length);
		return clusters;
	}
	/** Очистка кэша для инструмента */
	invalidateCache(instrumentUid) {
		if (instrumentUid) {
			for (const key of this.cache.keys()) if (key.startsWith(instrumentUid)) this.cache.delete(key);
		} else this.cache.clear();
	}
};
//#endregion
//#region src/main/services/marketPhaseDetector.ts
var MarketPhase = /* @__PURE__ */ function(MarketPhase) {
	MarketPhase["BALANCE"] = "BALANCE";
	MarketPhase["TREND_UP"] = "TREND_UP";
	MarketPhase["TREND_DOWN"] = "TREND_DOWN";
	MarketPhase["BREAKOUT"] = "BREAKOUT";
	MarketPhase["CHOP"] = "CHOP";
	return MarketPhase;
}({});
var MarketPhaseDetector = class {
	historicalLoader;
	profileEngine;
	constructor(historicalLoader, profileEngine) {
		this.historicalLoader = historicalLoader;
		this.profileEngine = profileEngine;
	}
	async detectPhase(instrumentUid) {
		const candles = await this.historicalLoader.loadIntradayCandles(instrumentUid, /* @__PURE__ */ new Date(Date.now() - 7200 * 1e3), /* @__PURE__ */ new Date(), process.env.VITE_TReadOnly || "", CandleInterval.CANDLE_INTERVAL_5_MIN);
		const profile = this.profileEngine.getProfile(instrumentUid);
		if (!profile || candles.length < 5) return "CHOP";
		const { vwap, angle } = this.calcVWAPAngle(candles);
		const insideVA = this.calcPercentInsideVA(candles, profile);
		const lastCandle = candles[candles.length - 1];
		const avgVolume = candles.reduce((s, c) => s + Number(c.volume), 0) / candles.length;
		const volumeSpike = Number(lastCandle.volume) > avgVolume * 1.5;
		const absAngle = Math.abs(angle);
		if (insideVA > 70 && absAngle < .3) return "BALANCE";
		if (absAngle > .5 && insideVA < 40) return angle > 0 ? "TREND_UP" : "TREND_DOWN";
		if (volumeSpike && (Number(lastCandle.high) > profile.valueAreaHigh || Number(lastCandle.low) < profile.valueAreaLow)) return "BREAKOUT";
		return "CHOP";
	}
	calcVWAPAngle(candles) {
		const totalVolume = candles.reduce((s, c) => s + Number(c.volume), 0);
		const vwap = candles.reduce((s, c) => s + (Number(c.high) + Number(c.low) + Number(c.close)) / 3 * Number(c.volume), 0) / totalVolume;
		if (candles.length < 2) return {
			vwap,
			angle: 0
		};
		const prevVWAP = (Number(candles[candles.length - 2].high) + Number(candles[candles.length - 2].low) + Number(candles[candles.length - 2].close)) / 3;
		const lastVWAP = (Number(candles[candles.length - 1].high) + Number(candles[candles.length - 1].low) + Number(candles[candles.length - 1].close)) / 3;
		return {
			vwap,
			angle: Math.atan((lastVWAP - prevVWAP) / prevVWAP) * (180 / Math.PI)
		};
	}
	calcPercentInsideVA(candles, profile) {
		return candles.filter((c) => Number(c.close) >= profile.valueAreaLow && Number(c.close) <= profile.valueAreaHigh).length / candles.length * 100;
	}
};
//#endregion
//#region src/main/services/strategyManager.ts
var StrategyManager = class {
	phaseDetector;
	compositeProfile;
	volumeProfile;
	orderFlow;
	activeStrategies = [];
	phaseMapping = /* @__PURE__ */ new Map();
	constructor(phaseDetector, compositeProfile, volumeProfile, orderFlow) {
		this.phaseDetector = phaseDetector;
		this.compositeProfile = compositeProfile;
		this.volumeProfile = volumeProfile;
		this.orderFlow = orderFlow;
		this.phaseMapping.set(MarketPhase.BALANCE, [
			"daily_va_return",
			"poc_pullback",
			"volume_accumulation"
		]);
		this.phaseMapping.set(MarketPhase.TREND_UP, [
			"trend_pro",
			"rejection",
			"anchored_vwap"
		]);
		this.phaseMapping.set(MarketPhase.TREND_DOWN, [
			"trend_pro",
			"rejection",
			"anchored_vwap"
		]);
		this.phaseMapping.set(MarketPhase.BREAKOUT, ["initial_balance", "va_breakout_retest"]);
		this.phaseMapping.set(MarketPhase.CHOP, []);
	}
	updatePhaseMapping(phase, strategyNames) {
		this.phaseMapping.set(phase, strategyNames);
	}
	async update(instrumentUid) {
		const phase = await this.phaseDetector.detectPhase(instrumentUid);
		const strategyNames = this.phaseMapping.get(phase) || [];
		const profile = this.volumeProfile.getProfile(instrumentUid);
		this.activeStrategies = [];
		for (const name of strategyNames) try {
			const strategy = createStrategy(name, instrumentUid, profile, this.orderFlow);
			this.activeStrategies.push(strategy);
		} catch (err) {
			console.warn(`StrategyManager: failed to create strategy ${name}`, err);
		}
	}
	evaluateSignals(candle) {
		const allSignals = [];
		for (const strategy of this.activeStrategies) {
			strategy.onCandle(candle);
			const signals = strategy.getSignals();
			allSignals.push(...signals);
			strategy.clearSignals();
		}
		return allSignals;
	}
	getCurrentPhase(instrumentUid) {
		return this.phaseDetector.detectPhase(instrumentUid);
	}
	getAvailableStrategies() {
		return getAvailableStrategies();
	}
	getActiveStrategies() {
		return this.activeStrategies.map((s) => s.constructor.name);
	}
	reset() {
		this.activeStrategies.forEach((s) => s.reset());
		this.activeStrategies = [];
	}
};
//#endregion
//#region src/main/services/orderFlowEngine.ts
var OrderFlowEngine = class {
	deltas = /* @__PURE__ */ new Map();
	absorptionEvents = /* @__PURE__ */ new Map();
	constructor() {
		marketDataBus.onTrade(this.onTrade.bind(this));
		marketDataBus.onOrderBook(this.onOrderBook.bind(this));
	}
	getDelta(instrumentUid) {
		return this.deltas.get(instrumentUid)?.cumulativeDelta ?? 0;
	}
	detectAbsorption(uid) {
		return this.absorptionEvents.get(uid) || null;
	}
	detectExhaustion(uid) {
		const data = this.deltas.get(uid);
		if (!data) return null;
		if (data.lastPrice >= data.extremePrice && data.barDelta < 0) return {
			type: "bearish",
			extremePrice: data.extremePrice
		};
		if (data.lastPrice <= data.extremePrice && data.barDelta > 0) return {
			type: "bullish",
			extremePrice: data.extremePrice
		};
		return null;
	}
	onTrade(trade) {
		const uid = trade.instrumentUid || trade.figi;
		if (!uid) return;
		const price = quotationToNumber$2(trade.price);
		const volume = Number(trade.quantity || "0");
		const direction = trade.direction === "TRADE_DIRECTION_BUY" ? "buy" : trade.direction === "TRADE_DIRECTION_SELL" ? "sell" : null;
		if (!direction || volume === 0) return;
		if (!this.deltas.has(uid)) this.deltas.set(uid, {
			cumulativeDelta: 0,
			barDelta: 0,
			lastPrice: price,
			extremePrice: price,
			tradeSizes: [],
			deltaHistory: []
		});
		const data = this.deltas.get(uid);
		const delta = direction === "buy" ? volume : -volume;
		data.cumulativeDelta += delta;
		data.barDelta += delta;
		data.lastPrice = price;
		if (price > data.extremePrice) data.extremePrice = price;
		if (price < data.extremePrice) data.extremePrice = price;
		data.deltaHistory.push({
			time: trade.time || "",
			delta: data.barDelta,
			price
		});
		if (data.deltaHistory.length > 100) data.deltaHistory.shift();
		data.tradeSizes.push(volume);
		if (data.tradeSizes.length > 3) data.tradeSizes.shift();
		if (this.isIceberg(data.tradeSizes)) {}
	}
	onOrderBook(ob) {
		const uid = ob.instrumentUid || ob.figi;
		if (!uid) return;
		const bids = (ob.bids || []).map((b) => ({
			price: quotationToNumber$2(b.price),
			volume: b.quantity || 0
		}));
		const asks = (ob.asks || []).map((a) => ({
			price: quotationToNumber$2(a.price),
			volume: a.quantity || 0
		}));
		if (!bids.length || !asks.length) return;
		const bidsNum = bids.map((b) => ({
			price: b.price,
			volume: Number(b.volume)
		}));
		const asksNum = asks.map((a) => ({
			price: a.price,
			volume: Number(a.volume)
		}));
		const maxBid = bidsNum.reduce((max, b) => b.volume > max.volume ? b : max, bidsNum[0]);
		const maxAsk = asksNum.reduce((max, a) => a.volume > max.volume ? a : max, asksNum[0]);
		if (maxBid.volume > 1e3) this.absorptionEvents.set(uid, {
			side: "bid",
			priceLevel: maxBid.price
		});
		if (maxAsk.volume > 1e3) this.absorptionEvents.set(uid, {
			side: "ask",
			priceLevel: maxAsk.price
		});
	}
	isIceberg(sizes) {
		if (sizes.length < 3) return false;
		const last = sizes[sizes.length - 1];
		return last === sizes[sizes.length - 2] && last === sizes[sizes.length - 3] && last > 0;
	}
	resetBar(instrumentUid) {
		const data = this.deltas.get(instrumentUid);
		if (data) data.barDelta = 0;
	}
};
new OrderFlowEngine();
//#endregion
//#region src/main/services/autonomousTrader.ts
var AutonomousTrader = class extends events.EventEmitter {
	orderManager;
	strategyManager;
	compositeProfile;
	active = /* @__PURE__ */ new Map();
	constructor(orderManager, strategyManager, compositeProfile) {
		super();
		this.orderManager = orderManager;
		this.strategyManager = strategyManager;
		this.compositeProfile = compositeProfile;
	}
	async start(instrumentUid, token) {
		if (this.active.has(instrumentUid)) {
			console.warn(`[AutonomousTrader] ${instrumentUid} уже запущен, перезапускаем`);
			this.stop(instrumentUid);
		}
		const handler = async (signal) => {
			if (signal.instrumentUid !== instrumentUid) return;
			console.log(`[AutonomousTrader] signal handler called ${signal.instrumentUid} ${signal.type}`);
			this.emit("signal", {
				instrumentUid,
				signal: {
					type: signal.type,
					price: signal.price,
					reason: signal.message
				},
				timestamp: (/* @__PURE__ */ new Date()).toISOString()
			});
			if (this.orderManager) await this.orderManager.processSignal(signal);
		};
		console.log("[AutonomousTrader] Подписываемся на signal...");
		volumeProfileEngine.on("signal", handler);
		console.log("[AutonomousTrader] Подписка выполнена");
		this.orderManager.setRunning(true);
		this.active.set(instrumentUid, { handler });
		console.log(`[AutonomousTrader] Запущен для ${instrumentUid}`);
	}
	stop(instrumentUid) {
		const entry = this.active.get(instrumentUid);
		if (!entry) return;
		volumeProfileEngine.off("signal", entry.handler);
		this.active.delete(instrumentUid);
		this.strategyManager.reset();
		console.log(`[AutonomousTrader] Остановлен для ${instrumentUid}`);
	}
	stopAll() {
		for (const uid of this.active.keys()) this.stop(uid);
	}
	getActiveInstruments() {
		return Array.from(this.active.keys());
	}
};
//#endregion
//#region src/main/main.ts
process.on("uncaughtException", (err) => {
	console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled rejection at:", promise, "reason:", reason);
});
console.log("[main] marketDataBus instance id:", marketDataBus.getInstanceId());
var historicalDataLoader = new HistoricalDataLoader();
var scriptsDir = path.default.join(electron.app.getPath("userData"), "scripts");
if (!(0, fs.existsSync)(scriptsDir)) {
	(0, fs.mkdirSync)(scriptsDir, { recursive: true });
	console.log("[Main] Создана папка для скриптов:", scriptsDir);
}
var getToken = () => {
	return process.env.VITE_TReadOnly || "";
};
electron.app.whenReady().then(() => {
	electron.session.defaultSession.setCertificateVerifyProc((request, callback) => {
		callback(0);
	});
	const mainWindow = createMainWindow();
	const menu = electron.Menu.buildFromTemplate(mainMenuTemplate);
	const fileMenu = menu.items.find((i) => i.label === "Файл")?.submenu;
	if (fileMenu) {
		const openAI = fileMenu.items.find((i) => i.label === "Открыть Нейро");
		console.log("openAIItem found:", !!openAI);
		if (openAI) openAI.click = () => {
			console.log("click on Open AI");
			const existing = getAIWindow();
			if (existing && !existing.isDestroyed()) existing.focus();
			else {
				const win = createAIWindow();
				if (win) applyMenuToWindow(win, aiWindowMenuTemplate);
			}
		};
		const openMD = fileMenu.items.find((i) => i.label === "Открыть Markdown");
		if (openMD) openMD.click = () => {
			const existing = getMDWindow();
			if (existing && !existing.isDestroyed()) existing.focus();
			else {
				const win = createMDWindow();
				if (win) applyMenuToWindow(win, mdWindowMenuTemplate);
			}
		};
		const openBonds = fileMenu.items.find((i) => i.label === "Открыть Облигации");
		if (openBonds) openBonds.click = () => {
			const existing = getBondsWindow();
			if (existing && !existing.isDestroyed()) existing.focus();
			else {
				const win = createBondsWindow();
				if (win) applyMenuToWindow(win, bondsWindowMenuTemplate);
			}
		};
		const openPG = fileMenu.items.find((i) => i.label === "Открыть Генератор запросов");
		if (openPG) openPG.click = () => {
			const existing = getPGWindow();
			if (existing && !existing.isDestroyed()) existing.focus();
			else {
				const win = createPGWindow();
				if (win) applyMenuToWindow(win, mainMenuTemplate);
			}
		};
		const openTrading = fileMenu.items.find((i) => i.label === "Открыть Трейдер");
		if (openTrading) openTrading.click = () => {
			const existing = getTradingAssistantWindow();
			if (existing && !existing.isDestroyed()) existing.focus();
			else {
				const win = createTradingAssistantWindow();
				if (win) applyMenuToWindow(win, mainMenuTemplate);
			}
		};
	}
	mainWindow.setMenu(menu);
	console.log("Menu items:", menu.items.map((i) => i.label));
	registerDashboardHandlers(mainWindow);
	registerAIHandlers();
	registerPGHandlers();
	registerBondsHandlers();
	registerMDHandlers();
	registerTrainingHandlers();
	registerMarketdataStreamHandlers();
	registerOperationsStreamHandlers();
	registerOrdersStreamHandlers();
	registerGrpcHandlers();
	registerTasksHandlers();
	scheduler.start();
	registerTradingAssistantHandlers(historicalDataLoader, volumeProfileEngine, getToken, strategyManager, compositeProfileService, orderFlowEngine);
	const orderManager = new OrderManager({
		demoMode: true,
		token: "",
		accountId: ""
	}, orderFlowEngine);
	setOrderManagerInstance(orderManager);
	const autoTrader = new AutonomousTrader(orderManager, strategyManager, compositeProfileService);
	volumeProfileEngine.on("signal", (s) => console.log("[main test] signal", s.type));
	marketDataBus.on("candle", (c) => {});
	console.log("[main] Добавили отладочного слушателя candle, всего слушателей:", marketDataBus.listenerCount("candle"));
	setAutonomousTraderInstance(autoTrader);
	console.log("[main] Candle listeners:", marketDataBus.listenerCount("candle"));
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
	if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
electron.app.on("before-quit", () => {
	scheduler.stop();
});
electron.ipcMain.handle("open-ai-window", () => {
	const existing = getAIWindow();
	if (existing && !existing.isDestroyed()) {
		existing.focus();
		return;
	}
	const win = createAIWindow();
	if (win) applyMenuToWindow(win, aiWindowMenuTemplate);
});
var bondsWindow = getBondsWindow();
electron.ipcMain.handle("open-bonds-window", () => {
	if (!bondsWindow) createBondsWindow();
	else bondsWindow.focus();
});
var mdWindow = getMDWindow();
electron.ipcMain.handle("open-md-window", () => {
	if (!mdWindow) createMDWindow();
	else mdWindow.focus();
});
var pgWindow = getPGWindow();
electron.ipcMain.handle("open-pg-window", () => {
	if (!pgWindow) createPGWindow();
	else pgWindow.focus();
});
var ollamaWindow = getOllamaWindow();
electron.ipcMain.handle("open-ollama-window", () => {
	if (!ollamaWindow) createOllamaWindow();
	else ollamaWindow.focus();
});
electron.ipcMain.handle("open-file-picker", async () => {
	try {
		const result = await electron.dialog.showOpenDialog({
			title: "Выберите файлы для программирования",
			defaultPath: path.default.join(__dirname, "projects"),
			buttonLabel: "Выбрать файлы",
			properties: ["openFile", "multiSelections"],
			filters: [
				{
					name: "Языки программирования",
					extensions: [
						"js",
						"jsx",
						"ts",
						"tsx",
						"d.ts",
						"py",
						"pyi",
						"pyw",
						"pyd",
						"rb",
						"gemspec",
						"go",
						"mod",
						"sum",
						"rs",
						"rlib",
						"php",
						"phar",
						"java",
						"class",
						"jar",
						"war",
						"scala",
						"kt",
						"kts",
						"swift",
						"cs",
						"cpp",
						"cc",
						"cxx",
						"c++",
						"c",
						"h",
						"hpp",
						"sql",
						"plsql"
					]
				},
				{
					name: "Конфигурационные файлы",
					extensions: [
						"json",
						"json5",
						"yaml",
						"yml",
						"xml",
						"xsl",
						"xslt",
						"xsd",
						"toml",
						"env",
						"gitignore",
						"dockerignore",
						"npmignore",
						"editorconfig",
						"prettierrc",
						"eslintrc",
						"stylelintrc"
					]
				},
				{
					name: "Документация и заметки",
					extensions: [
						"md",
						"markdown",
						"txt",
						"text",
						"conf",
						"ini",
						"log",
						"out",
						"err"
					]
				},
				{
					name: "Веб‑технологии",
					extensions: [
						"html",
						"htm",
						"xhtml",
						"css",
						"scss",
						"sass",
						"less",
						"css.map",
						"js.map",
						"ts.map",
						"ejs",
						"mustache",
						"haml",
						"pug"
					]
				},
				{
					name: "Файлы разработки",
					extensions: [
						"dockerfile",
						"gitlab-ci.yml",
						"travis.yml",
						"circle.yml",
						"package.json",
						"yarn.lock",
						"package-lock.json",
						"composer.json",
						"makefile",
						"build.xml",
						"pom.xml",
						"build.gradle",
						"gitattributes",
						"gitmodules"
					]
				},
				{
					name: "Все файлы",
					extensions: ["*"]
				}
			]
		});
		console.log(result);
		if (!result.canceled && result.filePaths.length > 0) return result.filePaths;
		else return null;
	} catch (error) {
		console.error("Ошибка в main процессе:", error);
		return null;
	}
});
var getLanguageFromFilename = (filename) => {
	const extension = (filename.split(/[\\/]/).pop() || filename).split(".").pop()?.toLowerCase();
	if (!extension) return "";
	return {
		js: "javascript",
		jsx: "javascript",
		ts: "typescript",
		tsx: "typescript",
		"d.ts": "typescript",
		py: "python",
		pyi: "python",
		pyw: "python",
		pyd: "python",
		rb: "ruby",
		gemspec: "ruby",
		go: "go",
		mod: "go",
		sum: "go",
		rs: "rust",
		rlib: "rust",
		php: "php",
		phar: "php",
		java: "java",
		class: "java",
		jar: "java",
		war: "java",
		scala: "scala",
		kt: "kotlin",
		kts: "kotlin",
		swift: "swift",
		cs: "csharp",
		cpp: "cpp",
		cc: "cpp",
		cxx: "cpp",
		"c++": "cpp",
		c: "c",
		h: "c",
		hpp: "cpp",
		sql: "sql",
		plsql: "plsql",
		html: "html",
		htm: "html",
		xhtml: "xhtml",
		css: "css",
		scss: "scss",
		sass: "sass",
		less: "less",
		"css.map": "css-sourcemap",
		"js.map": "javascript-sourcemap",
		"ts.map": "typescript-sourcemap",
		ejs: "ejs",
		mustache: "mustache",
		haml: "haml",
		pug: "pug",
		json: "json",
		json5: "json5",
		yaml: "yaml",
		yml: "yaml",
		xml: "xml",
		xsl: "xsl",
		xslt: "xslt",
		xsd: "xsd",
		toml: "toml",
		env: "env",
		gitignore: "gitignore",
		dockerignore: "dockerignore",
		npmignore: "npmignore",
		editorconfig: "editorconfig",
		prettierrc: "prettierrc",
		eslintrc: "eslintrc",
		stylelintrc: "stylelintrc",
		md: "markdown",
		markdown: "markdown",
		txt: "text",
		text: "text",
		conf: "conf",
		ini: "ini",
		log: "log",
		out: "log",
		err: "log",
		dockerfile: "dockerfile",
		"gitlab-ci.yml": "gitlab-ci",
		"travis.yml": "travis",
		"circle.yml": "circleci",
		"package.json": "json",
		"yarn.lock": "yarn-lock",
		"package-lock.json": "json",
		"composer.json": "json",
		makefile: "makefile",
		"build.xml": "ant-build",
		"pom.xml": "maven-pom",
		"build.gradle": "gradle",
		gitattributes: "gitattributes",
		gitmodules: "gitmodules"
	}[extension] || "";
};
electron.ipcMain.handle("read-files-contents", async (event, filePaths) => {
	const filesContents = [];
	for (const filePath of filePaths) try {
		const language = getLanguageFromFilename(filePath);
		const fileName = path.default.basename(filePath);
		const content = await new Promise((resolve, reject) => {
			fs.default.readFile(filePath, "utf-8", (err, data) => {
				if (err) reject(err);
				else resolve(data);
			});
		});
		filesContents.push({
			path: filePath,
			filename: fileName,
			content,
			language
		});
	} catch (error) {
		console.error(`Ошибка при чтении файла ${filePath}:`, error);
		filesContents.push({
			path: filePath,
			filename: path.default.basename(filePath),
			content: `Ошибка чтения файла: ${error.message}`,
			language: ""
		});
	}
	return filesContents;
});
electron.ipcMain.handle("show-save-dialog", async (event, defaultName) => {
	const { filePath } = await electron.dialog.showSaveDialog({
		defaultPath: defaultName,
		filters: [{
			name: "JSON",
			extensions: ["json"]
		}]
	});
	return filePath;
});
electron.ipcMain.handle("show-open-dialog", async () => {
	const { filePaths } = await electron.dialog.showOpenDialog({
		filters: [{
			name: "JSON",
			extensions: ["json"]
		}],
		properties: ["openFile"]
	});
	return filePaths?.[0];
});
electron.ipcMain.handle("save-prompt-template", async (event, template, fileName) => {
	try {
		if (!validatePromptTemplate(template)) throw new Error("Невалидный шаблон промпта");
		const result = await electron.dialog.showSaveDialog({
			title: "Сохранить промпт‑шаблон",
			defaultPath: fileName || `${template.title}.json`,
			filters: [{
				name: "JSON Files",
				extensions: ["json"]
			}, {
				name: "All Files",
				extensions: ["*"]
			}]
		});
		if (result.canceled) return {
			success: false,
			error: "Сохранение отменено пользователем"
		};
		const filePath = result.filePath;
		await (0, fs_promises.mkdir)(path.default.dirname(filePath), { recursive: true });
		await (0, fs_promises.writeFile)(filePath, JSON.stringify({
			...template,
			createdAt: new Date(template.createdAt).toISOString().split("T")[0],
			updatedAt: new Date(template.updatedAt).toISOString().split("T")[0]
		}, null, 2), "utf-8");
		return {
			success: true,
			filePath
		};
	} catch (error) {
		console.error("Ошибка сохранения шаблона:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Неизвестная ошибка"
		};
	}
});
electron.ipcMain.handle("load-prompt-template", async () => {
	try {
		const result = await electron.dialog.showOpenDialog({
			title: "Загрузить промпт‑шаблон",
			filters: [{
				name: "JSON Files",
				extensions: ["json"]
			}, {
				name: "All Files",
				extensions: ["*"]
			}],
			properties: ["openFile"]
		});
		if (result.canceled) return {
			success: false,
			error: "Загрузка отменена пользователем"
		};
		const filePath = result.filePaths[0];
		const fileContent = await (0, fs_promises.readFile)(filePath, "utf-8");
		const loadedTemplate = JSON.parse(fileContent);
		if (!loadedTemplate.id || !loadedTemplate.title) throw new Error("Файл не содержит корректного шаблона промпта");
		return {
			success: true,
			template: loadedTemplate,
			filePath
		};
	} catch (error) {
		console.error("Ошибка загрузки шаблона:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Неизвестная ошибка"
		};
	}
});
electron.ipcMain.handle("select-folder", async () => {
	try {
		const result = await electron.dialog.showOpenDialog({
			properties: ["openDirectory"],
			title: "Выберите корневую директорию проекта"
		});
		if (result.canceled) return null;
		return result.filePaths[0];
	} catch (error) {
		console.error("Ошибка при выборе папки:", error);
		throw error;
	}
});
electron.ipcMain.handle("get-project-tree", async (event, folderPath) => {
	return new Promise((resolve, reject) => {
		let command;
		if (!folderPath || typeof folderPath !== "string") {
			reject(/* @__PURE__ */ new Error("Некорректный путь к папке"));
			return;
		}
		try {
			fs.default.accessSync(folderPath, fs.default.constants.R_OK);
		} catch (err) {
			reject(/* @__PURE__ */ new Error("Нет доступа к указанной папке или она не существует"));
			return;
		}
		switch (process.platform) {
			case "win32":
				command = `tree "${folderPath}" /f /a`;
				break;
			case "linux":
				command = `if command -v tree >/dev/null 2>&1; then
          tree -a --dirsfirst -L 3 "${folderPath}";  # Ограничиваем глубину до 3 уровней
        else
          find "${folderPath}" -type d -print -o -type f -print |
          sed -e 's;[^/]*/;├── ;g;s;├── ;└── ;' |
          sed 's;└── ;│   ;g; s;├── ;├── ;g';
        fi`;
				break;
			case "darwin":
				command = `if command -v tree >/dev/null 2>&1; then
          tree -a "${folderPath}";
        else
          find "${folderPath}" -print | sed -e 's;[^/]*/;|____;g;s;|____|; |;g';
        fi`;
				break;
			default:
				reject(/* @__PURE__ */ new Error(`Неподдерживаемая операционная система: ${process.platform}`));
				return;
		}
		(0, child_process.exec)(command, { cwd: path.default.dirname(folderPath) }, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			if (stderr) {
				reject(new Error(stderr));
				return;
			}
			resolve(stdout);
		});
	});
});
function applyMenuToWindow(win, template) {
	const menu = electron.Menu.buildFromTemplate(template);
	win.setMenu(menu);
}
var compositeProfileService = new CompositeProfileService(new HistoricalDataLoader(), volumeProfileEngine);
var marketPhaseDetector = new MarketPhaseDetector(historicalDataLoader, volumeProfileEngine);
var orderFlowEngine = new OrderFlowEngine();
var strategyManager = new StrategyManager(marketPhaseDetector, compositeProfileService, volumeProfileEngine, orderFlowEngine);
setInterval(() => {
	const mem = process.memoryUsage();
	const win = getTradingAssistantWindow();
	if (win && !win.isDestroyed()) try {
		win.webContents.send("system:memory", {
			rss: (mem.rss / 1024 / 1024).toFixed(1),
			heap: (mem.heapUsed / 1024 / 1024).toFixed(1)
		});
	} catch {}
}, 3e4);
//#endregion

//# sourceMappingURL=main.js.map