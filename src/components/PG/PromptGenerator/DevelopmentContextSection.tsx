// DevelopmentContextSection.tsx
import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { ProjectStructureComponent } from './ProjectStructureComponent';
import { ProjectStructure, PromptTemplate, TreeNode } from '@/shared/types/promptgenerator';
import { Divider } from 'primereact/divider';
import { PackageJson } from '@/shared/types/types';
import ignore from 'ignore';

interface DevelopmentContextSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
  projectTree?: TreeNode[] | null;
}

// Копия treeToString для использования внутри DevelopmentContextSection
function treeToString(
  nodes: TreeNode[],
  prefix = '',
  igFilter: ReturnType<typeof ignore> | null = null,
  isRoot = true
): string {
  // Сортируем: сначала директории, потом файлы; внутри групп по имени
  const sorted = [...nodes].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });

  let result = '';
  const filtered = igFilter
    ? sorted.filter((node) => !igFilter.ignores(node.path))
    : sorted;

  for (let i = 0; i < filtered.length; i++) {
    const node = filtered[i];
    const isLast = i === filtered.length - 1;
    
    if (isRoot) {
      result += `/${node.name}\n`;
    } else {
      const connector = isLast ? '└── ' : '├── ';
      result += `${prefix}${connector}${node.name}\n`;
    }
    
    if (node.children) {
      const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
      result += treeToString(node.children, childPrefix, igFilter, false);
    }
  }
  return result;
}

export const DevelopmentContextSection: React.FC<DevelopmentContextSectionProps> = ({
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

  const isSectionEnabled = template.developmentContext?.enabled ?? true;

  const developmentContext = {
    backendStructure: {
      type: 'tree' as const,
      content: '',
      rootDirectory: '',
      description: '',
    },
    buildProcess: '',
    deploymentStrategy: '',
    enabled: isSectionEnabled,
    ...template.developmentContext,
  };

  const handleDevelopmentContextChange = (updates: Partial<typeof developmentContext>) => {
    onUpdate({
      developmentContext: {
        ...developmentContext,
        ...updates,
      },
    });
  };

  const handleProjectStructureChange = (projectStructure: ProjectStructure) => {
    handleDevelopmentContextChange({ backendStructure: projectStructure });
  };

  const handleFillFromConfigs = () => {
    if (!configFiles && !packageJson) return;

    // 1. Процесс сборки
    if (!developmentContext.buildProcess.trim()) {
      let buildProcess = '';
      const forgeConfig = configFiles?.['forge.config.ts'] || configFiles?.['forge.config.js'];
      const viteConfig = configFiles?.['vite.config.ts'];

      if (forgeConfig && viteConfig) {
        buildProcess = 'Electron Forge + Vite';
      } else if (forgeConfig) {
        buildProcess = 'Electron Forge';
      } else if (viteConfig) {
        buildProcess = 'Vite';
      } else if (packageJson?.scripts?.build) {
        buildProcess = `npm run build (${packageJson.scripts.build})`;
      }

      if (buildProcess) {
        handleDevelopmentContextChange({ buildProcess });
      }
    }

    // 2. Стратегия деплоя
    if (!developmentContext.deploymentStrategy.trim()) {
      let deploymentStrategy = '';
      const forgeConfig = configFiles?.['forge.config.ts'] || configFiles?.['forge.config.js'];

      if (forgeConfig) {
        const configStr = typeof forgeConfig === 'string' ? forgeConfig : JSON.stringify(forgeConfig);
        const makers: string[] = [];
        if (configStr.includes('@electron-forge/maker-squirrel')) makers.push('Squirrel (Windows)');
        if (configStr.includes('@electron-forge/maker-dmg')) makers.push('DMG (macOS)');
        if (configStr.includes('@electron-forge/maker-deb')) makers.push('DEB (Linux)');
        if (configStr.includes('@electron-forge/maker-rpm')) makers.push('RPM (Linux)');

        if (makers.length > 0) {
          deploymentStrategy = `Electron Forge makers: ${makers.join(', ')}`;
        }
      }

      if (!deploymentStrategy && packageJson?.scripts?.deploy) {
        deploymentStrategy = `npm run deploy (${packageJson.scripts.deploy})`;
      }

      if (deploymentStrategy) {
        handleDevelopmentContextChange({ deploymentStrategy });
      }
    }

    // 3. Структура бэкенда из projectTree (если ещё не заполнена)
    const structure = developmentContext.backendStructure;
    if (!structure.content && projectTree) {
      const rootName = packageJson?.name || 'project';
      const rootNode: TreeNode = {
        name: rootName,
        path: '.',
        type: 'directory',
        children: projectTree,
      };
      const gitignoreContent = (configFiles?.['.gitignore'] as string) || null;
      const ig = gitignoreContent ? ignore().add(gitignoreContent) : null;
      const content = treeToString([rootNode], '', ig);
      handleDevelopmentContextChange({
        backendStructure: {
          ...structure,
          type: 'tree',
          rootDirectory: '.',
          content,
          description: 'Автоматически сгенерированная структура проекта',
        },
      });
    }
  };

  const canFill = !!(packageJson || configFiles || projectTree);

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4">
        <h3 className="font-medium text-lg">Контекст разработки</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              handleDevelopmentContextChange({ enabled: e.value })
            }
            optionLabel="label"
            optionValue="value"
            className="w-full text-sm m-2"
          />
        </div>
      </div>

      {isSectionEnabled && (
        <div>
          <ProjectStructureComponent
            value={developmentContext.backendStructure}
            onChange={handleProjectStructureChange}
            gitignoreContent={configFiles?.['.gitignore'] as string | undefined}
          />

          <div>
            <div className="mb-4 text-sm">
              <label className="block font-medium text-700 mb-2">Процесс сборки:</label>
              <InputText
                value={developmentContext.buildProcess}
                onChange={(e) => handleDevelopmentContextChange({ buildProcess: e.target.value })}
                placeholder="npm run build, docker build..."
                className="w-full text-sm"
              />
            </div>

            <div className="mb-4 text-sm">
              <label className="block font-medium text-700 mb-2">Стратегия деплоя:</label>
              <InputText
                value={developmentContext.deploymentStrategy}
                onChange={(e) => handleDevelopmentContextChange({ deploymentStrategy: e.target.value })}
                placeholder="Docker Compose, Kubernetes, Vercel..."
                className="w-full text-sm"
              />
            </div>
          </div>

        </div>
      )}

      {isSectionEnabled && (
        <div className='p-fluid text-sm'>
          <div className="p-mt-3">
            <Button
              label="Заполнить из конфигов"
              icon="pi pi-download"
              onClick={handleFillFromConfigs}
              disabled={!canFill}
              className="p-button-sm p-button-accent"
              tooltip="Определить сборку, деплой и структуру из конфигурационных файлов и дерева проекта"
              tooltipOptions={{ position: 'top' }}
            />
          </div>
        </div>
      )}
      <Divider />
    </section>
  );
};