// src/main/ipcHandlers/tradingAssistantHandlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { volumeProfileEngine } from '../services/volumeProfileEngine';

export const registerTradingAssistantHandlers = () => {
  // Получить текущий профиль по инструменту (по запросу)
  ipcMain.handle('trading-assistant:get-profile', (_, instrumentUid: string) => {
    const profile = volumeProfileEngine.getProfile(instrumentUid);
    return profile ? { ...profile } : null; // сериализуем объект
  });

  // Подписка на обновления профиля и сигналы
  ipcMain.on('trading-assistant:subscribe', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    // Обработчик обновления профиля
    const onProfileUpdate = (profile: any) => {
      if (!win.isDestroyed()) {
        win.webContents.send('trading-assistant:profile-update', profile);
      }
    };

    // Обработчик сигналов
    const onSignal = (signal: any) => {
      if (!win.isDestroyed()) {
        win.webContents.send('trading-assistant:signal', signal);
      }
    };

    // Подписываемся
    volumeProfileEngine.on('profileUpdate', onProfileUpdate);
    volumeProfileEngine.on('signal', onSignal);

    // Когда окно закрывается, отписываемся (для предотвращения утечек)
    win.on('closed', () => {
      volumeProfileEngine.off('profileUpdate', onProfileUpdate);
      volumeProfileEngine.off('signal', onSignal);
    });
  });

  // Отписка (если понадобится вручную)
  ipcMain.on('trading-assistant:unsubscribe', (event) => {
    // Здесь можно реализовать ручную отписку, но автоматическая через closed обычно достаточна
  });
};