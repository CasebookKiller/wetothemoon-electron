import { useState } from 'react';

export const useLocalStorage = () => {
  //const [value, setValue] = useState<any>(null);
  const setItem = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      //setValue(value);
    } catch (error) {
      console.error('Ошибка сохранения в localStorage:', error);
      throw error;
    }
  };

  const getItem = (key: string) => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return typeof stored === 'string' ? JSON.parse(stored || '{}') : stored;
        //setValue(JSON.parse(stored));
      }
      return null;
    } catch (error) {
      console.error('Ошибка загрузки из localStorage:', error);
      return null;
    }
  };

  const removeItem = (key: string) => {
    localStorage.removeItem(key);
  };

  const clearOldConversations = () => {
    const allKeys = Object.keys(localStorage);
    const conversationKeys = allKeys.filter(k => k.startsWith('conversation-'));
    if (conversationKeys.length > 50) {
      conversationKeys
        .sort()
        .slice(0, -50)
        .forEach(key => localStorage.removeItem(key));
    }
  };

  return { /*value,*/ setItem, getItem, removeItem, clearOldConversations };
};

/*import { useState } from 'react';

export const useLocalStorage = () => {
  const [value, setValue] = useState<any>(null);

  const setItem = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setValue(value);
    } catch (error) {
      console.error('Ошибка сохранения в localStorage:', error);
      throw error;
    }
  };

  // old
  //const getItem = (key: string) => {
  //  const value = localStorage.getItem(key);
  //  setValue(value);
  //  return value;
  //};

  const getItem = (key: string) => {
    try {
      const stored = localStorage.getItem(key);
      // проверить на совместимость с остальным кодом
      if (stored) {
        const parsed = JSON.parse(stored);
        setValue(parsed);
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('Ошибка загрузки из localStorage:', error);
      return null;
    }
  };

  const removeItem = (key: string) => {
    localStorage.removeItem(key);
    setValue(null);
  };

    // Очистка старых данных при переполнении
  const clearOldConversations = () => {
    const allKeys = Object.keys(localStorage);
    // Оставляем только самые свежие диалоги
    const conversationKeys = allKeys.filter(k => k.startsWith('conversation-'));
    if (conversationKeys.length > 50) { // лимит 50 диалогов
      // Сортируем по дате создания (если есть информация)
      conversationKeys.sort().slice(0, -50).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  };

  return { value, setItem, getItem, removeItem, clearOldConversations };
};*/



