// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { FineTuningData, TrainingProgress } from './types/types';

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    onLanguageChange: (callback: (locale: string) => void) => {
      ipcRenderer.on('language-changed', (_event, locale) => callback(locale));
    },
    openAIWindow: () => ipcRenderer.invoke('open-ai-window'),
    openBondsWindow: () => ipcRenderer.invoke('open-bonds-window'),
    openMDWindow: () => ipcRenderer.invoke('open-md-window'),
    openPGWindow: () => ipcRenderer.invoke('open-pg-window'),
    openOllamaWindow: () => ipcRenderer.invoke('open-ollama-window'),
    sendMessageToAI: (message: string) => ipcRenderer.invoke('send-to-ai', message).then((response) => {
      console.log(response);
      return response;
    }),
    onAIResponse: (callback: (data: any) => void) =>
      ipcRenderer.on('ai-response', (_, data) => callback(data)),
    startFineTuning: (data: FineTuningData) =>
      ipcRenderer.invoke('start-fine-tuning', data),
    onTrainingProgress: (callback: (progress: TrainingProgress) => void) =>
      ipcRenderer.on('training-progress', (_, progress: TrainingProgress) => callback(progress)),
    offTrainingProgress: (callback: (event: IpcRendererEvent, progress: TrainingProgress) => void) =>
      ipcRenderer.removeListener('training-progress', callback),
    onMenuClick: (callback: (data: any) => void) => {
      ipcRenderer.on('menu-click', (event, data) => {
        console.log('menu-click: ', data );
        return callback(data)})
    },
    removeMenuListener: () =>
      ipcRenderer.removeAllListeners('menu-click')
  });

} catch (e) {
  console.log(e);
}