import React from 'react';
import { InputTextarea as Textarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { PromptTemplate } from '@/shared/types/promptgenerator';
import { Divider } from 'primereact/divider';
import { PackageJson } from '@/shared/types/types';

interface TaskAndExpectationsSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
}

export const TaskAndExpectationsSection: React.FC<TaskAndExpectationsSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles
}) => {
  // Опции для SelectButton
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false }
  ];

  // Определяем, активна ли секция (по умолчанию — включена)
  const isSectionEnabled = template.taskAndExpectations?.enabled ?? true;

  return (
    <section className="p-mb-6">
      {/* Заголовок и SelectButton в одной строке */}
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Задачи и ожидания</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                taskAndExpectations: {
                  ...template.taskAndExpectations,
                  enabled: e.value
                }
              })
            }
            optionLabel="label"
            optionValue="value"
            className="w-full text-sm m-2"
          />
        </div>
      </div>

      {/* Контент секции — показываем только если enabled=true */}
      {isSectionEnabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {/* Основная задача */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Основная задача:</label>
            <Textarea
              value={template.taskAndExpectations.mainTask}
              onChange={(e) =>
                onUpdate({
                  taskAndExpectations: {
                    ...template.taskAndExpectations,
                    mainTask: e.target.value
                  }
                })
              }
              rows={3}
              className="w-full text-sm"
            />
          </div>

          {/* Ожидаемый результат */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Ожидаемый результат:</label>
            <Textarea
              value={template.taskAndExpectations.expectedResult}
              onChange={(e) =>
                onUpdate({
                  taskAndExpectations: {
                    ...template.taskAndExpectations,
                    expectedResult: e.target.value
                  }
                })
              }
              rows={3}
              className="w-full text-sm"
            />
          </div>

          {/* Требования к коду */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Требования к коду:</label>
            {template.taskAndExpectations.codeRequirements.map((req, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={req}
                  onChange={(e) => {
                    const updatedRequirements = [...template.taskAndExpectations.codeRequirements];
                    updatedRequirements[index] = e.target.value;
                    onUpdate({
                      taskAndExpectations: {
                        ...template.taskAndExpectations,
                        codeRequirements: updatedRequirements
                      }
                    });
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updatedRequirements = template.taskAndExpectations.codeRequirements.filter((_, i) => i !== index);
                    onUpdate({
                      taskAndExpectations: {
                        ...template.taskAndExpectations,
                        codeRequirements: updatedRequirements
                      }
                    });
                  }}
                  aria-label="Удалить требование"
                />
              </div>
            ))}
            <Button
              label="Добавить требование"
              icon="pi pi-plus"
              onClick={() => {
                const updatedRequirements = [...template.taskAndExpectations.codeRequirements, ''];
                onUpdate({
                  taskAndExpectations: {
                    ...template.taskAndExpectations,
                    codeRequirements: updatedRequirements
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Формат вывода */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Формат вывода:</label>
            <InputText
              value={template.taskAndExpectations.outputFormat}
              onChange={(e) =>
                onUpdate({
                  taskAndExpectations: {
                    ...template.taskAndExpectations,
                    outputFormat: e.target.value
                  }
                })
              }
              className="w-full text-sm"
            />
          </div>
        </div>
      )}
      <Divider />
    </section>
  );
};
