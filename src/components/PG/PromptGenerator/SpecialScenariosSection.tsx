import React from 'react';
import { InputTextarea as Textarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import { PromptTemplate } from '@/shared/types/promptgenerator';
import { PackageJson } from '@/shared/types/types';

interface SpecialScenariosSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
}

export const SpecialScenariosSection: React.FC<SpecialScenariosSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles,
}) => {
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false },
  ];

  const isSectionEnabled = template.specialScenarios?.enabled ?? true;
  const scenarios = template.specialScenarios;

  const handleUpdate = (field: string, value: string) => {
    onUpdate({
      specialScenarios: {
        ...scenarios,
        [field]: value,
      },
    });
  };

  const handleFillFromConfigs = () => {
    if (!packageJson && !configFiles) return;
    const deps = {
      ...(packageJson?.dependencies || {}),
      ...(packageJson?.devDependencies || {}),
    };

    const suggestions: Partial<typeof scenarios> = {};

    // 1. Обработка ошибок
    if (!scenarios.errorHandling.trim() && deps.electron) {
      suggestions.errorHandling = 'Использовать try/catch в IPC-обработчиках, централизованную обработку ошибок через ipcMain.';
    } else if (!scenarios.errorHandling.trim() && deps.express) {
      suggestions.errorHandling = 'Глобальный middleware для обработки ошибок в Express.';
    }

    // 2. Тестирование
    if (!scenarios.testing.trim()) {
      const testingTools: string[] = [];
      if (deps.vitest) testingTools.push('Vitest');
      if (deps.jest) testingTools.push('Jest');
      if (deps['@playwright/test']) testingTools.push('Playwright');
      if (testingTools.length > 0) {
        suggestions.testing = `Использовать ${testingTools.join(', ')} для модульного и интеграционного тестирования.`;
      }
    }

    // 3. Масштабируемость
    if (!scenarios.scalability.trim()) {
      const scalabilityItems: string[] = [];
      if (deps.pino) scalabilityItems.push('структурированное логирование (pino)');
      if (deps['lru-cache']) scalabilityItems.push('кэширование (lru-cache)');
      if (deps.redis) scalabilityItems.push('Redis для кэширования и очередей');
      if (scalabilityItems.length > 0) {
        suggestions.scalability = `Обеспечить масштабируемость через ${scalabilityItems.join(', ')}.`;
      }
    }

    // Альтернативные подходы оставляем пустым (пользователь заполнит сам)

    if (Object.keys(suggestions).length > 0) {
      onUpdate({
        specialScenarios: {
          ...scenarios,
          ...suggestions,
        },
      });
    }
  };

  const canFill = !!packageJson || !!configFiles;

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Специальные сценарии</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                specialScenarios: {
                  ...scenarios,
                  enabled: e.value,
                },
              })
            }
            optionLabel="label"
            optionValue="value"
            className="w-full text-sm m-2"
          />
        </div>
      </div>

      {isSectionEnabled && (
        <div>
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Обработка ошибок:</label>
            <Textarea
              value={scenarios.errorHandling}
              onChange={(e) => handleUpdate('errorHandling', e.target.value)}
              rows={3}
              className="w-full text-sm"
            />
          </div>

          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Тестирование:</label>
            <Textarea
              value={scenarios.testing}
              onChange={(e) => handleUpdate('testing', e.target.value)}
              rows={3}
              className="w-full text-sm"
            />
          </div>

          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Масштабируемость:</label>
            <Textarea
              value={scenarios.scalability}
              onChange={(e) => handleUpdate('scalability', e.target.value)}
              rows={3}
              className="w-full text-sm"
            />
          </div>

          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Альтернативные подходы:</label>
            <Textarea
              value={scenarios.alternativeApproaches}
              onChange={(e) => handleUpdate('alternativeApproaches', e.target.value)}
              rows={3}
              className="w-full text-sm"
            />
          </div>

        </div>
      )}
      {isSectionEnabled && (
        <div className="p-fluid text-sm">          
          <div className="p-mt-3">
            <Button
              label="Заполнить из конфигов"
              icon="pi pi-download"
              onClick={handleFillFromConfigs}
              disabled={!canFill}
              className="p-button-sm p-button-accent"
              tooltip="Предложить типовые сценарии на основе зависимостей проекта"
              tooltipOptions={{ position: "top" }}
            />
          </div>

        </div>
      )}

      <Divider />
    </section>
  );
};