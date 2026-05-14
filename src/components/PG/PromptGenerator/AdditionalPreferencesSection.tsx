// AdditionalPreferencesSection.tsx
import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import { PromptTemplate, ResponseLength } from '@/types/promptgenerator';
import { PackageJson } from '@/types/types';

interface AdditionalPreferencesSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
}

export const AdditionalPreferencesSection: React.FC<AdditionalPreferencesSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles,
}) => {
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false },
  ];

  const isSectionEnabled = template.additionalPreferences?.enabled ?? true;
  const prefs = template.additionalPreferences;

  const updateArray = (field: string, newArray: string[]) => {
    onUpdate({ additionalPreferences: { ...prefs, [field]: newArray } });
  };

  const handleFillFromConfigs = () => {
    if (!configFiles && !packageJson) return;

    // 1. Тон общения
    if (!prefs.tone.trim()) {
      const eslint = configFiles?.['.eslintrc.json'] as any;
      if (eslint?.rules?.strict === 'error') {
        onUpdate({ additionalPreferences: { ...prefs, tone: 'профессиональный, строгий' } });
      } else if (packageJson?.dependencies?.electron) {
        onUpdate({ additionalPreferences: { ...prefs, tone: 'профессиональный, технический' } });
      } else {
        onUpdate({ additionalPreferences: { ...prefs, tone: 'профессиональный' } });
      }
    }

    // 2. Предпочтительные паттерны
    const patterns = [...prefs.preferredPatterns];

    // Алиасы путей
    const viteConfig = configFiles?.['vite.config.ts'] as string | undefined;
    const tsconfig = configFiles?.['tsconfig.json'] as any;
    if (viteConfig && viteConfig.includes('@/') && !patterns.some(p => p.startsWith('использовать алиас @'))) {
      patterns.push('использовать алиасы путей (например, @/components)');
    }
    if (tsconfig?.compilerOptions?.paths && !patterns.some(p => p.startsWith('использовать paths из tsconfig'))) {
      patterns.push('использовать paths из tsconfig для чистых импортов');
    }

    // Группировка импортов (ESLint)
    const eslint = configFiles?.['.eslintrc.json'] as any;
    if (eslint?.rules?.['import/order'] && !patterns.some(p => p.includes('группировка импортов'))) {
      patterns.push('группировка импортов (node_modules, внутренние, стили)');
    }

    // Async/await
    if ((packageJson?.dependencies?.typescript || packageJson?.devDependencies?.typescript) &&
      !patterns.some(p => p.includes('async/await'))) {
      patterns.push('использовать async/await вместо промисов');
    }

    updateArray('preferredPatterns', patterns);

    // 3. Особые акценты
    const emphases = [...prefs.specialEmphases];

    if (tsconfig?.compilerOptions?.strict && !emphases.includes('строгая типизация (strict)')) {
      emphases.push('строгая типизация (strict)');
    }

    const allDeps = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };
    if (allDeps.electron) {
      const electronSecurity = 'безопасность Electron (contextIsolation, nodeIntegration: false)';
      if (!emphases.includes(electronSecurity)) emphases.push(electronSecurity);
    }

    updateArray('specialEmphases', emphases);
  };

  const canFill = !!(packageJson || configFiles);

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Дополнительные предпочтения</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                additionalPreferences: { ...prefs, enabled: e.value },
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
          {/* Тон общения */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Тон общения:</label>
            <InputText
              value={prefs.tone}
              onChange={(e) =>
                onUpdate({ additionalPreferences: { ...prefs, tone: e.target.value } })
              }
              className="w-full text-sm"
            />
          </div>

          {/* Длина ответа */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Длина ответа:</label>
            <Dropdown
              value={prefs.length}
              options={[
                { label: 'Краткая', value: ResponseLength.Concise },
                { label: 'Подробная', value: ResponseLength.Detailed },
              ]}
              onChange={(e) =>
                onUpdate({ additionalPreferences: { ...prefs, length: e.value } })
              }
              className="w-full text-sm"
            />
          </div>

          {/* Предпочтительные паттерны */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Предпочтительные паттерны:</label>
            {prefs.preferredPatterns.map((pattern, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={pattern}
                  onChange={(e) => {
                    const updated = [...prefs.preferredPatterns];
                    updated[index] = e.target.value;
                    updateArray('preferredPatterns', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = prefs.preferredPatterns.filter((_, i) => i !== index);
                    updateArray('preferredPatterns', updated);
                  }}
                  aria-label="Удалить предпочтительный паттерн"
                />
              </div>
            ))}
            <Button
              label="Добавить паттерн"
              icon="pi pi-plus"
              onClick={() => updateArray('preferredPatterns', [...prefs.preferredPatterns, ''])}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Особые акценты */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Особые акценты:</label>
            {prefs.specialEmphases.map((emphasis, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={emphasis}
                  onChange={(e) => {
                    const updated = [...prefs.specialEmphases];
                    updated[index] = e.target.value;
                    updateArray('specialEmphases', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = prefs.specialEmphases.filter((_, i) => i !== index);
                    updateArray('specialEmphases', updated);
                  }}
                  aria-label="Удалить особый акцент"
                />
              </div>
            ))}
            <Button
              label="Добавить акцент"
              icon="pi pi-plus"
              onClick={() => updateArray('specialEmphases', [...prefs.specialEmphases, ''])}
              className="p-button-accent p-button-sm mt-3"
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
              tooltip="Автоматически определить тон, паттерны и акценты на основе конфигураций"
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
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { PromptTemplate, ResponseLength } from '@/types/promptgenerator';
import { Divider } from 'primereact/divider';

interface AdditionalPreferencesSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
}

export const AdditionalPreferencesSection: React.FC<AdditionalPreferencesSectionProps> = ({ template, onUpdate }) => {
  // Опции для SelectButton
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false }
  ];

  // Определяем, активна ли секция (по умолчанию — включена)
  const isSectionEnabled = template.additionalPreferences?.enabled ?? true;

  return (
    <section className="p-mb-6">
      {
        // Заголовок и SelectButton в одной строке
      }
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Дополнительные предпочтения</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                additionalPreferences: {
                  ...template.additionalPreferences,
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
            // Тон общения
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Тон общения:</label>
            <InputText
              value={template.additionalPreferences.tone}
              onChange={(e) =>
                onUpdate({
                  additionalPreferences: {
                    ...template.additionalPreferences,
                    tone: e.target.value
                  }
                })
              }
              className="w-full text-sm"
            />
          </div>

          {
            // Длина ответа
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Длина ответа:</label>
            <Dropdown
              value={template.additionalPreferences.length}
              options={[
                { label: 'Краткая', value: ResponseLength.Concise },
                { label: 'Подробная', value: ResponseLength.Detailed }
              ]}
              onChange={(e) =>
                onUpdate({
                  additionalPreferences: {
                    ...template.additionalPreferences,
                    length: e.value
                  }
                })
              }
              className="w-full text-sm"
            />
          </div>

          {
            // Предпочтительные паттерны
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Предпочтительные паттерны:</label>
            {template.additionalPreferences.preferredPatterns.map((pattern, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={pattern}
                  onChange={(e) => {
                    const updatedPatterns = [...template.additionalPreferences.preferredPatterns];
                    updatedPatterns[index] = e.target.value;
                    onUpdate({
                      additionalPreferences: {
                        ...template.additionalPreferences,
                        preferredPatterns: updatedPatterns
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
                    const updatedPatterns = template.additionalPreferences.preferredPatterns.filter((_, i) => i !== index);
                    onUpdate({
                      additionalPreferences: {
                        ...template.additionalPreferences,
                        preferredPatterns: updatedPatterns
                      }
                    });
                  }}
                  aria-label="Удалить предпочтительный паттерн"
                />
              </div>
            ))}
            <Button
              label="Добавить паттерн"
              icon="pi pi-plus"
              onClick={() => {
                const updatedPatterns = [...template.additionalPreferences.preferredPatterns, ''];
                onUpdate({
                  additionalPreferences: {
                    ...template.additionalPreferences,
                    preferredPatterns: updatedPatterns
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {
            // Особые акценты
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Особые акценты:</label>
            {template.additionalPreferences.specialEmphases.map((emphasis, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={emphasis}
                  onChange={(e) => {
                    const updatedEmphases = [...template.additionalPreferences.specialEmphases];
                    updatedEmphases[index] = e.target.value;
                    onUpdate({
                      additionalPreferences: {
                        ...template.additionalPreferences,
                        specialEmphases: updatedEmphases
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
                    const updatedEmphases = template.additionalPreferences.specialEmphases.filter((_, i) => i !== index);
                    onUpdate({
                      additionalPreferences: {
                        ...template.additionalPreferences,
                        specialEmphases: updatedEmphases
                      }
                    });
                  }}
                  aria-label="Удалить особый акцент"
                />
              </div>
            ))}
            <Button
              label="Добавить акцент"
              icon="pi pi-plus"
              onClick={() => {
                const updatedEmphases = [...template.additionalPreferences.specialEmphases, ''];
                onUpdate({
                  additionalPreferences: {
                    ...template.additionalPreferences,
                    specialEmphases: updatedEmphases
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>
        </div>
      )}
      <Divider />
    </section>
  );
};
*/