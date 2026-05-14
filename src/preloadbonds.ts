// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // MarketdataStreamService
    startMarketStream: (token: string, body: any) => ipcRenderer.invoke('md-stream-start', token, body),
    stopMarketStream: () => ipcRenderer.invoke('md-stream-stop'),
    onMarketData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('md-stream-data');
      ipcRenderer.on('md-stream-data', (_, data: string) => callback(data));
    },
    onMarketClosed: (callback: () => void) => {
      ipcRenderer.removeAllListeners('md-stream-closed');
      ipcRenderer.on('md-stream-closed', callback);
    },
    onMarketError: (callback: (err: string) => void) => {
      ipcRenderer.removeAllListeners('md-stream-error');
      ipcRenderer.on('md-stream-error', (_, err: string) => callback(err));
    },
    // OperationsStreamService
    startOpsStream: (streamType: string, token: string, body: any) =>
      ipcRenderer.invoke('ops-stream-start', streamType, token, body),
    stopOpsStream: () => ipcRenderer.invoke('ops-stream-stop'),

    onOpsPortfolioData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('ops-portfolio-data');
      ipcRenderer.on('ops-portfolio-data', (_, data: string) => callback(data));
    },
    onOpsPositionsData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('ops-positions-data');
      ipcRenderer.on('ops-positions-data', (_, data: string) => callback(data));
    },
    onOpsOperationsData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('ops-operations-data');
      ipcRenderer.on('ops-operations-data', (_, data: string) => callback(data));
    },
    onOpsStreamClosed: (callback: (streamType: string) => void) => {
      ipcRenderer.removeAllListeners('ops-portfolio-closed');
      ipcRenderer.removeAllListeners('ops-positions-closed');
      ipcRenderer.removeAllListeners('ops-operations-closed');
      ipcRenderer.on('ops-portfolio-closed', () => callback('portfolio'));
      ipcRenderer.on('ops-positions-closed', () => callback('positions'));
      ipcRenderer.on('ops-operations-closed', () => callback('operations'));
    },
    onOpsStreamError: (callback: (streamType: string, err: string) => void) => {
      ipcRenderer.removeAllListeners('ops-stream-error');
      ipcRenderer.on('ops-stream-error', (_, streamType: string, err: string) => callback(streamType, err));
    },
    // OrdersStreamService
    startOrdersStream: (streamType: string, token: string, body: any) =>
      ipcRenderer.invoke('orders-stream-start', streamType, token, body),
    stopOrdersStream: () => ipcRenderer.invoke('orders-stream-stop'),

    onOrdersTradesData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('orders-trades-data');
      ipcRenderer.on('orders-trades-data', (_, data: string) => callback(data));
    },
    onOrdersOrderStateData: (callback: (data: string) => void) => {
      ipcRenderer.removeAllListeners('orders-orderState-data');
      ipcRenderer.on('orders-orderState-data', (_, data: string) => callback(data));
    },
    onOrdersStreamClosed: (callback: (streamType: string) => void) => {
      ipcRenderer.removeAllListeners('orders-trades-closed');
      ipcRenderer.removeAllListeners('orders-orderState-closed');
      ipcRenderer.on('orders-trades-closed', () => callback('trades'));
      ipcRenderer.on('orders-orderState-closed', () => callback('orderState'));
    },
    onOrdersStreamError: (callback: (streamType: string, err: string) => void) => {
      ipcRenderer.removeAllListeners('orders-stream-error');
      ipcRenderer.on('orders-stream-error', (_, streamType: string, err: string) => callback(streamType, err));
    },
  });
} catch (e) {
  console.log(e);
}

