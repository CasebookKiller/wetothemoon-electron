// CodeContextSection.tsx
import React, { useState, useEffect } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea as Textarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { CodeSourceType, CodeSnippet, CodeFileReference, PromptTemplate } from '@/shared/types/promptgenerator';
import { PackageJson } from '@/shared/types/types';

interface CodeContextSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
  projectTree?: any[] | null;
}

export const CodeContextSection: React.FC<CodeContextSectionProps> = ({
  template,
  onUpdate,
  packageJson,
  configFiles,
  projectTree,
}) => {
  const enabledOptions = [
    { label: 'Вкл.', value: true },
    { label: 'Выкл.', value: false },
  ];

  const isSectionEnabled = template.codeContext?.enabled ?? true;
  const [fileLoading, setFileLoading] = useState(false);

  interface ReadFileResult {
    path: string;
    filename: string;
    content: string;
    language: string;
  }

  const codeContext = template.codeContext || {
    language: '',
    sourceType: CodeSourceType.Snippet,
    purpose: '',
    process: 'main',
    problemDescription: '',
    codeSources: '',
    dependencies: [],
    enabled: isSectionEnabled,
  };

  const [currentSourceType, setCurrentSourceType] = useState<CodeSourceType>(
    codeContext.sourceType || CodeSourceType.Snippet
  );

  useEffect(() => {
    setCurrentSourceType(codeContext.sourceType || CodeSourceType.Snippet);
  }, [codeContext.sourceType]);

  const handleCodeContextChange = (field: string, value: any) => {
    onUpdate({
      codeContext: {
        ...codeContext,
        [field]: value,
      },
    });
  };

  const handleSectionToggle = (value: boolean) => {
    onUpdate({ codeContext: { ...codeContext, enabled: value } });
  };

  const handleSourceTypeChange = (type: CodeSourceType) => {
    setCurrentSourceType(type);
    let newSources: string | CodeSnippet[] | CodeFileReference[] = '';
    if (type === CodeSourceType.MultipleSnippets) {
      newSources = [{ code: '', purpose: '' }];
    } else if (type === CodeSourceType.FilePaths) {
      newSources = [{ path: '', purpose: '', process: 'main' }];
    }
    onUpdate({
      codeContext: {
        ...codeContext,
        sourceType: type,
        codeSources: newSources,
      },
    });
  };

  const getSafeCodeSources = (): string | CodeSnippet[] | CodeFileReference[] => {
    if (!codeContext.codeSources) {
      switch (currentSourceType) {
        case CodeSourceType.Snippet: return '';
        case CodeSourceType.MultipleSnippets: return [{ code: '', purpose: '' }];
        case CodeSourceType.FilePaths: return [{ path: '', purpose: '', process: 'main' }];
        default: return '';
      }
    }
    return codeContext.codeSources;
  };

  const safeCodeSources = getSafeCodeSources();

  const handleAddFromFiles = async () => {
    const electronAPI = (window as any)?.electronAPI;
    if (!electronAPI?.openFilePicker || !electronAPI?.readFilesContents) {
      console.error('Electron API недоступен');
      return;
    }

    setFileLoading(true);
    try {
      const filePaths: string[] | null = await electronAPI.openFilePicker();
      if (!filePaths || filePaths.length === 0) {
        console.log('Файлы не выбраны');
        return;
      }

      if (currentSourceType === CodeSourceType.FilePaths) {
        const newFiles: CodeFileReference[] = filePaths.map((filePath: string) => {
          const fileName = filePath.split(/[\\/]/).pop() || filePath;
          return {
            path: filePath,
            purpose: fileName,
            process: 'main',
          };
        });
        const current = Array.isArray(codeContext.codeSources)
          ? [...(codeContext.codeSources as CodeFileReference[])]
          : [];
        handleCodeContextChange('codeSources', [...current, ...newFiles]);
      } else {
        const files: ReadFileResult[] = await electronAPI.readFilesContents(filePaths);

        if (currentSourceType === CodeSourceType.Snippet) {
          let newCode = typeof codeContext.codeSources === 'string' ? codeContext.codeSources : '';
          files.forEach((file) => {
            if (newCode) newCode += '\n\n';
            newCode += `// ${file.filename}\n${file.content}`;
          });
          handleCodeContextChange('codeSources', newCode);

          if (!codeContext.language && files.length > 0 && files[0].language) {
            handleCodeContextChange('language', files[0].language);
          }
        } else if (currentSourceType === CodeSourceType.MultipleSnippets) {
          const newSnippets: CodeSnippet[] = files.map((file) => ({
            code: file.content,
            purpose: file.filename,
            process: 'main',
            dependencies: [],
            problemDescription: '',
          }));
          const currentSnippets = Array.isArray(codeContext.codeSources)
            ? [...(codeContext.codeSources as CodeSnippet[])]
            : [];
          handleCodeContextChange('codeSources', [...currentSnippets, ...newSnippets]);

          if (!codeContext.language && files.length > 0 && files[0].language) {
            handleCodeContextChange('language', files[0].language);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при добавлении из файлов:', error);
    } finally {
      setFileLoading(false);
    }
  };

  // Заполнение из package.json (зависимости, язык)
  const handleLoadDependenciesFromPackage = () => {
    if (!packageJson) return;
    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
      ...(packageJson.peerDependencies || {}),
    };
    const depList = Object.entries(allDeps).map(([name, version]) => `${name}@${version}`);
    handleCodeContextChange('dependencies', depList);

    if (!codeContext.language) {
      if (packageJson.dependencies?.typescript || packageJson.devDependencies?.typescript) {
        handleCodeContextChange('language', 'TypeScript');
      } else if (packageJson.dependencies?.react) {
        handleCodeContextChange('language', 'JavaScript/TypeScript');
      }
    }
  };

  // Вставка package.json как фрагмента
  const handleInsertPackageJsonAsSnippet = () => {
    if (!packageJson) return;
    const formatted = JSON.stringify(packageJson, null, 2);
    if (currentSourceType === CodeSourceType.Snippet) {
      const current = typeof safeCodeSources === 'string' ? safeCodeSources : '';
      const newCode = current ? current + '\n\n' + formatted : formatted;
      handleCodeContextChange('codeSources', newCode);
    }
    handleCodeContextChange('language', 'json');
  };

  // Автозаполнение из конфигов (язык, процесс, зависимости, пути)
  const handleFillFromConfigs = () => {
    if (!configFiles && !packageJson) return;

    // Язык
    if (!codeContext.language) {
      const tsconfig = configFiles?.['tsconfig.json'];
      if (tsconfig) handleCodeContextChange('language', 'TypeScript');
      else if (packageJson?.dependencies?.typescript || packageJson?.devDependencies?.typescript)
        handleCodeContextChange('language', 'TypeScript');
    }

    // Зависимости
    if (packageJson && (!codeContext.dependencies || codeContext.dependencies.length === 0)) {
      handleLoadDependenciesFromPackage();
    }

    // Процесс (только для Snippet)
    if (currentSourceType === CodeSourceType.Snippet && !codeContext.process) {
      if (configFiles?.['vite.main.config.ts'] || configFiles?.['vite.preload.config.ts']) {
        handleCodeContextChange('process', 'main');
      } else if (configFiles?.['vite.config.ts']) {
        handleCodeContextChange('process', 'renderer');
      }
    }

    // Для FilePaths – добавить основные конфиги как файлы (если список пуст)
    if (currentSourceType === CodeSourceType.FilePaths && Array.isArray(safeCodeSources) && safeCodeSources.length === 0) {
      const configPaths: CodeFileReference[] = [];
      const knownConfigs = [
        'tsconfig.json', 'vite.config.ts', 'forge.config.ts',
        '.eslintrc.json', '.prettierrc', '.env',
      ];
      if (configFiles) {
        knownConfigs.forEach(name => {
          if (configFiles[name]) {
            configPaths.push({ path: name, purpose: 'конфигурационный файл', process: 'main' });
          }
        });
      }
      if (configPaths.length > 0) {
        handleCodeContextChange('codeSources', configPaths);
      }
    }
  };

  const canFill = !!(packageJson || configFiles);

  // больше нет useEffect для автоматической загрузки package.json
  // (пользователь сам вызывает через кнопки)

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Контекст кода</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) => handleSectionToggle(e.value)}
            optionLabel="label"
            optionValue="value"
            className="w-full text-sm m-2"
          />
        </div>
      </div>

      {isSectionEnabled && (
        <div>
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Тип источника кода:</label>
            <Dropdown
              value={currentSourceType}
              options={[
                { label: 'Один фрагмент', value: CodeSourceType.Snippet },
                { label: 'Несколько фрагментов', value: CodeSourceType.MultipleSnippets },
                { label: 'Пути к файлам', value: CodeSourceType.FilePaths },
              ]}
              onChange={(e) => handleSourceTypeChange(e.value)}
              placeholder="Выберите тип источника"
              className="w-full text-sm"
            />
          </div>

          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Язык программирования:</label>
            <InputText
              value={codeContext.language}
              onChange={(e) => handleCodeContextChange('language', e.target.value)}
              placeholder="TypeScript, Python, Java..."
              className="w-full text-sm"
            />
          </div>

          {/* Процесс – только для Snippet */}
          {currentSourceType === CodeSourceType.Snippet && (
            <div className="mb-4 text-sm">
              <label className="block font-medium text-700 mb-2">Процесс:</label>
              <Dropdown
                value={codeContext.process}
                options={[
                  { label: 'Main', value: 'main' },
                  { label: 'Renderer', value: 'renderer' },
                ]}
                onChange={(e) => handleCodeContextChange('process', e.value)}
                placeholder="Выберите процесс"
                className="w-full text-sm"
              />
            </div>
          )}

          {/* Фрагмент кода (Snippet) */}
          {currentSourceType === CodeSourceType.Snippet && (
            <div className="mb-4 text-sm">
              <label className="block font-medium text-700 mb-2">Фрагмент кода:</label>
              <Textarea
                value={typeof safeCodeSources === 'string' ? safeCodeSources : ''}
                onChange={(e) => handleCodeContextChange('codeSources', e.target.value)}
                rows={8}
                placeholder="Вставьте пример кода..."
                className="w-full text-sm font-mono"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  label="Выбрать файл"
                  icon="pi pi-folder-open"
                  loading={fileLoading}
                  onClick={handleAddFromFiles}
                  className="p-button-accent p-button-sm"
                />
                <Button
                  label="Вставить package.json"
                  icon="pi pi-file"
                  onClick={handleInsertPackageJsonAsSnippet}
                  disabled={!packageJson}
                  className="p-button-accent p-button-sm"
                />
              </div>
            </div>
          )}

          {/* MultipleSnippets */}
          {currentSourceType === CodeSourceType.MultipleSnippets && (
            <div className="mb-4 text-sm">
              <label className="block font-medium text-700 mb-2">Фрагменты кода:</label>
              {Array.isArray(safeCodeSources) &&
                (safeCodeSources as CodeSnippet[]).map((snippet, index) => (
                  <div
                    key={index}
                    className="mb-3 p-3 border-round border-hint border-1"
                    style={{ background: 'var(--tg-theme-section-bg-color)' }}
                  >
                    {/* ... содержимое фрагмента (без изменений) ... */}
                    <div className="flex justify-content-end">
                      <Button
                        icon="pi pi-trash"
                        className="p-button-accent p-button-sm"
                        onClick={() => {
                          const updated = (safeCodeSources as CodeSnippet[]).filter((_, i) => i !== index);
                          handleCodeContextChange('codeSources', updated);
                        }}
                        aria-label="Удалить фрагмент"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Код #{index + 1}:</label>
                      <Textarea
                        value={snippet.code || ''}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeSnippet[])];
                          updated[index].code = e.target.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        rows={4}
                        placeholder="Вставьте код..."
                        className="w-full text-sm font-mono"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Назначение:</label>
                      <InputText
                        value={snippet.purpose || ''}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeSnippet[])];
                          updated[index].purpose = e.target.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        placeholder="Назначение фрагмента..."
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Процесс:</label>
                      <Dropdown
                        value={snippet.process || 'main'}
                        options={[
                          { label: 'Main', value: 'main' },
                          { label: 'Renderer', value: 'renderer' },
                        ]}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeSnippet[])];
                          updated[index].process = e.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Зависимости:</label>
                      <InputText
                        value={snippet.dependencies?.join(', ') || ''}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeSnippet[])];
                          updated[index].dependencies = e.target.value
                            .split(',')
                            .map((dep) => dep.trim())
                            .filter((dep) => dep);
                          handleCodeContextChange('codeSources', updated);
                        }}
                        placeholder="React, Express..."
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Описание проблемы:</label>
                      <Textarea
                        value={snippet.problemDescription || ''}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeSnippet[])];
                          updated[index].problemDescription = e.target.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        rows={2}
                        placeholder="Описание проблемы в этом фрагменте..."
                        className="w-full text-sm"
                      />
                    </div>
                  </div>
                ))}
              <div className="flex gap-2">
                <Button
                  label="Добавить фрагмент"
                  icon="pi pi-plus"
                  onClick={() => {
                    const newSnippet: CodeSnippet = { code: '', purpose: '', process: 'main' };
                    handleCodeContextChange('codeSources', [
                      ...(safeCodeSources as CodeSnippet[]),
                      newSnippet,
                    ]);
                  }}
                  className="p-button-accent p-button-sm"
                />
                <Button
                  label="Добавить из файлов"
                  icon="pi pi-folder-open"
                  loading={fileLoading}
                  onClick={handleAddFromFiles}
                  className="p-button-accent p-button-sm"
                />
              </div>
            </div>
          )}

          {/* FilePaths */}
          {currentSourceType === CodeSourceType.FilePaths && (
            <div className="mb-4 text-sm">
              <label className="block font-medium text-700 mb-2">Пути к файлам:</label>
              {Array.isArray(safeCodeSources) &&
                (safeCodeSources as CodeFileReference[]).map((file, index) => (
                  <div
                    key={index}
                    className="mb-3 p-3 border-round border-hint border-1"
                    style={{ background: 'var(--tg-theme-section-bg-color)' }}
                  >
                    {/* ... поля файла (без изменений) ... */}
                    <div className="flex justify-content-end">
                      <Button
                        icon="pi pi-trash"
                        className="p-button-accent p-button-sm"
                        onClick={() => {
                          const updated = (safeCodeSources as CodeFileReference[]).filter((_, i) => i !== index);
                          handleCodeContextChange('codeSources', updated);
                        }}
                        aria-label="Удалить файл"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Путь #{index + 1}:</label>
                      <InputText
                        value={file.path || ''}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeFileReference[])];
                          updated[index].path = e.target.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        placeholder="src/main.ts"
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Назначение:</label>
                      <InputText
                        value={file.purpose || ''}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeFileReference[])];
                          updated[index].purpose = e.target.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        placeholder="Основная точка входа"
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Процесс:</label>
                      <Dropdown
                        value={file.process || 'main'}
                        options={[
                          { label: 'Main', value: 'main' },
                          { label: 'Renderer', value: 'renderer' },
                        ]}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeFileReference[])];
                          updated[index].process = e.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        placeholder="Выберите процесс"
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-1">Описание проблемы:</label>
                      <Textarea
                        value={file.problemDescription || ''}
                        onChange={(e) => {
                          const updated = [...(safeCodeSources as CodeFileReference[])];
                          updated[index].problemDescription = e.target.value;
                          handleCodeContextChange('codeSources', updated);
                        }}
                        rows={2}
                        placeholder="Проблемы в этом файле..."
                        className="w-full text-sm"
                      />
                    </div>
                  </div>
                ))}
              <div className="flex gap-2">
                <Button
                  label="Добавить файл"
                  icon="pi pi-plus"
                  onClick={() => {
                    const newFile: CodeFileReference = { path: '', purpose: '', process: 'main' };
                    handleCodeContextChange('codeSources', [
                      ...(safeCodeSources as CodeFileReference[]),
                      newFile,
                    ]);
                  }}
                  className="p-button-accent p-button-sm"
                />
                <Button
                  label="Выбрать из папки"
                  icon="pi pi-folder-open"
                  loading={fileLoading}
                  onClick={handleAddFromFiles}
                  className="p-button-accent p-button-sm"
                />
              </div>
            </div>
          )}

          {/* Назначение, Зависимости, Описание проблемы – только для Snippet */}
          {currentSourceType === CodeSourceType.Snippet && (
            <>
              <div className="mb-4 text-sm">
                <label className="block font-medium text-700 mb-2">Назначение:</label>
                <InputText
                  value={codeContext.purpose}
                  onChange={(e) => handleCodeContextChange('purpose', e.target.value)}
                  placeholder="Пример интерфейса для работы с пользователями..."
                  className="w-full text-sm"
                />
              </div>

              <div className="mb-4 text-sm">
                <label className="block font-medium text-700 mb-2">Зависимости:</label>
                <div className="flex gap-2 align-items-center">
                  <InputText
                    value={codeContext.dependencies?.join(', ') || ''}
                    onChange={(e) =>
                      handleCodeContextChange(
                        'dependencies',
                        e.target.value
                          .split(',')
                          .map((dep) => dep.trim())
                          .filter((dep) => dep)
                      )
                    }
                    placeholder="React, Express, Axios..."
                    className="w-full text-sm"
                  />
                  <Button
                    icon="pi pi-download"
                    onClick={handleLoadDependenciesFromPackage}
                    disabled={!packageJson}
                    className="p-button-sm p-button-accent"
                    tooltip="Загрузить зависимости из package.json"
                    tooltipOptions={{ position: 'top' }}
                  />
                </div>
              </div>

              <div className="mb-4 text-sm">
                <label className="block font-medium text-700 mb-2">Описание проблемы:</label>
                <Textarea
                  value={codeContext.problemDescription}
                  onChange={(e) => handleCodeContextChange('problemDescription', e.target.value)}
                  rows={4}
                  placeholder="Необходимо добавить валидацию данных при создании пользователя..."
                  className="w-full text-sm"
                />
              </div>
            </>
          )}

        </div>
      )}

      {isSectionEnabled && (
        <div className={"p-fluid text-sm"}>
          {/* Кнопка "Заполнить из конфигов" общая */}
          <div className="p-mt-3">
            <Button
              label="Заполнить из конфигов"
              icon="pi pi-download"
              onClick={handleFillFromConfigs}
              disabled={!canFill}
              className="p-button-sm p-button-accent"
              tooltip="Автоматически заполнить язык, процесс, зависимости и пути из конфигурационных файлов"
              tooltipOptions={{ position: 'top' }}
            />
          </div>
        </div>
      )}
      <Divider />
    </section>
  );
};