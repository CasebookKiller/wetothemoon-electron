// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

try {
  contextBridge.exposeInMainWorld('fileAPI', {
//    showSaveFileDialog: (defaultName: string) =>
//      ipcRenderer.invoke('show-save-dialog', defaultName),
//    showOpenFileDialog: () => ipcRenderer.invoke('show-open-dialog')
  });
  contextBridge.exposeInMainWorld('electronAPI', {
    // универсальный метод
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
    },
    
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
    },
    
    getProjectTree: (folderPath: string) => ipcRenderer.invoke('get-project-tree', folderPath),
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    getPackageDependencies: () => ipcRenderer.invoke('get-package-dependencies'),

    getPackageJson: () => ipcRenderer.invoke('get-package-json'),

    getConfigFile: (fileName: string, parseJson?: boolean) => ipcRenderer.invoke('get-config-file', fileName, parseJson),
    getProjectTreeJson: (folderPath?: string) => ipcRenderer.invoke('get-project-tree-json', folderPath),
  });
} catch (e) {
  console.log(e);
}
