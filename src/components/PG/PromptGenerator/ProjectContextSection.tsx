import React from 'react';
import ignore from 'ignore';
import { InputText } from 'primereact/inputtext';
import { InputTextarea as Textarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import { ProjectStructureComponent } from './ProjectStructureComponent';
import {
  PromptTemplate,
  ProjectStructure,
  Technology,
  Integration,
  TreeNode,
} from '@/shared/types/promptgenerator';
import { PackageJson } from '@/shared/types/types';

interface ProjectContextSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
  projectTree?: TreeNode[] | null;
}

// Вспомогательные функции слияния массивов с уникальностью

function mergeTechnologies(existing: Technology[], newcomers: Technology[]): Technology[] {
  const existingNames = new Set(existing.map((t) => t.name));
  const toAdd = newcomers.filter((t) => t.name && !existingNames.has(t.name)); // если имя не пустое
  return [...existing, ...toAdd];
}

function mergeIntegrations(existing: Integration[], newcomers: Integration[]): Integration[] {
  const existingServices = new Set(existing.map((i) => i.service));
  const toAdd = newcomers.filter((i) => i.service && !existingServices.has(i.service));
  return [...existing, ...toAdd];
}

// treeToString с фильтром
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

// Вариант с использованием эмоджи
function treeToStringEmojis(nodes: TreeNode[], indent = ''): string {
  let result = '';
  nodes.forEach((node) => {
    if (node.type === 'directory') {
      result += `${indent}📁 ${node.name}\n`;
      if (node.children) {
        result += treeToStringEmojis(node.children, indent + '  ');
      }
    } else {
      result += `${indent}📄 ${node.name} (${node.category || node.extension})\n`;
    }
  });
  return result;
}

export const ProjectContextSection: React.FC<ProjectContextSectionProps> = ({
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

  const isSectionEnabled = template.projectContext?.enabled ?? true;

  const handleProjectStructureChange = (projectStructure: ProjectStructure) => {
    onUpdate({
      projectContext: {
        ...template.projectContext,
        fullProjectStructure: projectStructure,
      },
    });
  };

  // ----- Автозаполнение из конфигов -----
  const buildFromConfigs = () => {
    if (!packageJson && !configFiles && !projectTree) return;
    const ctx = template.projectContext;

    // 1. Технологии
    if (packageJson) {
      const deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };
      const newTechnologies: Technology[] = Object.entries(deps).map(
        ([name, version]) => ({ name, version, purpose: '' })
      );
      const merged = mergeTechnologies(ctx.technologies, newTechnologies);
      if (merged.length !== ctx.technologies.length) {
        onUpdate({ projectContext: { ...ctx, technologies: merged } });
      }
    }

    // 2. Архитектура
    let architecture = { ...ctx.architecture };
    let archUpdated = false;
    if (!architecture.type && configFiles) {
      const hasForge =
        configFiles['forge.config.ts'] || configFiles['forge.config.js'];
      const hasVite =
        configFiles['vite.config.ts'] || configFiles['vite.main.config.ts'];
      if (hasForge && hasVite) architecture.type = 'Electron + Vite';
      else if (hasForge) architecture.type = 'Electron';
      else if (hasVite) architecture.type = 'Vite';
      if (architecture.type) archUpdated = true;
    }
    if (architecture.components.length === 0 && projectTree) {
      const rootDirs = projectTree
        .filter(
          (n) =>
            n.type === 'directory' &&
            !['node_modules', '.git', 'dist', 'out'].includes(n.name)
        )
        .map((n) => n.name);
      if (rootDirs.length > 0) {
        architecture.components = rootDirs;
        archUpdated = true;
      }
    }
    if (!architecture.interaction && configFiles?.['forge.config.ts']) {
      architecture.interaction = 'Main ↔ Preload ↔ Renderer через IPC';
      archUpdated = true;
    }
    // Обновляем архитектуру только если были изменения
    if (archUpdated) {
      onUpdate({ projectContext: { ...ctx, architecture } });
    }

    // 3. Интеграции (только известные пакеты-клиенты)
    const integrationCandidates = ['axios', 'express', 'fastify', 'socket.io', 'typeorm', 'prisma'];
    if (packageJson) {
      const deps = packageJson.dependencies || {};
      const newIntegrations: Integration[] = integrationCandidates
        .filter((pkg) => deps[pkg])
        .map((pkg) => ({ service: pkg, purpose: '' }));
      const merged = mergeIntegrations(ctx.integrations, newIntegrations);
      if (merged.length !== ctx.integrations.length) {
        onUpdate({ projectContext: { ...ctx, integrations: merged } });
      }
    }

    // 4. Стандарты
    const standards = [...ctx.standards];
    const addStandard = (s: string) => {
      if (!standards.includes(s)) standards.push(s);
    };
    if (configFiles?.['.eslintrc.json']) addStandard('ESLint');
    if (configFiles?.['.prettierrc'] || configFiles?.['.prettierrc.json']) addStandard('Prettier');
    if (standards.length !== ctx.standards.length) {
      onUpdate({ projectContext: { ...ctx, standards } });
    }

    // 5. Структура проекта с учётом .gitignore
    if (!ctx.fullProjectStructure.content && projectTree) {
      // Получаем содержимое .gitignore
      const gitignoreContent = configFiles?.['.gitignore'] as string | undefined;
      
      // Создаём фильтр ignore (или null, если файла нет)
      const ig = gitignoreContent ? ignore().add(gitignoreContent) : null;
      
      const rootName = packageJson?.name || 'project';
      const rootNode: TreeNode = {
        name: rootName,
        path: '.',
        type: 'directory',
        children: projectTree, // projectTree уже содержит детей корня из главного процесса
      };
      const content = treeToString([rootNode], '', ig);
      
      onUpdate({
        projectContext: {
          ...ctx,
          fullProjectStructure: {
            ...ctx.fullProjectStructure,
            type: 'tree',
            content,
            rootDirectory: '.',
            description: 'Автоматически загруженная структура проекта' + (ig ? ' (отфильтровано по .gitignore)' : ''),
          },
        },
      });
    }
      
  };

  const canFill = !!(packageJson || configFiles || projectTree);

  return (
    <section className="p-mb-6">
      <div className="flex align-items-center justify-content-between mb-4 mt-4">
        <h3 className="font-medium text-lg">Контекст проекта</h3>
        <div className="ml-1" style={{ minWidth: '100px' }}>
          <SelectButton
            value={isSectionEnabled}
            options={enabledOptions}
            onChange={(e) =>
              onUpdate({
                projectContext: {
                  ...template.projectContext,
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
          {/* Технологии */}
          <div className="mb-4 text-sm">
            <label className="block text-500 mb-2 font-medium">Технологии:</label>
            {template.projectContext.technologies.map((tech, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  placeholder="Название"
                  value={tech.name}
                  onChange={(e) => {
                    const updatedTechnologies = [...template.projectContext.technologies];
                    updatedTechnologies[index].name = e.target.value;
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        technologies: updatedTechnologies,
                      },
                    });
                  }}
                  className="w-full text-sm"
                />
                <InputText
                  placeholder="Версия"
                  value={tech.version || ''}
                  onChange={(e) => {
                    const updatedTechnologies = [...template.projectContext.technologies];
                    updatedTechnologies[index].version = e.target.value;
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        technologies: updatedTechnologies,
                      },
                    });
                  }}
                  className="w-full text-sm"
                />
                <InputText
                  placeholder="Назначение"
                  value={tech.purpose}
                  onChange={(e) => {
                    const updatedTechnologies = [...template.projectContext.technologies];
                    updatedTechnologies[index].purpose = e.target.value;
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        technologies: updatedTechnologies,
                      },
                    });
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updatedTechnologies = template.projectContext.technologies.filter(
                      (_, i) => i !== index
                    );
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        technologies: updatedTechnologies,
                      },
                    });
                  }}
                  aria-label="Удалить технологию"
                />
              </div>
            ))}
            <Button
              label="Добавить технологию"
              icon="pi pi-plus"
              onClick={() => {
                const newTech = { name: '', version: null, purpose: '' };
                onUpdate({
                  projectContext: {
                    ...template.projectContext,
                    technologies: [...template.projectContext.technologies, newTech],
                  },
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Архитектура */}
          <div className="mb-4 text-sm">
            <label className="block font-medium text-700 mb-2">Архитектура:</label>

            <div className="mb-3">
              <label className="block text-sm font-medium text-600 mb-1">Тип:</label>
              <InputText
                value={template.projectContext.architecture.type}
                onChange={(e) =>
                  onUpdate({
                    projectContext: {
                      ...template.projectContext,
                      architecture: {
                        ...template.projectContext.architecture,
                        type: e.target.value,
                      },
                    },
                  })
                }
                className="w-full text-sm"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-600 mb-1">
                Взаимодействие компонентов:
              </label>
              <Textarea
                value={template.projectContext.architecture.interaction}
                onChange={(e) =>
                  onUpdate({
                    projectContext: {
                      ...template.projectContext,
                      architecture: {
                        ...template.projectContext.architecture,
                        interaction: e.target.value,
                      },
                    },
                  })
                }
                rows={3}
                className="w-full text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-700 mb-2">Компоненты:</label>
              {template.projectContext.architecture.components.map((component, index) => (
                <div key={index} className="flex gap-2 mb-2 align-items-center">
                  <InputText
                    value={component}
                    onChange={(e) => {
                      const updatedComponents = [
                        ...template.projectContext.architecture.components,
                      ];
                      updatedComponents[index] = e.target.value;
                      onUpdate({
                        projectContext: {
                          ...template.projectContext,
                          architecture: {
                            ...template.projectContext.architecture,
                            components: updatedComponents,
                          },
                        },
                      });
                    }}
                    className="w-full text-sm"
                  />
                  <Button
                    icon="pi pi-times"
                    className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                    style={{ maxWidth: '46px' }}
                    onClick={() => {
                      const updatedComponents =
                        template.projectContext.architecture.components.filter(
                          (_, i) => i !== index
                        );
                      onUpdate({
                        projectContext: {
                          ...template.projectContext,
                          architecture: {
                            ...template.projectContext.architecture,
                            components: updatedComponents,
                          },
                        },
                      });
                    }}
                    aria-label="Удалить компонент"
                  />
                </div>
              ))}
              <Button
                label="Добавить компонент"
                icon="pi pi-plus"
                onClick={() => {
                  const updatedComponents = [
                    ...template.projectContext.architecture.components,
                    '',
                  ];
                  onUpdate({
                    projectContext: {
                      ...template.projectContext,
                      architecture: {
                        ...template.projectContext.architecture,
                        components: updatedComponents,
                      },
                    },
                  });
                }}
                className="p-button-accent p-button-sm mt-3"
              />
            </div>
          </div>

          {/* Интеграции */}
          <div className="mb-4 text-sm">
            <label className="block font-medium mb-2">Интеграции:</label>
            {template.projectContext.integrations.map((integration, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  placeholder="Сервис"
                  value={integration.service}
                  onChange={(e) => {
                    const updatedIntegrations = [...template.projectContext.integrations];
                    updatedIntegrations[index].service = e.target.value;
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        integrations: updatedIntegrations,
                      },
                    });
                  }}
                  className="w-full text-sm"
                />
                <InputText
                  placeholder="Назначение"
                  value={integration.purpose}
                  onChange={(e) => {
                    const updatedIntegrations = [...template.projectContext.integrations];
                    updatedIntegrations[index].purpose = e.target.value;
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        integrations: updatedIntegrations,
                      },
                    });
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updatedIntegrations = template.projectContext.integrations.filter(
                      (_, i) => i !== index
                    );
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        integrations: updatedIntegrations,
                      },
                    });
                  }}
                  aria-label="Удалить интеграцию"
                />
              </div>
            ))}
            <Button
              label="Добавить интеграцию"
              icon="pi pi-plus"
              onClick={() => {
                const newIntegration = { service: '', purpose: '' };
                onUpdate({
                  projectContext: {
                    ...template.projectContext,
                    integrations: [...template.projectContext.integrations, newIntegration],
                  },
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Стандарты */}
          <div className="mb-4 text-sm">
            <label className="block font-medium mb-2">Стандарты:</label>
            {template.projectContext.standards.map((standard, index) => (
              <div key={index} className="flex gap-2 mb-2 align-items-center">
                <InputText
                  value={standard}
                  onChange={(e) => {
                    const updatedStandards = [...template.projectContext.standards];
                    updatedStandards[index] = e.target.value;
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        standards: updatedStandards,
                      },
                    });
                  }}
                  className="w-full text-sm"
                />
                <Button
                  icon="pi pi-times"
                  className="p-button-accent p-button-xs ps-3 pe-3 pt-1 pb-1 w-1"
                  style={{ maxWidth: '46px' }}
                  onClick={() => {
                    const updatedStandards = template.projectContext.standards.filter(
                      (_, i) => i !== index
                    );
                    onUpdate({
                      projectContext: {
                        ...template.projectContext,
                        standards: updatedStandards,
                      },
                    });
                  }}
                  aria-label="Удалить стандарт"
                />
              </div>
            ))}
            <Button
              label="Добавить стандарт"
              icon="pi pi-plus"
              onClick={() => {
                const updatedStandards = [...template.projectContext.standards, ''];
                onUpdate({
                  projectContext: {
                    ...template.projectContext,
                    standards: updatedStandards,
                  },
                });
              }}
              className="p-button-accent p-button-sm mt-3"
            />
          </div>

          {/* Структура проекта */}
          <div className="mb-0 text-sm">
            <label className="block font-medium text-700 mb-2">Структура проекта:</label>
            <ProjectStructureComponent
              value={template.projectContext.fullProjectStructure}
              onChange={handleProjectStructureChange}
              gitignoreContent={(configFiles?.['.gitignore'] as string) || null}
            />
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
              onClick={buildFromConfigs}
              disabled={!canFill}
              className="p-button-sm p-button-accent"
              tooltip="Добавить технологии, архитектуру, интеграции и структуру из package.json, конфигов и дерева проекта"
              tooltipOptions={{ position: 'top' }}
            />
          </div>
        </div>
      )}
      <Divider />
    </section>
  );
};