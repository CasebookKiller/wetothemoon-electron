// RoleSection.tsx
import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Chips } from 'primereact/chips';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { PromptTemplate } from '@/types/promptgenerator';
import { PackageJson } from '@/types/types';

interface RoleSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
}

const communicationStyles = [
  { label: 'Нейтральный', value: 'нейтральный' },
  { label: 'Формальный', value: 'формальный' },
  { label: 'Дружелюбный', value: 'дружелюбный' },
  { label: 'Технический', value: 'технический' },
];

export const RoleSection: React.FC<RoleSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles,
}) => {
  const role = template.role;
  const isEnabled = role.enabled;

  const handleUpdate = (field: string, value: any) => {
    onUpdate({
      role: {
        ...role,
        [field]: value,
      },
    });
  };

  // Извлечение данных из конфигов
  const getInfoFromConfigs = () => {
    let position = '';
    let specialization = '';
    const priorities: string[] = [...role.priorities];

    // 1. package.json
    if (packageJson) {
      const deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };
      const depNames = Object.keys(deps);

      if (depNames.includes('electron')) {
        position = 'Electron Developer';
        specialization = 'Electron';
      } else if (depNames.includes('react') || depNames.includes('next')) {
        position = 'Frontend Developer';
        specialization = 'React';
      }
      if (depNames.includes('typescript')) {
        specialization += ', TypeScript';
      } else if (depNames.includes('javascript')) {
        specialization += ', JavaScript';
      }
      if (depNames.includes('vite')) specialization += ', Vite';

      // Базовые приоритеты из зависимостей
      if (depNames.includes('electron')) addPriority(priorities, 'безопасность');
      if (depNames.includes('react')) addPriority(priorities, 'переиспользуемость');
    }

    // 2. tsconfig.json
    const tsconfig = configFiles?.['tsconfig.json'] as any;
    if (tsconfig?.compilerOptions) {
      const opts = tsconfig.compilerOptions;
      if (opts.jsx) {
        specialization = specialization.replace(', TypeScript', '');
        specialization += ', TypeScript (React/JSX)';
      }
      if (opts.strict) addPriority(priorities, 'строгая типизация');
      if (opts.target) {
        specialization += ` (target: ${opts.target})`;
      }
    }

    // 3. ESLint
    const eslint = configFiles?.['.eslintrc.json'] as any;
    if (eslint?.rules) {
      const errorRules = Object.entries(eslint.rules)
        .filter(([_, val]) => val === 'error' || val === 2 || (Array.isArray(val) && val[0] === 'error'))
        .map(([rule]) => rule);

      if (errorRules.includes('no-console')) addPriority(priorities, 'безопасность');
      if (errorRules.includes('no-eval')) addPriority(priorities, 'безопасность');
      if (errorRules.some(r => r.startsWith('@typescript-eslint'))) addPriority(priorities, 'чистота кода');
      if (errorRules.includes('prefer-const')) addPriority(priorities, 'неизменяемость');
    }

    // Очистка specialization от начальной запятой
    specialization = specialization.trim().replace(/^,\s*/, '');
    if (!position) position = 'Fullstack Developer';
    if (!specialization) specialization = 'Node.js, TypeScript';

    return { position, specialization, priorities };
  };

  const handleFillFromConfigs = () => {
    if (!packageJson && !configFiles) return;
    const { position, specialization, priorities } = getInfoFromConfigs();

    // Заполняем только пустые поля
    if (!role.position.trim() && position) {
      handleUpdate('position', position);
    }
    if (!role.specialization.trim() && specialization) {
      handleUpdate('specialization', specialization);
    }
    if (priorities.length !== role.priorities.length) {
      handleUpdate('priorities', priorities);
    }
  };

  const addPriority = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };

  const canFill =
    (packageJson || configFiles) &&
    (!role.position.trim() || !role.specialization.trim());

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-base">Роль ассистента</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isEnabled}
            options={[
              { label: 'Вкл.', value: true },
              { label: 'Выкл.', value: false },
            ]}
            onChange={(e) =>
              onUpdate({ role: { ...role, enabled: e.value } })
            }
            optionLabel="label"
            optionValue="value"
            className="w-full text-sm m-2"
          />
        </div>
      </div>

      {isEnabled && (
        <div className="p-fluid text-sm">
          <div className="p-field p-mb-4">
            <label htmlFor="position" className="p-mb-2">Позиция:</label>
            <InputText
              id="position"
              value={role.position}
              onChange={(e) => handleUpdate('position', e.target.value)}
              placeholder="Senior Frontend Developer"
              className="w-full text-sm"
            />
          </div>

          <div className="p-field p-mb-4">
            <label htmlFor="experience" className="p-mb-2">Опыт:</label>
            <InputText
              id="experience"
              value={role.experience}
              onChange={(e) => handleUpdate('experience', e.target.value)}
              placeholder="5+ лет"
              className="w-full text-sm"
            />
          </div>

          <div className="p-field p-mb-4">
            <label htmlFor="specialization" className="p-mb-2">Специализация:</label>
            <InputText
              id="specialization"
              value={role.specialization}
              onChange={(e) => handleUpdate('specialization', e.target.value)}
              placeholder="React, TypeScript, Electron"
              className="w-full text-sm"
            />
          </div>

          <div className="p-field p-mb-4">
            <label className="p-mb-2">Стиль общения:</label>
            <Dropdown
              value={role.communicationStyle}
              options={communicationStyles}
              onChange={(e) => handleUpdate('communicationStyle', e.value)}
              placeholder="Выберите стиль"
              className="w-full text-sm"
            />
          </div>

          <div className="p-field p-mb-4 mb-1">
            <label className="p-mb-2">Приоритеты:</label>
            <Chips
              value={role.priorities}
              onChange={(e) => handleUpdate('priorities', e.value || [])}
              placeholder="Добавьте приоритеты"
              className="w-full text-sm"
            />
          </div>

          <div className="p-mt-3">
            <Button
              label="Заполнить из конфигов"
              icon="pi pi-download"
              onClick={handleFillFromConfigs}
              disabled={!canFill}
              className="p-button-sm p-button-accent"
              tooltip="Определить роль, специализацию и приоритеты по package.json, tsconfig и ESLint"
              tooltipOptions={{ position: 'top' }}
            />
          </div>
        </div>
      )}
      <Divider />
    </section>
  );
};

/*import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { PromptTemplate } from '@/types/promptgenerator';
import 'primeflex/primeflex.css'; // Импорт стилей PrimeFlex
import { Divider } from 'primereact/divider';

interface RoleSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
}

export const RoleSection: React.FC<RoleSectionProps> = ({ template, onUpdate }) => {
  // Опции для SelectButton
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false }
  ];

  // Определяем, активна ли секция (если выключена — поля должны быть неактивны)
  const isSectionEnabled = template.role.enabled;

  return (
    <section className="p-mb-6">
      {
        // Заголовок и SelectButton в одной строке
      }
      <div className="flex align-items-center justify-content-between mb-4 mt-4">
        <h3 className="font-medium text-lg">Роль</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={template.role.enabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                role: {
                  ...template.role,
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

      {
        // Контент секции — показываем только если enabled=true
      }
      {isSectionEnabled && (
        <div>
          {
            // Группа полей: Позиция, Опыт, Специализация 
          }
          <div className="p-fluid text-sm">
            <div className="p-field p-mb-4">
              <label htmlFor="position" className="p-mb-2 font-medium">Позиция:</label>
              <InputText
                id="position"
                value={template.role.position}
                onChange={(e) =>
                  onUpdate({
                    role: { ...template.role, position: e.target.value }
                  })
                }
                className="p-inputtext w-full text-sm"
              />
            </div>

            <div className="p-field p-mb-4">
              <label htmlFor="experience" className="p-mb-2 font-medium">Опыт:</label>
              <InputText
                id="experience"
                value={template.role.experience}
                onChange={(e) =>
                  onUpdate({
                    role: { ...template.role, experience: e.target.value }
                  })
                }
                className="p-inputtext w-full text-sm"
              />
            </div>

            <div className="p-field p-mb-4">
              <label htmlFor="specialization" className="p-mb-2 font-medium">Специализация:</label>
              <InputText
                id="specialization"
                value={template.role.specialization}
                onChange={(e) =>
                  onUpdate({
                    role: { ...template.role, specialization: e.target.value }
                  })
                }
                className="p-inputtext w-full text-sm"
              />
            </div>
          </div>

          {
            // Поле «Стиль общения»
          }
          <div className="p-field p-mb-4 text-sm">
            <label htmlFor="communicationStyle" className="p-mb-2 font-medium">Стиль общения:</label>
            <InputText
              id="communicationStyle"
              value={template.role.communicationStyle}
              onChange={(e) =>
                onUpdate({
                  role: { ...template.role, communicationStyle: e.target.value }
                })
              }
              className="p-inputtext w-full text-sm"
            />
          </div>

          {
            // Секция «Приоритеты»
          }
          <div className="p-field text-sm">
            <label className="p-mb-3 font-medium">Приоритеты:</label>

            {
              // Список приоритетов с кнопками удаления
            }
            <div className="flex flex-column gap-2">
              {template.role.priorities.map((priority, index) => (
                <div key={index} className="flex align-items-center gap-2">
                  <InputText
                    value={priority}
                    onChange={(e) => {
                      const updatedPriorities = [...template.role.priorities];
                      updatedPriorities[index] = e.target.value;
                      onUpdate({
                        role: {
                          ...template.role,
                          priorities: updatedPriorities
                        }
                      });
                    }}
                    className="p-inputtext w-full text-sm"
                  />
                  <Button
                    icon="pi pi-times"
                    onClick={() => {
                      const updatedPriorities = template.role.priorities.filter((_, i) => i !== index);
                      onUpdate({
                        role: {
                          ...template.role,
                          priorities: updatedPriorities
                        }
                      });
                    }}
                    className="p-button-accent p-button-xs p-1 w-1"
                    style={{ maxWidth: '46px' }}
                    aria-label="Удалить приоритет"
                  />
                </div>
              ))}
            </div>

            {
              // Кнопка «Добавить приоритет» под списком
            }
            <Button
              label="Добавить приоритет"
              icon="pi pi-plus"
              onClick={() => {
                const updatedPriorities = [...template.role.priorities, ''];
                onUpdate({
                  role: {
                    ...template.role,
                    priorities: updatedPriorities
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3 mx-1"
            />
          </div>
        </div>
      )}
      <Divider />
    </section>
  );
};
*/