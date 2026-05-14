// utils/ipcUtils.ts

declare global {
  interface Window {
    electronAPI?: {
      getProjectTree: (folderPath: string) => Promise<string>;
      selectFolder: () => Promise<string | null>;
    };
  }
}

export const getProjectTree = async (folderPath: string): Promise<string> => {
  const electronAPI = window.electronAPI;

  if (!electronAPI) {
    throw new Error('Electron API недоступен');
  }

  return await electronAPI.getProjectTree(folderPath);
};

export const selectFolder = async (): Promise<string | null> => {
  const electronAPI = window.electronAPI;

  if (!electronAPI) {
    throw new Error('Electron API недоступен');
  }

  return await electronAPI.selectFolder();
};
