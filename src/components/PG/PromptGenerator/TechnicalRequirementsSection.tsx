// TechnicalRequirementsSection.tsx
import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import { PromptTemplate } from '@/types/promptgenerator';
import { PackageJson } from '@/types/types';

interface TechnicalRequirementsSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
}

export const TechnicalRequirementsSection: React.FC<TechnicalRequirementsSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles,
}) => {
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false },
  ];

  const isSectionEnabled = template.technicalRequirements?.enabled ?? true;
  const tech = template.technicalRequirements;

  const updateArray = (field: string, value: string[]) => {
    onUpdate({
      technicalRequirements: {
        ...tech,
        [field]: value,
      },
    });
  };

  const handleFillFromConfigs = () => {
    if (!configFiles && !packageJson) return;

    console.log('configFiles: ', configFiles);
    console.log('packageJson: ', packageJson);

    const newCompatibility = [...tech.compatibility];
    const newSecurity = [...tech.security];
    const newPerformance = [...tech.performance];
    const newDataHandling = [...tech.dataHandling];

    // 1. tsconfig.json
    const tsconfig = configFiles?.['tsconfig.json'] as any;
    if (tsconfig?.compilerOptions) {
      console.log('tsconfig: ', tsconfig);
      const opts = tsconfig.compilerOptions;
      if (opts.target) {
        const target = `TypeScript target: ${opts.target}`;
        if (!newCompatibility.includes(target)) newCompatibility.push(target);
      }
      if (opts.module) {
        const mod = `Module system: ${opts.module}`;
        if (!newCompatibility.includes(mod)) newCompatibility.push(mod);
      }
    }

    // 2. forge.config – платформы из makers
    const forgeConfig = configFiles?.['forge.config.ts'] || configFiles?.['forge.config.js'];
    if (forgeConfig) {
      const configStr = typeof forgeConfig === 'string' ? forgeConfig : JSON.stringify(forgeConfig);
      if (configStr.includes('@electron-forge/maker-squirrel') && !newCompatibility.includes('Windows (Squirrel)'))
        newCompatibility.push('Windows (Squirrel)');
      if (configStr.includes('@electron-forge/maker-dmg') && !newCompatibility.includes('macOS (DMG)'))
        newCompatibility.push('macOS (DMG)');
      if (configStr.includes('@electron-forge/maker-deb') && !newCompatibility.includes('Linux (DEB)'))
        newCompatibility.push('Linux (DEB)');
    }

    // 3. .env – переменные безопасности/окружения
    const envContent = configFiles?.['.env'] as string | undefined;
    if (envContent) {
      const envVars = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      envVars.forEach(v => {
        if (v.startsWith('VITE_') && !newSecurity.includes(`Environment variable: ${v}`))
          newSecurity.push(`Environment variable: ${v}`);
      });
    }

    // 4. Зависимости для производительности
    if (packageJson) {
      const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
      if (deps['pino'] && !newPerformance.includes('Structured logging (pino)'))
        newPerformance.push('Structured logging (pino)');
      if (deps['lru-cache'] && !newPerformance.includes('LRU caching (lru-cache)'))
        newPerformance.push('LRU caching (lru-cache)');
    }

    onUpdate({
      technicalRequirements: {
        ...tech,
        compatibility: newCompatibility,
        security: newSecurity,
        performance: newPerformance,
        dataHandling: newDataHandling,
      },
    });
  };

  const canFill = !!(packageJson || configFiles);

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Технические требования</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                technicalRequirements: {
                  ...tech,
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
        <div className="text-sm">
          {/* Совместимость */}
          <div className="p-field p-mb-4">
            <label className="p-mb-2">Совместимость:</label>
            {tech.compatibility.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={item}
                  onChange={(e) => {
                    const updated = [...tech.compatibility];
                    updated[index] = e.target.value;
                    updateArray('compatibility', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = tech.compatibility.filter((_, i) => i !== index);
                    updateArray('compatibility', updated);
                  }}
                  aria-label="Удалить"
                />
              </div>
            ))}
            <Button
              label="Добавить"
              icon="pi pi-plus"
              onClick={() => updateArray('compatibility', [...tech.compatibility, ''])}
              className="p-button-accent p-button-sm mt-2 mb-2"
            />
          </div>

          {/* Обработка данных */}
          <div className="p-field p-mb-4">
            <label className="p-mb-2">Обработка данных:</label>
            {tech.dataHandling.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={item}
                  onChange={(e) => {
                    const updated = [...tech.dataHandling];
                    updated[index] = e.target.value;
                    updateArray('dataHandling', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = tech.dataHandling.filter((_, i) => i !== index);
                    updateArray('dataHandling', updated);
                  }}
                  aria-label="Удалить"
                />
              </div>
            ))}
            <Button
              label="Добавить"
              icon="pi pi-plus"
              onClick={() => updateArray('dataHandling', [...tech.dataHandling, ''])}
              className="p-button-accent p-button-sm mt-2 mb-2"
            />
          </div>

          {/* Безопасность */}
          <div className="p-field p-mb-4">
            <label className="p-mb-2">Безопасность:</label>
            {tech.security.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={item}
                  onChange={(e) => {
                    const updated = [...tech.security];
                    updated[index] = e.target.value;
                    updateArray('security', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = tech.security.filter((_, i) => i !== index);
                    updateArray('security', updated);
                  }}
                  aria-label="Удалить"
                />
              </div>
            ))}
            <Button
              label="Добавить"
              icon="pi pi-plus"
              onClick={() => updateArray('security', [...tech.security, ''])}
              className="p-button-accent p-button-sm mt-2 mb-2"
            />
          </div>

          {/* Производительность */}
          <div className="p-field p-mb-4">
            <label className="p-mb-2">Производительность:</label>
            {tech.performance.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={item}
                  onChange={(e) => {
                    const updated = [...tech.performance];
                    updated[index] = e.target.value;
                    updateArray('performance', updated);
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updated = tech.performance.filter((_, i) => i !== index);
                    updateArray('performance', updated);
                  }}
                  aria-label="Удалить"
                />
              </div>
            ))}
            <Button
              label="Добавить"
              icon="pi pi-plus"
              onClick={() => updateArray('performance', [...tech.performance, ''])}
              className="p-button-accent p-button-sm mt-2 mb-2"
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
              tooltip="Извлечь совместимость, безопасность и производительность из tsconfig, forge.config, .env и package.json"
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
import { Divider } from 'primereact/divider';
import { PackageJson } from '@/types/types';

interface TechnicalRequirementsSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
}

export const TechnicalRequirementsSection: React.FC<TechnicalRequirementsSectionProps> = ({ template, onUpdate, packageJson }) => {
  // Опции для SelectButton
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false }
  ];

  // Определяем, активна ли секция (по умолчанию — включена)
  const isSectionEnabled = template.technicalRequirements?.enabled ?? true;

  return (
    <section className="p-mb-6">
      {
        // Заголовок и SelectButton в одной строке
      }
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Технические требования</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                technicalRequirements: {
                  ...template.technicalRequirements,
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
            // Совместимость
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Совместимость:</label>
            {template.technicalRequirements.compatibility.map((comp, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={comp}
                  onChange={(e) => {
                    const updatedCompatibility = [...template.technicalRequirements.compatibility];
                    updatedCompatibility[index] = e.target.value;
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        compatibility: updatedCompatibility
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
                    const updatedCompatibility = template.technicalRequirements.compatibility.filter((_, i) => i !== index);
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        compatibility: updatedCompatibility
                      }
                    });
                  }}
                  aria-label="Удалить требование совместимости"
                />
              </div>
            ))}
            <Button
              label="Добавить требование"
              icon="pi pi-plus"
              onClick={() => {
                const updatedCompatibility = [...template.technicalRequirements.compatibility, ''];
                onUpdate({
                  technicalRequirements: {
                    ...template.technicalRequirements,
                    compatibility: updatedCompatibility
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {
            // Обработка данных
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Обработка данных:</label>
            {template.technicalRequirements.dataHandling.map((handling, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={handling}
                  onChange={(e) => {
                    const updatedDataHandling = [...template.technicalRequirements.dataHandling];
                    updatedDataHandling[index] = e.target.value;
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        dataHandling: updatedDataHandling
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
                    const updatedDataHandling = template.technicalRequirements.dataHandling.filter((_, i) => i !== index);
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        dataHandling: updatedDataHandling
                      }
                    });
                  }}
                  aria-label="Удалить правило обработки данных"
                />
              </div>
            ))}
            <Button
              label="Добавить правило"
              icon="pi pi-plus"
              onClick={() => {
                const updatedDataHandling = [...template.technicalRequirements.dataHandling, ''];
                onUpdate({
                  technicalRequirements: {
                    ...template.technicalRequirements,
                    dataHandling: updatedDataHandling
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {
            // Безопасность
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Безопасность:</label>
            {template.technicalRequirements.security.map((sec, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={sec}
                  onChange={(e) => {
                    const updatedSecurity = [...template.technicalRequirements.security];
                    updatedSecurity[index] = e.target.value;
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        security: updatedSecurity
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
                    const updatedSecurity = template.technicalRequirements.security.filter((_, i) => i !== index);
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        security: updatedSecurity
                      }
                    });
                  }}
                  aria-label="Удалить требование безопасности"
                />
              </div>
            ))}
            <Button
              label="Добавить требование"
              icon="pi pi-plus"
              onClick={() => {
                const updatedSecurity = [...template.technicalRequirements.security, ''];
                onUpdate({
                  technicalRequirements: {
                    ...template.technicalRequirements,
                    security: updatedSecurity
                  }
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {
            // Производительность
          }
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Производительность:</label>
            {template.technicalRequirements.performance.map((perf, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={perf}
                  onChange={(e) => {
                    const updatedPerformance = [...template.technicalRequirements.performance];
                    updatedPerformance[index] = e.target.value;
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        performance: updatedPerformance
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
                    const updatedPerformance = template.technicalRequirements.performance.filter((_, i) => i !== index);
                    onUpdate({
                      technicalRequirements: {
                        ...template.technicalRequirements,
                        performance: updatedPerformance
                      }
                    });
                              }}
                  aria-label="Удалить параметр производительности"
                />
              </div>
            ))}
            <Button
              label="Добавить параметр"
              icon="pi pi-plus"
              onClick={() => {
                const updatedPerformance = [...template.technicalRequirements.performance, ''];
                onUpdate({
                  technicalRequirements: {
                    ...template.technicalRequirements,
                    performance: updatedPerformance
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