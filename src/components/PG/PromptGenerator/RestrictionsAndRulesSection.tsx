import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import { PromptTemplate } from '@/types/promptgenerator';
import { PackageJson } from '@/types/types';

interface RestrictionsAndRulesSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
}

export const RestrictionsAndRulesSection: React.FC<RestrictionsAndRulesSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles,
}) => {
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false },
  ];

  const isSectionEnabled = template.restrictionsAndRules?.enabled ?? true;
  const rr = template.restrictionsAndRules;

  const updateArray = (field: string, newArray: string[]) => {
    onUpdate({
      restrictionsAndRules: {
        ...rr,
        [field]: newArray,
      },
    });
  };

  const handleFillFromConfigs = () => {
    if (!packageJson && !configFiles) return;

    // 1. Запрещённые практики из ESLint
    const eslint = configFiles?.['.eslintrc.json'] as any;
    if (eslint?.rules) {
      const errorRules = Object.entries(eslint.rules)
        .filter(([_, val]) => {
          if (val === 'error' || val === 2) return true;
          if (Array.isArray(val) && (val[0] === 'error' || val[0] === 2)) return true;
          return false;
        })
        .map(([rule]) => rule);

      const existing = new Set(rr.forbiddenPractices);
      const toAdd = errorRules.filter((r) => !existing.has(r));
      if (toAdd.length > 0) {
        updateArray('forbiddenPractices', [...rr.forbiddenPractices, ...toAdd]);
      }
    }

    // 2. Политика зависимостей
    if (!rr.dependenciesPolicy.trim() && packageJson) {
      let policy = '';
      if (
        packageJson.engines &&
        typeof packageJson.engines === 'object' &&
        (packageJson.engines as Record<string, string>).node
      ) {
        policy = `Требуется Node.js ${(packageJson.engines as Record<string, string>).node}`;
      } else if (
        packageJson.peerDependencies &&
        Object.keys(packageJson.peerDependencies).length > 0
      ) {
        policy = 'Следуйте указанным peerDependencies для совместимости';
      }
      if (policy) {
        onUpdate({
          restrictionsAndRules: {
            ...rr,
            dependenciesPolicy: policy,
          },
        });
      }
    }

    // 3. Соответствие стандартам (лицензия)
    if (packageJson?.license && typeof packageJson.license === 'string') {
      const license = packageJson.license;
      if (!rr.compliance.includes(license)) {
        updateArray('compliance', [...rr.compliance, license]);
      }
    }

    // 4. Учёт окружения (из .env)
    const envContent = configFiles?.['.env'] as string | undefined;
    if (envContent) {
      const lines = envContent.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      const envVars = lines.map((l) => l.split('=')[0].trim()).filter(Boolean);
      const existingEnv = new Set(rr.environmentConsiderations);
      const toAdd = envVars.filter((v) => !existingEnv.has(v));
      if (toAdd.length > 0) {
        updateArray('environmentConsiderations', [...rr.environmentConsiderations, ...toAdd]);
      }
    }
  };

  const canFill = !!(packageJson || configFiles);

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Ограничения и правила</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({ restrictionsAndRules: { ...rr, enabled: e.value } })
            }
            optionLabel="label"
            optionValue="value"
            className="w-full text-sm m-2"
          />
        </div>
      </div>

      {isSectionEnabled && (
        <div>
          {/* Запрещённые практики */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Запрещённые практики:</label>
            {rr.forbiddenPractices.map((practice, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={practice}
                  onChange={(e) => {
                    const updated = [...rr.forbiddenPractices];
                    updated[index] = e.target.value;
                    updateArray('forbiddenPractices', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = rr.forbiddenPractices.filter((_, i) => i !== index);
                    updateArray('forbiddenPractices', updated);
                  }}
                  aria-label="Удалить запрещённую практику"
                />
              </div>
            ))}
            <Button
              label="Добавить практику"
              icon="pi pi-plus"
              onClick={() => updateArray('forbiddenPractices', [...rr.forbiddenPractices, ''])}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Политика зависимостей */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Политика зависимостей:</label>
            <InputText
              value={rr.dependenciesPolicy}
              onChange={(e) =>
                onUpdate({ restrictionsAndRules: { ...rr, dependenciesPolicy: e.target.value } })
              }
              className="w-full text-sm"
            />
          </div>

          {/* Соответствие стандартам */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Соответствие стандартам:</label>
            {rr.compliance.map((comp, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={comp}
                  onChange={(e) => {
                    const updated = [...rr.compliance];
                    updated[index] = e.target.value;
                    updateArray('compliance', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = rr.compliance.filter((_, i) => i !== index);
                    updateArray('compliance', updated);
                  }}
                  aria-label="Удалить стандарт соответствия"
                />
              </div>
            ))}
            <Button
              label="Добавить стандарт"
              icon="pi pi-plus"
              onClick={() => updateArray('compliance', [...rr.compliance, ''])}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Учёт окружения */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Учёт окружения:</label>
            {rr.environmentConsiderations.map((env, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={env}
                  onChange={(e) => {
                    const updated = [...rr.environmentConsiderations];
                    updated[index] = e.target.value;
                    updateArray('environmentConsiderations', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = rr.environmentConsiderations.filter((_, i) => i !== index);
                    updateArray('environmentConsiderations', updated);
                  }}
                  aria-label="Удалить условие окружения"
                />
              </div>
            ))}
            <Button
              label="Добавить условие"
              icon="pi pi-plus"
              onClick={() =>
                updateArray('environmentConsiderations', [...rr.environmentConsiderations, ''])
              }
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
              tooltip="Извлечь запрещённые практики из ESLint, политику из package.json, стандарты и окружение из .env"
              tooltipOptions={{ position: "top" }}
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
import { Divider } from 'primereact/divider';

interface RestrictionsAndRulesSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
}

export const RestrictionsAndRulesSection: React.FC<RestrictionsAndRulesSectionProps> = ({ template, onUpdate }) => {
  // Опции для SelectButton
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false }
  ];

  // Определяем, активна ли секция (по умолчанию — включена)
  const isSectionEnabled = template.restrictionsAndRules?.enabled ?? true;

  return (
    <section className="p-mb-6">
      {
        // Заголовок и SelectButton в одной строке
      }
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Ограничения и правила</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                restrictionsAndRules: {
                  ...template.restrictionsAndRules,
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
            // Запрещённые практики
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Запрещённые практики:</label>
            {template.restrictionsAndRules.forbiddenPractices.map((practice, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={practice}
                  onChange={(e) => {
                    const updatedPractices = [...template.restrictionsAndRules.forbiddenPractices];
                    updatedPractices[index] = e.target.value;
                    onUpdate({
                      restrictionsAndRules: {
                        ...template.restrictionsAndRules,
                        forbiddenPractices: updatedPractices
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
                    const updatedPractices = template.restrictionsAndRules.forbiddenPractices.filter((_, i) => i !== index);
                    onUpdate({
                      restrictionsAndRules: {
                        ...template.restrictionsAndRules,
                        forbiddenPractices: updatedPractices
                      }
                    });
                  }}
                  aria-label="Удалить запрещённую практику"
                />
              </div>
            ))}
            <Button
              label="Добавить практику"
              icon="pi pi-plus"
              onClick={() => {
                const updatedPractices = [...template.restrictionsAndRules.forbiddenPractices, ''];
                onUpdate({
                  restrictionsAndRules: {
                    ...template.restrictionsAndRules,
                    forbiddenPractices: updatedPractices
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {
            // Политика зависимостей
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Политика зависимостей:</label>
            <InputText
              value={template.restrictionsAndRules.dependenciesPolicy}
              onChange={(e) =>
                onUpdate({
                  restrictionsAndRules: {
                    ...template.restrictionsAndRules,
                    dependenciesPolicy: e.target.value
                  }
                })
              }
              className="w-full text-sm"
            />
          </div>

          {
            // Соответствие стандартам
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Соответствие стандартам:</label>
            {template.restrictionsAndRules.compliance.map((comp, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={comp}
                  onChange={(e) => {
                    const updatedCompliance = [...template.restrictionsAndRules.compliance];
                    updatedCompliance[index] = e.target.value;
                    onUpdate({
                      restrictionsAndRules: {
                        ...template.restrictionsAndRules,
                        compliance: updatedCompliance
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
                    const updatedCompliance = template.restrictionsAndRules.compliance.filter((_, i) => i !== index);
                    onUpdate({
                      restrictionsAndRules: {
                        ...template.restrictionsAndRules,
                        compliance: updatedCompliance
                      }
                    });
                  }}
                  aria-label="Удалить стандарт соответствия"
                />
              </div>
            ))}
            <Button
              label="Добавить стандарт"
              icon="pi pi-plus"
              onClick={() => {
                const updatedCompliance = [...template.restrictionsAndRules.compliance, ''];
                onUpdate({
                  restrictionsAndRules: {
                    ...template.restrictionsAndRules,
                    compliance: updatedCompliance
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {
            // Учёт окружения
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Учёт окружения:</label>
            {template.restrictionsAndRules.environmentConsiderations.map((env, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={env}
                  onChange={(e) => {
                    const updatedEnvironment = [...template.restrictionsAndRules.environmentConsiderations];
                    updatedEnvironment[index] = e.target.value;
                    onUpdate({
                      restrictionsAndRules: {
                        ...template.restrictionsAndRules,
                        environmentConsiderations: updatedEnvironment
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
                    const updatedEnvironment = template.restrictionsAndRules.environmentConsiderations.filter((_, i) => i !== index);
                    onUpdate({
                      restrictionsAndRules: {
                        ...template.restrictionsAndRules,
                        environmentConsiderations: updatedEnvironment
                      }
                    });
                  }}
                  aria-label="Удалить условие окружения"
                />
              </div>
            ))}
            <Button
              label="Добавить условие"
              icon="pi pi-plus"
              onClick={() => {
                const updatedEnvironment = [...template.restrictionsAndRules.environmentConsiderations, ''];
                onUpdate({
                  restrictionsAndRules: {
                    ...template.restrictionsAndRules,
                    environmentConsiderations: updatedEnvironment
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