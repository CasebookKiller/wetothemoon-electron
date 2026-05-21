import React from 'react';
import { Button } from 'primereact/button';

export const ButtonsWindows = () => {
  const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
  const openAIWindow = () => {
    electronAPI.openAIWindow();
  };

  const openBondsWindow = () => {
    electronAPI.openBondsWindow();
  };

  const openMDWindow = () => {
    electronAPI.openMDWindow();
  };

  const openPGWindow = () => {
    electronAPI.openPGWindow();
  };

  const openOllamaWindow = () => {
    electronAPI.openOllamaWindow();
  };

  const openTasksWindow = () => {
    electronAPI.openTasksWindow();
  };

  return (
    <div className="p-fluid">
      <div className="flex justify-content-center align-items-center min-h-screen">
        <div className="surface-card p-4 shadow-2 border-round w-full lg:w-6">
          <div className="text-center mb-5">
            <div className="text-900 text-3xl font-bold mb-3">Центр Управления Полётами</div>
            <span className="text-600">Выберите направление работы</span>
          </div>
          <div className="grid">
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Нейро"
                icon="pi pi-prime"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={openAIWindow}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Облигации"
                icon="pi pi-chart-line"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={openBondsWindow}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Markdown"
                icon="pi pi-code"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={openMDWindow}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Генератор запросов"
                icon="pi pi-receipt"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={openPGWindow}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Ollama"
                icon="pi pi-microchip"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={openOllamaWindow}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="План полёта"
                icon="pi pi-list"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={openTasksWindow}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Сталкер"
                icon="pi pi-compass"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={()=>{return null}}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Местная база"
                icon="pi pi-database"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={()=>{return null}}
                disabled={true}
              />
            </div>
            <div className="col-12 md:col-4 w-full">
              <Button
                label="Внеземная база"
                icon="pi pi-cloud"
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={()=>{return null}}
                disabled={true}
              />
            </div>
          </div>
        </div>
          
      </div>
    </div>
  );
};
