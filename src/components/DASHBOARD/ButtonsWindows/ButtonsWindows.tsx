import React from 'react';
import { Button } from 'primereact/button';

type ButtonConfig = {
  label: string;
  icon: string;
  action?: () => void;
  disabled?: boolean;
};

export const ButtonsWindows = () => {
  const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

  // Безопасный вызов методов electronAPI
  const call = (method: string) => () => {
    if (!electronAPI?.[method]) {
      console.warn(`electronAPI.${method} is not available`);
      return;
    }
    electronAPI[method]();
  };

  const buttons: ButtonConfig[] = [
    { label: 'Нейро', icon: 'pi pi-prime', action: call('openAIWindow') },
    { label: 'Облигации', icon: 'pi pi-chart-line', action: call('openBondsWindow') },
    { label: 'Markdown', icon: 'pi pi-code', action: call('openMDWindow') },
    { label: 'Генератор запросов', icon: 'pi pi-receipt', action: call('openPGWindow') },
    { label: 'Ollama', icon: 'pi pi-microchip', action: call('openOllamaWindow') },
    { label: 'План полёта', icon: 'pi pi-list', action: call('openTasksWindow') },
    { label: 'Трейдер', icon: 'pi pi-chart-bar', action: call('openTradingAssistantWindow') },
    { label: 'Взгляд Фримена', icon: 'pi pi-eye', action: call('openOsintWindow') },
    // Новая кнопка «Шлюз»
    { label: 'Шлюз', icon: 'pi pi-server', action: call('openGatewayWindow') },

    // Заглушки
    { label: 'Сталкер', icon: 'pi pi-compass', disabled: true },
    { label: 'Местная база', icon: 'pi pi-database', disabled: true },
    { label: 'Внеземная база', icon: 'pi pi-cloud', disabled: true },
  ];

  return (
    <div className="p-fluid">
      <div className="flex justify-content-center align-items-center min-h-screen">
        <div className="surface-card p-4 shadow-2 border-round w-full lg:w-6">
          <div className="text-center mb-5">
            <div className="text-900 text-3xl font-bold mb-3">Центр Управления Полётами</div>
            <span className="text-600">Выберите направление работы</span>
          </div>

          <div className="grid">
            {buttons.map((btn) => (
              <div key={btn.label} className="col-12 md:col-6 p-2">
                <Button
                  label={btn.label}
                  icon={btn.icon}
                  className="p-button-lg w-full p-button-raised p-button-accent"
                  onClick={btn.action}
                  disabled={btn.disabled}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};