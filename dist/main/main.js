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
	constructor() {
		super();
		this.setMaxListeners(50);
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
var registerMarketdataStreamHandlers = () => {
	let currentStream = null;
	console.log("[Main] registerMDStreamHandlers called");
	const PROTO_PATH = getProtoPath("marketdata.proto");
	console.log("[Main] Proto path:", PROTO_PATH);
	const packageDefinition = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js.loadSync(PROTO_PATH, {
		keepCase: false,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true
	});
	const MarketDataStreamService = _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.loadPackageDefinition(packageDefinition).tinkoff.public.invest.api.contract.v1.MarketDataStreamService;
	console.log("[Main] Proto loaded, service:", !!MarketDataStreamService);
	const client = new MarketDataStreamService("invest-public-api.tbank.ru:443", _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.credentials.createSsl(null, null, null, { rejectUnauthorized: false }), { "grpc.ssl_target_name_override": "invest-public-api.tbank.ru" });
	console.log("[Main] gRPC client created");
	electron.ipcMain.handle("md-stream-start", async (_, token, requestBody) => {
		console.log("[Main] md-stream-start called");
		console.log("[Main] Token:", token?.slice(0, 12) + "...");
		console.log("[Main] Request body:", JSON.stringify(requestBody).slice(0, 400));
		if (currentStream) {
			console.log("[Main] Stopping previous stream");
			currentStream.cancel();
			currentStream = null;
		}
		const metadata = new _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js.Metadata();
		metadata.add("Authorization", `Bearer ${token}`);
		console.log("[Main] Calling MarketDataServerSideStream...");
		const stream = client.MarketDataServerSideStream(requestBody, metadata);
		currentStream = stream;
		console.log("[Main] Stream created");
		let buffer = "";
		stream.on("data", (data) => {
			if (typeof data !== "string" && typeof data !== "object") return;
			const chunk = typeof data === "string" ? data : JSON.stringify(data);
			buffer += chunk;
			let begin = 0;
			let depth = 0;
			let inString = false;
			let escape = false;
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
							const parsed = JSON.parse(jsonStr);
							if (parsed.candle) marketDataBus.emit("candle", parsed.candle);
							if (parsed.trade) marketDataBus.emit("trade", parsed.trade);
							if (parsed.orderbook) marketDataBus.emit("orderbook", parsed.orderbook);
							if (parsed.lastPrice) marketDataBus.emit("lastPrice", parsed.lastPrice);
							if (parsed.openInterest) marketDataBus.emit("openInterest", parsed.openInterest);
							const win = getBondsWindow();
							if (win && !win.isDestroyed()) win.webContents.send("md-stream-data", jsonStr);
						} catch {
							console.warn("[Main] Skipped invalid JSON fragment:", jsonStr.slice(0, 100));
						}
					}
				}
			}
			if (depth > 0) buffer = buffer.substring(begin);
			else buffer = "";
		});
		stream.on("status", (status) => {
			const win = getBondsWindow();
			if (win) win.webContents.send("md-stream-closed");
		});
		stream.on("error", (err) => {
			const win = getBondsWindow();
			if (win) win.webContents.send("md-stream-error", err.message);
		});
		console.log("[Main] Request sent");
	});
	electron.ipcMain.handle("md-stream-stop", async () => {
		console.log("[Main] md-stream-stop called");
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
function quotationToNumber$3(q) {
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
		marketDataBus.onCandle(this.onCandle.bind(this));
		marketDataBus.onTrade(this.onTrade.bind(this));
	}
	onCandle(candle) {
		const uid = candle.instrumentUid || candle.figi;
		if (!uid) return;
		const volume = Number(candle.volume || "0");
		if (volume <= this.config.minVolumeThreshold) return;
		const high = quotationToNumber$3(candle.high);
		const low = quotationToNumber$3(candle.low);
		const close = quotationToNumber$3(candle.close);
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
		const price = quotationToNumber$3(trade.price);
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
	constructor(instrumentUid, dailyProfile) {
		this.instrumentUid = instrumentUid;
		this.dailyProfile = dailyProfile;
	}
	reset() {
		this.signals = [];
		this.hasBrokenHigh = false;
		this.hasBrokenLow = false;
		this.hasPosition = false;
	}
	hasPosition = false;
	onCandle(candle) {
		if (!this.dailyProfile || this.hasPosition) return;
		const high = quotationToNumber$2(candle.high);
		const low = quotationToNumber$2(candle.low);
		const close = quotationToNumber$2(candle.close);
		const time = candle.time || (/* @__PURE__ */ new Date()).toISOString();
		if (high > this.dailyProfile.valueAreaHigh) {
			this.hasBrokenHigh = true;
			this.hasBrokenLow = false;
		}
		if (low < this.dailyProfile.valueAreaLow) {
			this.hasBrokenLow = true;
			this.hasBrokenHigh = false;
		}
		if (this.hasBrokenHigh && close < this.dailyProfile.valueAreaHigh) {
			this.signals.push({
				type: "SELL",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Return to VA after breaking high (VAH=${this.dailyProfile.valueAreaHigh})`
			});
			this.hasBrokenHigh = false;
			this.hasPosition = true;
		}
		if (this.hasBrokenLow && close > this.dailyProfile.valueAreaLow) {
			this.signals.push({
				type: "BUY",
				price: close,
				time,
				instrumentUid: this.instrumentUid,
				reason: `Return to VA after breaking low (VAL=${this.dailyProfile.valueAreaLow})`
			});
			this.hasBrokenLow = false;
			this.hasPosition = true;
		}
	}
	getSignals() {
		return this.signals;
	}
};
function quotationToNumber$2(q) {
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
function quotationToNumber$1(q) {
	if (!q) return 0;
	return Number(q.units || 0) + (q.nano || 0) / 1e9;
}
/** Преобразует Timestamp (строка ISO или объект {seconds,nanos}) в ISO-строку */
function timestampToISO(ts) {
	if (!ts) return (/* @__PURE__ */ new Date()).toISOString();
	if (typeof ts === "object" && ts.seconds !== void 0) return (/* @__PURE__ */ new Date(ts.seconds * 1e3)).toISOString();
	if (typeof ts === "string") return new Date(ts).toISOString();
	return (/* @__PURE__ */ new Date()).toISOString();
}
var HistoricalDataLoader = class {
	async loadDailyProfile(instrumentUid, from, to, token, profileResolution = 50) {
		const request = {
			instrumentId: instrumentUid,
			interval: CandleInterval.CANDLE_INTERVAL_DAY,
			from: {
				seconds: Math.floor(from.getTime() / 1e3),
				nanos: 0
			},
			to: {
				seconds: Math.floor(to.getTime() / 1e3),
				nanos: 0
			},
			candleSourceType: CandleSourceRequest.CANDLE_SOURCE_EXCHANGE
		};
		const candles = (await marketDataGrpc.getCandles(request, token)).candles || [];
		if (candles.length === 0) return null;
		const engine = new VolumeProfileEngine({ profileResolution });
		for (const candle of candles) {
			const open = quotationToNumber$1(candle.open);
			const high = quotationToNumber$1(candle.high);
			const low = quotationToNumber$1(candle.low);
			const close = quotationToNumber$1(candle.close);
			const volume = Number(candle.volume || "0");
			const streamCandle = {
				instrumentUid,
				open: {
					units: open.toString(),
					nano: 0
				},
				high: {
					units: high.toString(),
					nano: 0
				},
				low: {
					units: low.toString(),
					nano: 0
				},
				close: {
					units: close.toString(),
					nano: 0
				},
				volume: volume.toString(),
				time: timestampToISO(candle.time)
			};
			engine.onCandle?.(streamCandle);
		}
		return engine.getProfile(instrumentUid);
	}
	async loadIntradayCandles(instrumentUid, from, to, token, interval = CandleInterval.CANDLE_INTERVAL_1_MIN) {
		const request = {
			instrumentId: instrumentUid,
			interval,
			from: {
				seconds: Math.floor(from.getTime() / 1e3),
				nanos: 0
			},
			to: {
				seconds: Math.floor(to.getTime() / 1e3),
				nanos: 0
			},
			candleSourceType: CandleSourceRequest.CANDLE_SOURCE_EXCHANGE
		};
		return ((await marketDataGrpc.getCandles(request, token)).candles || []).map((candle) => ({
			instrumentUid,
			open: candle.open,
			high: candle.high,
			low: candle.low,
			close: candle.close,
			volume: String(candle.volume || "0"),
			time: timestampToISO(candle.time)
		}));
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
	constructor(config) {
		this.initialCapital = config.initialCapital;
		this.capital = config.initialCapital;
		this.peakCapital = config.initialCapital;
	}
	processSignal(signal) {
		if (this.openPosition) this.closePosition(signal.price, signal.time);
		this.openPosition = {
			type: signal.type,
			price: signal.price,
			time: signal.time
		};
	}
	closePosition(price, time) {
		if (!this.openPosition) return;
		const entry = this.openPosition;
		let profit;
		if (entry.type === "BUY") profit = price - entry.price;
		else profit = entry.price - price;
		const profitPercent = profit / entry.price * 100;
		this.capital += profit;
		this.trades.push({
			type: entry.type,
			entryPrice: entry.price,
			exitPrice: price,
			entryTime: entry.time,
			exitTime: time,
			profit,
			profitPercent
		});
		if (this.capital > this.peakCapital) this.peakCapital = this.capital;
		const currentDrawdown = this.peakCapital - this.capital;
		if (currentDrawdown > this.maxDrawdown) this.maxDrawdown = currentDrawdown;
		this.openPosition = null;
	}
	finalizeWithLastPrice(lastPrice, time) {
		if (this.openPosition) this.closePosition(lastPrice, time);
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
//#region src/main/ipcHandlers/tradingAssistantHandlers.ts
var orderManagerInstance$1 = null;
var setOrderManagerInstance = (manager) => {
	orderManagerInstance$1 = manager;
};
var registerTradingAssistantHandlers = () => {
	electron.ipcMain.handle("trading-assistant:get-profile", (_, instrumentUid) => {
		const profile = volumeProfileEngine.getProfile(instrumentUid);
		return profile ? { ...profile } : null;
	});
	electron.ipcMain.on("trading-assistant:subscribe", (event) => {
		const win = electron.BrowserWindow.fromWebContents(event.sender);
		if (!win) return;
		const onProfileUpdate = (profile) => {
			if (!win.isDestroyed()) win.webContents.send("trading-assistant:profile-update", profile);
		};
		const onSignal = (signal) => {
			if (!win.isDestroyed()) win.webContents.send("trading-assistant:signal", signal);
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
					const strategy = new VolumeAccumulationStrategy(instrumentUid, engine.getProfile(instrumentUid));
					candles.forEach((c) => strategy.onCandle(c));
					const signals = strategy.getSignals();
					allSignals.push(...signals);
					allCandles.push(...candles);
				}
				currentDate.setDate(currentDate.getDate() + 1);
			}
			const portfolio = new VirtualPortfolio({ initialCapital: 1e5 });
			for (const signal of allSignals) portfolio.processSignal(signal);
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
				candles: allCandles
			};
		} catch (error) {
			console.error("Backtest error:", error);
			return null;
		}
	});
	electron.ipcMain.handle("trading-assistant:send-backtest-signals", async (_, signals) => {
		if (!orderManagerInstance$1) return {
			success: false,
			error: "OrderManager не инициализирован"
		};
		for (const signal of signals) await orderManagerInstance$1.processSignal(signal);
		return { success: true };
	});
	electron.ipcMain.handle("trading-assistant:toggle-trading", async (_, enabled) => {
		if (orderManagerInstance$1) {
			orderManagerInstance$1.setRunning(enabled);
			return true;
		}
		return false;
	});
	electron.ipcMain.handle("trading-assistant:get-trading-status", async () => {
		return orderManagerInstance$1 ? orderManagerInstance$1.isRunning : false;
	});
	electron.ipcMain.handle("trading-assistant:set-lot-quantity", async (_, qty) => {
		if (orderManagerInstance$1) orderManagerInstance$1.config.lotQuantity = qty;
	});
	electron.ipcMain.handle("trading-assistant:get-accounts", async (_, token) => {
		if (!token) {
			console.error("[GetAccounts] Токен не передан");
			return [];
		}
		try {
			console.log("[GetAccounts] Запрос счетов с токеном:", token.slice(0, 10) + "...");
			const response = await sandboxGrpc.getSandboxAccounts({}, token);
			console.log("[GetAccounts] Ответ:", response);
			return (response.accounts || []).map((acc) => ({
				id: acc.id,
				name: acc.name || acc.id
			}));
		} catch (error) {
			console.error("[GetAccounts] Ошибка:", error.message || error);
			throw new Error(error.message || "Неизвестная ошибка");
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
		if (orderManagerInstance$1) {
			orderManagerInstance$1.updateConfig(config);
			return true;
		}
		return false;
	});
	marketDataBus.on("candle", (candle) => {
		const win = getTradingAssistantWindow();
		if (win && !win.isDestroyed()) win.webContents.send("candle-data", candle);
	});
	marketDataBus.on("lastPrice", (data) => {
		const win = getTradingAssistantWindow();
		if (win && !win.isDestroyed()) win.webContents.send("last-price-data", data);
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
var client$5 = createGrpcClient("users.proto", "UsersService");
var usersGrpc = {
	getInfo: (token) => new Promise((resolve, reject) => {
		client$5.GetInfo({}, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAccounts: (request, token) => new Promise((resolve, reject) => {
		client$5.GetAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getMarginAttributes: (request, token) => new Promise((resolve, reject) => {
		client$5.GetMarginAttributes(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getUserTariff: (request, token) => new Promise((resolve, reject) => {
		client$5.GetUserTariff(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencyTransfer: (request, token) => new Promise((resolve, reject) => {
		client$5.CurrencyTransfer(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	payIn: (request, token) => new Promise((resolve, reject) => {
		client$5.PayIn(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBankAccounts: (request, token) => new Promise((resolve, reject) => {
		client$5.GetBankAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/InstrumentsGrpcService.ts
var client$4 = createGrpcClient("instruments.proto", "InstrumentsService");
var instrumentsGrpc = {
	bondBy: (request, token) => new Promise((resolve, reject) => {
		client$4.BondBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	bonds: (request, token) => new Promise((resolve, reject) => {
		client$4.Bonds(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	createFavoriteGroup: (request, token) => new Promise((resolve, reject) => {
		client$4.CreateFavoriteGroup(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencies: (request, token) => new Promise((resolve, reject) => {
		client$4.Currencies(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencyBy: (request, token) => new Promise((resolve, reject) => {
		client$4.CurrencyBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	deleteFavoriteGroup: (request, token) => new Promise((resolve, reject) => {
		client$4.DeleteFavoriteGroup(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	editFavorites: (request, token) => new Promise((resolve, reject) => {
		client$4.EditFavorites(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	etfBy: (request, token) => new Promise((resolve, reject) => {
		client$4.EtfBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	etfs: (request, token) => new Promise((resolve, reject) => {
		client$4.Etfs(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	findInstrument: (request, token) => new Promise((resolve, reject) => {
		client$4.FindInstrument(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	futureBy: (request, token) => new Promise((resolve, reject) => {
		client$4.FutureBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	futures: (request, token) => new Promise((resolve, reject) => {
		client$4.Futures(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAccruedInterests: (request, token) => new Promise((resolve, reject) => {
		client$4.GetAccruedInterests(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetBy: (request, token) => new Promise((resolve, reject) => {
		client$4.GetAssetBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetFundamentals: (request, token) => new Promise((resolve, reject) => {
		client$4.GetAssetFundamentals(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetReports: (request, token) => new Promise((resolve, reject) => {
		client$4.GetAssetReports(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssets: (request, token) => new Promise((resolve, reject) => {
		client$4.GetAssets(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBondCoupons: (request, token) => new Promise((resolve, reject) => {
		client$4.GetBondCoupons(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBondEvents: (request, token) => new Promise((resolve, reject) => {
		client$4.GetBondEvents(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrandBy: (request, token) => new Promise((resolve, reject) => {
		client$4.GetBrandBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrands: (request, token) => new Promise((resolve, reject) => {
		client$4.GetBrands(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getConsensusForecasts: (request, token) => new Promise((resolve, reject) => {
		client$4.GetConsensusForecasts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getCountries: (request, token) => new Promise((resolve, reject) => {
		client$4.GetCountries(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getDividends: (request, token) => new Promise((resolve, reject) => {
		client$4.GetDividends(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFavoriteGroups: (request, token) => new Promise((resolve, reject) => {
		client$4.GetFavoriteGroups(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFavorites: (request, token) => new Promise((resolve, reject) => {
		client$4.GetFavorites(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getForecastBy: (request, token) => new Promise((resolve, reject) => {
		client$4.GetForecastBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFuturesMargin: (request, token) => new Promise((resolve, reject) => {
		client$4.GetFuturesMargin(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getInsiderDeals: (request, token) => new Promise((resolve, reject) => {
		client$4.GetInsiderDeals(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getInstrumentBy: (request, token) => new Promise((resolve, reject) => {
		client$4.GetInstrumentBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getRiskRates: (request, token) => new Promise((resolve, reject) => {
		client$4.GetRiskRates(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	indicatives: (request, token) => new Promise((resolve, reject) => {
		client$4.Indicatives(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	optionBy: (request, token) => new Promise((resolve, reject) => {
		client$4.OptionBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	options: (request, token) => new Promise((resolve, reject) => {
		client$4.Options(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	optionsBy: (request, token) => new Promise((resolve, reject) => {
		client$4.OptionsBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	shareBy: (request, token) => new Promise((resolve, reject) => {
		client$4.ShareBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	shares: (request, token) => new Promise((resolve, reject) => {
		client$4.Shares(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	structuredNoteBy: (request, token) => new Promise((resolve, reject) => {
		client$4.StructuredNoteBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	structuredNotes: (request, token) => new Promise((resolve, reject) => {
		client$4.StructuredNotes(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	tradingSchedules: (request, token) => new Promise((resolve, reject) => {
		client$4.TradingSchedules(request, createMetadata(token), (err, response) => {
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
//#region src/main/services/orderManager.ts
var OrderManager = class {
	config;
	activeOrderId = null;
	isRunning = false;
	lastOrderTime = 0;
	constructor(config = {}) {
		this.config = {
			lotQuantity: 1,
			useMarketOrder: true,
			demoMode: true,
			token: "",
			accountId: "",
			...config
		};
	}
	updateConfig(patch) {
		this.config = {
			...this.config,
			...patch
		};
	}
	setRunning(state) {
		this.isRunning = state;
		console.log(`[OrderManager] Автоторговля ${state ? "запущена" : "остановлена"}`);
	}
	async processSignal(signal) {
		if (!this.isRunning) {
			console.log("[OrderManager] Автоторговля выключена, сигнал проигнорирован");
			return;
		}
		const now = Date.now();
		if (now - this.lastOrderTime < 300 * 1e3) {
			console.log("[OrderManager] Слишком частые сигналы, пропускаем");
			return;
		}
		if (this.config.demoMode) {
			const direction = signal.type === "BUY" ? "BUY" : "SELL";
			const quantity = this.config.lotQuantity;
			const price = signal.price;
			console.log(`[OrderManager][DEMO] ${direction} ${quantity} лотов по цене ${price}`);
			return;
		}
		if (!this.config.token || !this.config.accountId) {
			console.warn("[OrderManager] Не заданы токен или accountId");
			return;
		}
		const direction = signal.type === "BUY" ? OrderDirection.ORDER_DIRECTION_BUY : OrderDirection.ORDER_DIRECTION_SELL;
		const quantity = this.config.lotQuantity;
		const price = signal.price;
		try {
			if (this.config.demoMode) {
				console.log(`[OrderManager][DEMO] ${direction === OrderDirection.ORDER_DIRECTION_BUY ? "BUY" : "SELL"} ${quantity} лотов по цене ${price}`);
				return;
			}
			const orderType = this.config.useMarketOrder ? OrderType.ORDER_TYPE_MARKET : OrderType.ORDER_TYPE_LIMIT;
			const order = await sandboxGrpc.postSandboxOrder({
				instrumentId: signal.instrumentUid,
				direction,
				orderType,
				quantity,
				price: this.config.useMarketOrder ? void 0 : {
					units: Math.floor(price),
					nano: Math.round(price % 1 * 1e9)
				},
				accountId: this.config.accountId
			}, this.config.token);
			this.activeOrderId = order.orderId ?? null;
			console.log(`[OrderManager] Ордер отправлен: ${this.activeOrderId}`);
			this.lastOrderTime = now;
		} catch (error) {
			console.error("[OrderManager] Ошибка отправки ордера:", error);
		}
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
};
//#endregion
//#region src/main/services/tradingConnector.ts
function connectOrderManager(manager) {
	volumeProfileEngine.on("signal", (signal) => {
		console.log("[TradingConnector] Получен сигнал:", signal);
		manager.processSignal(signal);
	});
}
//#endregion
//#region src/main/main.ts
var scriptsDir = path.default.join(electron.app.getPath("userData"), "scripts");
if (!(0, fs.existsSync)(scriptsDir)) {
	(0, fs.mkdirSync)(scriptsDir, { recursive: true });
	console.log("[Main] Создана папка для скриптов:", scriptsDir);
}
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
	registerTradingAssistantHandlers();
	const orderManager = new OrderManager({
		demoMode: true,
		token: "",
		accountId: ""
	});
	connectOrderManager(orderManager);
	setOrderManagerInstance(orderManager);
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
var orderManagerInstance = new OrderManager({
	demoMode: false,
	token: process.env.VITE_TSandBox || "",
	accountId: ""
});
connectOrderManager(orderManagerInstance);
setOrderManagerInstance(orderManagerInstance);
//#endregion

//# sourceMappingURL=main.js.map