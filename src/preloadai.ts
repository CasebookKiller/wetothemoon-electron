// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { app, contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
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
    onExportCurrentConversatonClick: (callback: (data: any) => void) => {
      ipcRenderer.on('export-current-conversation', (event, data) => {
        console.log('export-current-conversation: ', data );
        return callback(data)})
    },
    onExportAllConversationsClick: (callback: (data: any) => void) => {
      ipcRenderer.on('export-all-conversations', (event, data) => {
        console.log('export-all-conversations: ', data );
        return callback(data)})
    },
    onBackupToSupabaseClick: (callback: (data: any) => void) => {
      ipcRenderer.on('backup-to-supabase', (event, data) => {
        console.log('backup-to-supabase: ', data );
        return callback(data)})
    },
    removeExportCurrentConversationListener: () =>
      ipcRenderer.removeAllListeners('export-current-conversation'),
    removeExportAllConversationsListener: () =>
      ipcRenderer.removeAllListeners('axport-all-conversations'),
    removeBackupToSupabaseListener: () =>
      ipcRenderer.removeAllListeners('backup-to-supabase'),
    openFilePicker: async (): Promise<string[] | null> => {
      try {
        const result = await ipcRenderer.invoke('open-file-picker');
        return result;
      } catch (error) {
        console.error('Ошибка при вызове диалога выбора файлов:', error);
        return null;
      }
    },
    readFilesContents: async (filePaths: string[]): Promise<{ path: string; content: string }[]> => {
      try {
        const contents = await ipcRenderer.invoke('read-files-contents', filePaths);
        return contents;
      } catch (error) {
        console.error('Ошибка при чтении файлов:', error);
        throw error;
      }
    },
    onFilePickerResult: (callback: (files: string[] | null) => void) => {
      ipcRenderer.on('file-picker-result', (event, files: string[] | null) => {
        callback(files);
      });
    }
  });
} catch (e) {
  console.log(e);
}