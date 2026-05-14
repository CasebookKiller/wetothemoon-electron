import { ButtonsWindows } from '@/components/DASHBOARD/ButtonsWindows/ButtonsWindows';
import { FC, useEffect, useState } from 'react';

export const DashboardPage:FC = () => {
  const [receivedData, setReceivedData] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
    console.log('DashboardPage.tsx: electronAPI: ', electronAPI);
    // Проверяем доступность API
    if (!electronAPI) {
      console.error('Electron API not available');
      return;
    }

    // Обработчик события из меню
    const handleMenuClick = (data: any) => {
      console.log('Data received from menu:', data);
      setReceivedData(data);

      // Добавляем запись в лог
      setLog(prev => [
        ...prev,
        `${new Date().toLocaleTimeString()}: Received: ${data.message}`
      ]);
    };

    // Подписываемся на события
    // DashboardPage.tsx, строка 30 (пример)
    if (electronAPI?.onMenuClick) {
      electronAPI.onMenuClick(handleMenuClick);
    }

    // Очистка подписки при размонтировании
    return () => {
      if (electronAPI?.removeMenuListener) {
        electronAPI.removeMenuListener();
      }
    };
  }, []); 
  return (
    <ButtonsWindows/>
  );
}