// src/main/ipcHandlers/gatewayHandlers.ts

import { ipcMain } from 'electron';
import { DeepSeekService } from '../services/gateway/deepseekService';

export function registerGatewayHandlers(): void {
  const service = DeepSeekService.getInstance();

  ipcMain.handle('gateway:launch', async () => {
    try {
      const result = await service.launch();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:close', async () => {
    try {
      await service.close();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-status', () => {
    return service.getStatus();
  });

  ipcMain.handle('gateway:send-message', async (_event, message: string) => {
    try {
      const response = await service.sendMessage(message);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-conversations', async () => {
    try {
      const data = await service.getConversations();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:open-conversation', async (_event, id: string) => {
    try {
      await service.openConversation(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:select-model', async (_event, modelType: string) => {
    try {
      await service.selectModel(modelType as 'default' | 'expert' | 'vision');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:set-deep-thinking', async (_event, enabled: boolean) => {
    try {
      await service.setDeepThinking(enabled);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:set-search', async (_event, enabled: boolean) => {
    try {
      await service.setSearch(enabled);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-current-model', async () => {
    try {
      const data = await service.getCurrentModel();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-deep-thinking', async () => {
    try {
      const data = await service.getDeepThinking();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-search', async () => {
    try {
      const data = await service.getSearch();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-conversation-messages', async () => {
    try {
      const data = await service.getConversationMessages();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:start-selection-mode', async () => {
    try {
      await service.startSelectionMode();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:select-messages', async (_event, indices: number[]) => {
    try {
      await service.selectMessages(indices);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:cancel-selection-mode', async () => {
    try {
      await service.cancelSelectionMode();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:create-public-link', async () => {
    try {
      const url = await service.createPublicLink();
      return { success: true, data: url };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:regenerate-message', async (_event, conversationId: string, messageIndex: number) => {
    try {
      await service.regenerateMessage(conversationId, messageIndex);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:send-feedback', async (_event, conversationId: string, messageIndex: number, type: string) => {
    try {
      await service.sendFeedback(conversationId, messageIndex, type as 'like' | 'dislike');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}