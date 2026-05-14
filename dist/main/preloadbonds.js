let electron = require("electron");
//#region src/preloadbonds.ts
try {
	electron.contextBridge.exposeInMainWorld("electronAPI", {
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
		}
	});
} catch (e) {
	console.log(e);
}
//#endregion
