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
let child_process = require("child_process");
let fs_promises = require("fs/promises");
fs_promises = __toESM(fs_promises);
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/@grpc/grpc-js/build/src/index.js");
_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js = __toESM(_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_grpc_js_build_src_index_js);
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/@grpc/proto-loader/build/src/index.js");
_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js = __toESM(_home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules__grpc_proto_loader_build_src_index_js);
let fs = require("fs");
fs = __toESM(fs);
let _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_uuid_dist_node_index_js = require("/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron/node_modules/uuid/dist-node/index.js");
//#region src/main/windows/mainWindow.ts
var mainWindow = null;
var preloadPath$6 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5173";
path.default.join(__dirname, "../../renderer/main-window/index.html");
var createMainWindow = () => {
	mainWindow = new electron.BrowserWindow({
		width: 1024,
		height: 768,
		title: "Мы на Луну!",
		webPreferences: {
			preload: preloadPath$6,
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
var preloadPath$5 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createAIWindow = () => {
	console.log("createAIWindow called");
	aiWindow = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Нейро",
		webPreferences: {
			preload: preloadPath$5,
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
//#endregion
//#region src/main/windows/bondsWindow.ts
var bondsWindow$1 = null;
var preloadPath$4 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createBondsWindow = () => {
	bondsWindow$1 = new electron.BrowserWindow({
		width: 1024,
		height: 768,
		title: "Облигации",
		webPreferences: {
			preload: preloadPath$4,
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
var preloadPath$3 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createMDWindow = () => {
	mdWindow$1 = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Markdown",
		webPreferences: {
			preload: preloadPath$3,
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
var preloadPath$2 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
var createPGWindow = () => {
	pgWindow$1 = new electron.BrowserWindow({
		width: 800,
		height: 600,
		title: "Генератор запросов",
		webPreferences: {
			preload: preloadPath$2,
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
var preloadPath$1 = electron.app.isPackaged ? path.default.join(process.resourcesPath, "preload.js") : path.default.join(__dirname, "../../dist/main/preload.js");
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
			preload: preloadPath$1,
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
							JSON.parse(jsonStr);
							const win = getBondsWindow();
							if (win && !win.isDestroyed()) win.webContents.send("md-stream-data", jsonStr);
							else console.warn("[Main] Bonds window not available");
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
//#region src/main/services/tbank/UsersGrpcService.ts
var client$7 = createGrpcClient("users.proto", "UsersService");
var usersGrpc = {
	getInfo: (token) => new Promise((resolve, reject) => {
		client$7.GetInfo({}, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAccounts: (request, token) => new Promise((resolve, reject) => {
		client$7.GetAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getMarginAttributes: (request, token) => new Promise((resolve, reject) => {
		client$7.GetMarginAttributes(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getUserTariff: (request, token) => new Promise((resolve, reject) => {
		client$7.GetUserTariff(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencyTransfer: (request, token) => new Promise((resolve, reject) => {
		client$7.CurrencyTransfer(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	payIn: (request, token) => new Promise((resolve, reject) => {
		client$7.PayIn(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBankAccounts: (request, token) => new Promise((resolve, reject) => {
		client$7.GetBankAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/InstrumentsGrpcService.ts
var client$6 = createGrpcClient("instruments.proto", "InstrumentsService");
var instrumentsGrpc = {
	bondBy: (request, token) => new Promise((resolve, reject) => {
		client$6.BondBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	bonds: (request, token) => new Promise((resolve, reject) => {
		client$6.Bonds(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	createFavoriteGroup: (request, token) => new Promise((resolve, reject) => {
		client$6.CreateFavoriteGroup(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencies: (request, token) => new Promise((resolve, reject) => {
		client$6.Currencies(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	currencyBy: (request, token) => new Promise((resolve, reject) => {
		client$6.CurrencyBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	deleteFavoriteGroup: (request, token) => new Promise((resolve, reject) => {
		client$6.DeleteFavoriteGroup(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	editFavorites: (request, token) => new Promise((resolve, reject) => {
		client$6.EditFavorites(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	etfBy: (request, token) => new Promise((resolve, reject) => {
		client$6.EtfBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	etfs: (request, token) => new Promise((resolve, reject) => {
		client$6.Etfs(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	findInstrument: (request, token) => new Promise((resolve, reject) => {
		client$6.FindInstrument(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	futureBy: (request, token) => new Promise((resolve, reject) => {
		client$6.FutureBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	futures: (request, token) => new Promise((resolve, reject) => {
		client$6.Futures(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAccruedInterests: (request, token) => new Promise((resolve, reject) => {
		client$6.GetAccruedInterests(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetBy: (request, token) => new Promise((resolve, reject) => {
		client$6.GetAssetBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetFundamentals: (request, token) => new Promise((resolve, reject) => {
		client$6.GetAssetFundamentals(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssetReports: (request, token) => new Promise((resolve, reject) => {
		client$6.GetAssetReports(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getAssets: (request, token) => new Promise((resolve, reject) => {
		client$6.GetAssets(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBondCoupons: (request, token) => new Promise((resolve, reject) => {
		client$6.GetBondCoupons(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBondEvents: (request, token) => new Promise((resolve, reject) => {
		client$6.GetBondEvents(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrandBy: (request, token) => new Promise((resolve, reject) => {
		client$6.GetBrandBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrands: (request, token) => new Promise((resolve, reject) => {
		client$6.GetBrands(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getConsensusForecasts: (request, token) => new Promise((resolve, reject) => {
		client$6.GetConsensusForecasts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getCountries: (request, token) => new Promise((resolve, reject) => {
		client$6.GetCountries(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getDividends: (request, token) => new Promise((resolve, reject) => {
		client$6.GetDividends(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFavoriteGroups: (request, token) => new Promise((resolve, reject) => {
		client$6.GetFavoriteGroups(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFavorites: (request, token) => new Promise((resolve, reject) => {
		client$6.GetFavorites(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getForecastBy: (request, token) => new Promise((resolve, reject) => {
		client$6.GetForecastBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getFuturesMargin: (request, token) => new Promise((resolve, reject) => {
		client$6.GetFuturesMargin(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getInsiderDeals: (request, token) => new Promise((resolve, reject) => {
		client$6.GetInsiderDeals(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getInstrumentBy: (request, token) => new Promise((resolve, reject) => {
		client$6.GetInstrumentBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getRiskRates: (request, token) => new Promise((resolve, reject) => {
		client$6.GetRiskRates(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	indicatives: (request, token) => new Promise((resolve, reject) => {
		client$6.Indicatives(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	optionBy: (request, token) => new Promise((resolve, reject) => {
		client$6.OptionBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	options: (request, token) => new Promise((resolve, reject) => {
		client$6.Options(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	optionsBy: (request, token) => new Promise((resolve, reject) => {
		client$6.OptionsBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	shareBy: (request, token) => new Promise((resolve, reject) => {
		client$6.ShareBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	shares: (request, token) => new Promise((resolve, reject) => {
		client$6.Shares(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	structuredNoteBy: (request, token) => new Promise((resolve, reject) => {
		client$6.StructuredNoteBy(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	structuredNotes: (request, token) => new Promise((resolve, reject) => {
		client$6.StructuredNotes(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	tradingSchedules: (request, token) => new Promise((resolve, reject) => {
		client$6.TradingSchedules(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/MarketDataGrpcService.ts
var client$5 = createGrpcClient("marketdata.proto", "MarketDataService");
var marketDataGrpc = {
	getCandles: (request, token) => new Promise((resolve, reject) => {
		client$5.GetCandles(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getClosePrices: (request, token) => new Promise((resolve, reject) => {
		client$5.GetClosePrices(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getLastPrices: (request, token) => new Promise((resolve, reject) => {
		client$5.GetLastPrices(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getLastTrades: (request, token) => new Promise((resolve, reject) => {
		client$5.GetLastTrades(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getMarketValues: (request, token) => new Promise((resolve, reject) => {
		client$5.GetMarketValues(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrderBook: (request, token) => new Promise((resolve, reject) => {
		client$5.GetOrderBook(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getTechAnalysis: (request, token) => new Promise((resolve, reject) => {
		client$5.GetTechAnalysis(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getTradingStatus: (request, token) => new Promise((resolve, reject) => {
		client$5.GetTradingStatus(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getTradingStatuses: (request, token) => new Promise((resolve, reject) => {
		client$5.GetTradingStatuses(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/OperationsGrpcService.ts
var client$4 = createGrpcClient("operations.proto", "OperationsService");
var operationsGrpc = {
	getOperations: (request, token) => new Promise((resolve, reject) => {
		client$4.GetOperations(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getPortfolio: (request, token) => new Promise((resolve, reject) => {
		client$4.GetPortfolio(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getPositions: (request, token) => new Promise((resolve, reject) => {
		client$4.GetPositions(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getWithdrawLimits: (request, token) => new Promise((resolve, reject) => {
		client$4.GetWithdrawLimits(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getBrokerReport: (request, token) => new Promise((resolve, reject) => {
		client$4.GetBrokerReport(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getDividendsForeignIssuer: (request, token) => new Promise((resolve, reject) => {
		client$4.GetDividendsForeignIssuer(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOperationsByCursor: (request, token) => new Promise((resolve, reject) => {
		client$4.GetOperationsByCursor(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/OrdersGrpcService.ts
var client$3 = createGrpcClient("orders.proto", "OrdersService");
var ordersGrpc = {
	postOrder: (request, token) => new Promise((resolve, reject) => {
		client$3.PostOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postOrderAsync: (request, token) => new Promise((resolve, reject) => {
		client$3.PostOrderAsync(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	cancelOrder: (request, token) => new Promise((resolve, reject) => {
		client$3.CancelOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrderState: (request, token) => new Promise((resolve, reject) => {
		client$3.GetOrderState(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrders: (request, token) => new Promise((resolve, reject) => {
		client$3.GetOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	replaceOrder: (request, token) => new Promise((resolve, reject) => {
		client$3.ReplaceOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getMaxLots: (request, token) => new Promise((resolve, reject) => {
		client$3.GetMaxLots(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getOrderPrice: (request, token) => new Promise((resolve, reject) => {
		client$3.GetOrderPrice(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/StopOrdersGrpcService.ts
var client$2 = createGrpcClient("stoporders.proto", "StopOrdersService");
var stopOrdersGrpc = {
	cancelStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$2.CancelStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getStopOrders: (request, token) => new Promise((resolve, reject) => {
		client$2.GetStopOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$2.PostStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	})
};
//#endregion
//#region src/main/services/tbank/SandboxGrpcService.ts
var client$1 = createGrpcClient("sandbox.proto", "SandboxService");
var sandboxGrpc = {
	openSandboxAccount: (request, token) => new Promise((resolve, reject) => {
		client$1.OpenSandboxAccount(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	closeSandboxAccount: (request, token) => new Promise((resolve, reject) => {
		client$1.CloseSandboxAccount(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxAccounts: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxAccounts(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	sandboxPayIn: (request, token) => new Promise((resolve, reject) => {
		client$1.SandboxPayIn(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postSandboxOrder: (request, token) => new Promise((resolve, reject) => {
		client$1.PostSandboxOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postSandboxOrderAsync: (request, token) => new Promise((resolve, reject) => {
		client$1.PostSandboxOrderAsync(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	cancelSandboxOrder: (request, token) => new Promise((resolve, reject) => {
		client$1.CancelSandboxOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOrderState: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxOrderState(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOrders: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	replaceSandboxOrder: (request, token) => new Promise((resolve, reject) => {
		client$1.ReplaceSandboxOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxMaxLots: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxMaxLots(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOrderPrice: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxOrderPrice(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	cancelSandboxStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$1.CancelSandboxStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxStopOrders: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxStopOrders(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	postSandboxStopOrder: (request, token) => new Promise((resolve, reject) => {
		client$1.PostSandboxStopOrder(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOperations: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxOperations(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxOperationsByCursor: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxOperationsByCursor(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxPortfolio: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxPortfolio(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxPositions: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxPositions(request, createMetadata(token), (err, response) => {
			if (err) reject(err);
			else resolve(response);
		});
	}),
	getSandboxWithdrawLimits: (request, token) => new Promise((resolve, reject) => {
		client$1.GetSandboxWithdrawLimits(request, createMetadata(token), (err, response) => {
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
		tasks.push(task);
		writeTasks(tasks);
	}
	update(updated) {
		writeTasks(readTasks().map((t) => t.id === updated.id ? updated : t));
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
	if (process.env.NODE_ENV === "development") tasksWindow.loadURL(`${DEV_SERVER_URL}/#/tasks`);
	else tasksWindow.loadFile(getMainWindowProdPath(), { hash: "/tasks" });
	tasksWindow.on("closed", () => {
		tasksWindow = null;
	});
	return tasksWindow;
};
var getTasksWindow = () => tasksWindow;
//#endregion
//#region src/main/ipcHandlers/tasksHandlers.ts
function registerTasksHandlers() {
	electron.ipcMain.handle("tasks:getAll", () => {
		return taskStore.getAll();
	});
	electron.ipcMain.handle("tasks:add", (_event, taskData) => {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const newTask = {
			id: (0, _home_ll_Документы_GitHub_wetothemoon_project_wetothemoon_electron_node_modules_uuid_dist_node_index_js.v4)(),
			...taskData,
			createdAt: now,
			updatedAt: now
		};
		taskStore.add(newTask);
		return newTask;
	});
	electron.ipcMain.handle("tasks:update", (_event, task) => {
		task.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		taskStore.update(task);
		return task;
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
//#region src/main/services/scheduler.ts
var Scheduler = class {
	timer;
	CHECK_INTERVAL = 3e4;
	start() {
		console.log("[Scheduler] Started");
		this.checkTasks();
		this.timer = setInterval(() => this.checkTasks(), this.CHECK_INTERVAL);
	}
	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = void 0;
		}
	}
	checkTasks() {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const tasks = taskStore.getAll().filter((t) => t.enabled);
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
				console.warn("[Scheduler] cron не реализован, пропускаем задачу", task.id);
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
				case "react-command": break;
				case "main-function":
					await this.callRegisteredFunction(task.action.payload.functionName, task.action.payload.args);
					break;
				case "script": break;
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
//#region src/main/main.ts
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
//#endregion

//# sourceMappingURL=main.js.map