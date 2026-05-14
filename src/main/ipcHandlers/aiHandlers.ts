import { BrowserWindow, ipcMain } from 'electron';
import { createAIWindow, getAIWindow } from '../windows/aiWindow';

const aiWindow = getAIWindow();

// Пример функции вызова API
const callAIAPI = async (prompt: string): Promise<string> => {
  // Реализация зависит от способа доступа к AI:
  // - Локальный запуск через Ollama (`http://localhost:11434/api/generate`)
  // - Облачный API-провайдер
  // - Собственный бэкенд
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 't-tech/T-lite-it-2.1:q4_K_M',
      prompt: prompt,
      stream: false
    })
  });
  const data = await response.json();
  console.log('callAIAPI response:', data);
  return data.response || 'Нет ответа';
};

export const registerAIHandlers = () => {
  // регистрируем обработчики API, за исключением open-ai-window

  ipcMain.handle('send-to-ai', async (event, message) => {
    try {
      // Здесь реализуем вызов API AI
      // Например, через Ollama API или локальный сервер
      const response = await callAIAPI(message);
      console.log('API response:', response);
      return response;
    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  });

  // Пример
  ipcMain.handle('save-ai-result', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    // Логика сохранения результата
    console.log('Saving AI result from:', window?.title);
  });

};