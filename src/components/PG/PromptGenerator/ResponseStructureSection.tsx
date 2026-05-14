// ResponseStructureSection.tsx
import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import {
  PromptTemplate,
  ResponseDepth,
  CodeIndentation,
} from '@/types/promptgenerator';
import { PackageJson } from '@/types/types';

interface ResponseStructureSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
}

export const ResponseStructureSection: React.FC<ResponseStructureSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles,
}) => {
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false },
  ];

  const isSectionEnabled = template.responseStructure?.enabled ?? true;

  // Автозаполнение из конфигов
  const handleFillFromConfigs = () => {
    if (!configFiles && !packageJson) return;

    const structure = template.responseStructure;
    const newCodeFormat = { ...structure.codeFormat };
    let updated = false;

    // 1. Синтаксис (TypeScript/JavaScript)
    const tsconfig = configFiles?.['tsconfig.json'] as any;
    if (tsconfig?.compilerOptions?.jsx) {
      newCodeFormat.syntax = 'TypeScript (React/JSX)';
      updated = true;
    } else if (
      packageJson?.dependencies?.typescript ||
      packageJson?.devDependencies?.typescript
    ) {
      newCodeFormat.syntax = 'TypeScript';
      updated = true;
    } else if (tsconfig) {
      newCodeFormat.syntax = 'TypeScript'; // есть tsconfig, значит TypeScript
      updated = true;
    }

    // 2. Отступы (из .prettierrc)
    const prettier = configFiles?.['.prettierrc'] as any;
    if (prettier) {
      if (prettier.useTabs === true) {
        newCodeFormat.indentation = CodeIndentation.Tabs;
        updated = true;
      } else if (prettier.tabWidth !== undefined) {
        newCodeFormat.indentation = CodeIndentation.Spaces;
        updated = true;
      }
    }

    // 3. Соглашение об именах (из ESLint)
    const eslint = configFiles?.['.eslintrc.json'] as any;
    if (eslint?.rules) {
      const rules = eslint.rules;
      if (rules.camelcase === 'error' || rules.camelcase?.[0] === 'error') {
        newCodeFormat.namingConvention = 'camelCase';
        updated = true;
      } else if (rules['@typescript-eslint/naming-convention']) {
        newCodeFormat.namingConvention = 'camelCase';
        updated = true;
      }
    }

    if (updated) {
      onUpdate({
        responseStructure: {
          ...structure,
          codeFormat: newCodeFormat,
        },
      });
    }
  };

  const canFill = !!(packageJson || configFiles);

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Структура ответа</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                responseStructure: {
                  ...template.responseStructure,
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
          {/* Разделы ответа */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Разделы ответа:</label>
            {template.responseStructure.sections.map((section, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  placeholder="Название раздела"
                  value={section.name}
                  onChange={(e) => {
                    const updatedSections = [...template.responseStructure.sections];
                    updatedSections[index].name = e.target.value;
                    onUpdate({
                      responseStructure: {
                        ...template.responseStructure,
                        sections: updatedSections,
                      },
                    });
                  }}
                  className="w-8 text-sm"
                />
                <Dropdown
                  value={section.depth}
                  options={[
                    { label: 'Краткий', value: ResponseDepth.Short },
                    { label: 'Подробный', value: ResponseDepth.Detailed },
                  ]}
                  onChange={(e) => {
                    const updatedSections = [...template.responseStructure.sections];
                    updatedSections[index].depth = e.value;
                    onUpdate({
                      responseStructure: {
                        ...template.responseStructure,
                        sections: updatedSections,
                      },
                    });
                  }}
                  className="w-4 text-sm"
                />
                <InputText
                  placeholder="Формат"
                  value={section.format}
                  onChange={(e) => {
                    const updatedSections = [...template.responseStructure.sections];
                    updatedSections[index].format = e.target.value;
                    onUpdate({
                      responseStructure: {
                        ...template.responseStructure,
                        sections: updatedSections,
                      },
                    });
                  }}
                  className="w-8 text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updatedSections = template.responseStructure.sections.filter(
                      (_, i) => i !== index
                    );
                    onUpdate({
                      responseStructure: {
                        ...template.responseStructure,
                        sections: updatedSections,
                      },
                    });
                  }}
                  aria-label="Удалить раздел"
                />
              </div>
            ))}
            <Button
              label="Добавить раздел"
              icon="pi pi-plus"
              onClick={() => {
                const newSection = {
                  name: '',
                  required: true,
                  depth: ResponseDepth.Detailed,
                  format: '',
                };
                onUpdate({
                  responseStructure: {
                    ...template.responseStructure,
                    sections: [...template.responseStructure.sections, newSection],
                  },
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Формат кода */}
          <div className="mb-4 text-sm">
            <h3 className="font-medium text-sm text-800 mb-3">Формат кода</h3>
            <div className="flex gap-2 mb-2 align-items-center">
              {/* Синтаксис */}
              <div className="w-full">
                <label className="block text-sm font-medium text-600 mb-1">Синтаксис:</label>
                <InputText
                  value={template.responseStructure.codeFormat.syntax}
                  onChange={(e) =>
                    onUpdate({
                      responseStructure: {
                        ...template.responseStructure,
                        codeFormat: {
                          ...template.responseStructure.codeFormat,
                          syntax: e.target.value,
                        },
                      },
                    })
                  }
                  className="w-full text-sm"
                />
              </div>

              {/* Отступы */}
              <div className="w-full">
                <label className="block text-sm font-medium text-600 mb-1">Отступы:</label>
                <Dropdown
                  value={template.responseStructure.codeFormat.indentation}
                  options={[
                    { label: 'Пробелы', value: 'spaces' },
                    { label: 'Табуляция', value: 'tabs' },
                  ]}
                  onChange={(e) =>
                    onUpdate({
                      responseStructure: {
                        ...template.responseStructure,
                        codeFormat: {
                          ...template.responseStructure.codeFormat,
                          indentation: e.value,
                        },
                      },
                    })
                  }
                  className="w-full text-sm"
                />
              </div>

              {/* Соглашение об именах */}
              <div className="w-full">
                <label className="block text-sm font-medium text-600 mb-1">
                  Соглашение об именах:
                </label>
                <InputText
                  value={template.responseStructure.codeFormat.namingConvention}
                  onChange={(e) =>
                    onUpdate({
                      responseStructure: {
                        ...template.responseStructure,
                        codeFormat: {
                          ...template.responseStructure.codeFormat,
                          namingConvention: e.target.value,
                        },
                      },
                    })
                  }
                  className="w-full text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isSectionEnabled && (
        <div className="p-fluid text-sm">
        {/* Кнопка автозаполнения */}
          <div className="p-mt-3">
            <Button
              label="Заполнить из конфигов"
              icon="pi pi-download"
              onClick={handleFillFromConfigs}
              disabled={!canFill}
              className="p-button-sm p-button-accent"
              tooltip="Подставить синтаксис, отступы и соглашение об именах из tsconfig и Prettier/ESLint"
              tooltipOptions={{ position: 'top' }}
            />
          </div>
        </div>
      )}

      <Divider />
    </section>
  );
};