// src/components/DASHBOARD/ButtonsWindows/ButtonsWindows.tsx

import React from 'react';
import { Button } from 'primereact/button';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';

type ButtonConfig = {
  label: string;
  /** Имя иконки в Material Symbols */
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

  const callPb = (method: string) => () => {
    if (!electronAPI?.pb?.[method]) {
      console.warn(`electronAPI.pb.${method} is not available`);
      return;
    }
    electronAPI.pb[method]();
  };

  // Маппинг модулей на Material Symbols
  const buttons: ButtonConfig[] = [
    { label: 'Нейро', icon: 'psychology', action: call('openAIWindow') },
    { label: 'Облигации', icon: 'show_chart', action: call('openBondsWindow') },
    { label: 'Markdown', icon: 'code', action: call('openMDWindow') },
    { label: 'Генератор запросов', icon: 'edit_document', action: call('openPGWindow') },
    { label: 'Ollama', icon: 'developer_board', action: call('openOllamaWindow') },
    { label: 'План полёта', icon: 'checklist', action: call('openTasksWindow') },
    { label: 'Трейдер', icon: 'candlestick_chart', action: call('openTradingAssistantWindow') },
    { label: 'Взгляд Фримена', icon: 'visibility', action: call('openOsintWindow') },
    { label: 'Ситч', icon: 'inventory_2', action: call('openDatabaseWindow') },
    // Новая кнопка «Шлюз»
    { label: 'Шлюз', icon: 'router', action: call('openGatewayWindow') },
    { label: 'Прана-Бинду', icon: 'monitor_heart', action: callPb('openWindow') },

    // Заглушки
    { label: 'Сталкер', icon: 'explore', disabled: true },
    { label: 'Местная база', icon: 'database', disabled: true },
    { label: 'Внеземная база', icon: 'cloud', disabled: true },
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
                  className="p-button-lg w-full p-button-raised p-button-accent"
                  style={{
                    position: 'relative',
                    paddingLeft: '2.5rem',   // ← симметрично, чтобы текст остался по центру
                    paddingRight: '2.5rem',
                  }}
                  onClick={btn.action}
                  disabled={btn.disabled}
                >
                  {/* Иконка — абсолютно, прижата к левому краю */}
                  <span
                    style={{
                      position: 'absolute',
                      left: '0.75rem',        // ← вот эту цифру крутим, чтобы двигать иконку
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <AppIcon name={btn.icon} set="material" />
                  </span>

                  {/* Текст — центрирован по всей ширине (минус симметричные padding'и) */}
                  <span style={{ display: 'block', width: '100%', textAlign: 'center' }}>
                    {btn.label}
                  </span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};