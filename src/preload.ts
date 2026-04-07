// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onLanguageChange: (callback: (locale: string) => void) => {
    ipcRenderer.on('language-changed', (_event, locale) => callback(locale));
  },
  openLlamaWindow: () => ipcRenderer.invoke('open-llama-window'),
  sendMessageToLlama: (message: string) => ipcRenderer.invoke('send-to-llama', message).then((response) => {
    console.log(response);
    return response;
  }),
  onLlamaResponse: (callback: (data: any) => void) =>
    ipcRenderer.on('llama-response', (_, data) => callback(data))
});
