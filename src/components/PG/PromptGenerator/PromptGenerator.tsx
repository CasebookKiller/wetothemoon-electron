import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';

// Исправленные импорты
import { CodeFileReference, CodeIndentation, CodeSnippet, CodeSourceType, createPromptTemplate, PromptTemplate, PromptTemplates, ResponseDepth, ResponseLength, Technology, TreeNode } from '@/types/promptgenerator';
import { PromptTemplateManager } from '@/services/promptTemplateManager'; // Предполагаемый путь
import { PromptEditorDialog } from './PromptEditorDialog'; // Импорт нового компонента

import './PromptGenerator.css';
import { TemplateSelectorDialog } from './TemplateSelectorDialog';
import { examplePromptTemplate } from './examples';

import { PackageJson } from '@/types/types'

const SELECTED_TEMPLATE_ID_KEY = 'selectedTemplateId';

const getSourceTypeLabel = (type: CodeSourceType): string => {
  switch (type) {
    case CodeSourceType.Snippet:
      return 'Один фрагмент';
    case CodeSourceType.MultipleSnippets:
      return 'Несколько фрагментов';
    case CodeSourceType.FilePaths:
      return 'Пути к файлам';
    default:
      return 'Неизвестный тип';
  }
};

const PromptGenerator: React.FC = () => {
  const [manager] = useState(new PromptTemplateManager());
  const [templates, setTemplates] = useState<PromptTemplates>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [isSettingsDialogVisible, setIsSettingsDialogVisible] = useState<boolean>(false);
  const [isTemplateSelectorVisible, setIsTemplateSelectorVisible] = useState<boolean>(false);

  const [packageJson, setPackageJson] = useState<PackageJson | null>(null);
  // состояние для хранения содержимого всех конфигов (ключ – имя файла, значение – содержимое)
  const [configFiles, setConfigFiles] = useState<Record<string, unknown>>({});

  const [projectTree, setProjectTree] = useState<TreeNode[]>([]); // Дерево проекта();

  const openTemplateSelector = () => setIsTemplateSelectorVisible(true);
  const closeTemplateSelector = () => setIsTemplateSelectorVisible(false);

  const handleTemplateSelection = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      // Сохраняем ID выбранного шаблона в localStorage
      localStorage.setItem(SELECTED_TEMPLATE_ID_KEY, templateId);
    }
  };

  const initializeWithExamples = () => {
    const hasExample = manager.findPromptById(examplePromptTemplate.id);
    if (!hasExample) {
      manager.createPrompt(examplePromptTemplate);
      console.log('Добавлен пример шаблона в менеджер');
    }
  };

  useEffect(() => {
    const electronAPI = (window as any)?.electronAPI;
    
    if (!electronAPI) return;
     
    if (electronAPI?.getProjectTreeJson) {
      // 1. Получаем дерево проекта
      electronAPI.getProjectTreeJson()
        .then((tree: TreeNode[]) => {
          // Сохраняем дерево проекта в состояние
          setProjectTree(tree);
          console.log('tree: ', tree);
          // Ищем только файлы в корне (не в папках)
          const rootConfigFiles = tree.filter(
            (n) => n.type === 'file' && n.category === 'config'
          );

          // Загружаем каждый конфиг и складируем в состояние
          const loadPromises = rootConfigFiles.map(async (fileNode) => {
            const fileName = fileNode.name;
            // JSON‑файлы парсим, остальные читаем как строку
            const isJson = fileName.endsWith('.json');
            try {
              const content = await electronAPI.getConfigFile(fileName, isJson);
              return { [fileName]: content };
            } catch {
              console.warn(`Не удалось загрузить ${fileName}`);
              return { [fileName]: null };
            }
          });

          Promise.all(loadPromises)
            .then((results) => {
              const merged = Object.assign({}, ...results);
              setConfigFiles(merged);
              console.log('merged: ', merged);
              // Отдельно сохраняем package.json для удобства
              const pkg = merged['package.json'] as PackageJson | null;
              if (pkg && typeof pkg === 'object') {
                setPackageJson(pkg);
              }
            })
            .catch(console.error);
        })
        .catch((err: any) => console.error('Ошибка получения дерева проекта:', err));
    }
    
    if (electronAPI?.getConfigFile) {
      // Загружаем tsconfig.json
      electronAPI.getConfigFile('tsconfig.json', true)
        .then((tsconfig: any) => console.log('tsconfig.json:', tsconfig))
        .catch((err: unknown) => console.error('Не удалось загрузить tsconfig.json:', err));
      // Загружаем vite.config.ts
      //electronAPI.getConfigFile('vite.config.ts', false)
      //  .then((viteConfigRaw: any) => console.log('vite.config.ts:', viteConfigRaw))
      //  .catch((err: unknown) => console.error('Не удалось загрузить vite.config.ts:', err));
      // Загружаем .eslintrc.json
      electronAPI.getConfigFile('.eslintrc.json', true)
        .then((eslintConfig: any) => console.log('.eslintrc.json:', eslintConfig))
        .catch((err: unknown) => console.error('Не удалось загрузить .eslintrc.json:', err));
    }

    if (electronAPI?.getPackageJson) {
      electronAPI.getPackageJson()
        .then((pkg: PackageJson) => setPackageJson(pkg))
        .catch((err: unknown) => console.error('Не удалось загрузить package.json:', err));
    }
    
  }, []);

  // Обновляем список шаблонов при изменении менеджера
  useEffect(() => {
    initializeWithExamples();
    const managerTemplates = manager.getAllPrompts();
    const allTemplates = [examplePromptTemplate, ...managerTemplates];

    // Фильтруем дубликаты: оставляем первый встретившийся с данным ID
    const uniqueTemplates = allTemplates.reduce<PromptTemplate[]>((acc, current) => {
      const x = acc.find(item => item.id === current.id);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, []);

    setTemplates(uniqueTemplates);

    // Загружаем ID выбранного шаблона из localStorage
    const savedTemplateId = localStorage.getItem(SELECTED_TEMPLATE_ID_KEY);
    let initialTemplate: PromptTemplate | null = null;

    if (savedTemplateId) {
      // Ищем шаблон с сохранённым ID
      initialTemplate = uniqueTemplates.find(t => t.id === savedTemplateId) || null;
    }

    // Если шаблон не найден или ID не был сохранён, берём первый из списка или пример
    if (!initialTemplate) {
      initialTemplate = uniqueTemplates.length > 0 ? uniqueTemplates[0] : examplePromptTemplate;
    }

    setSelectedTemplate(initialTemplate);
  }, [manager]);


  useEffect(() => {
    if (selectedTemplate) {
      setGeneratedPrompt(generateFullPrompt(selectedTemplate));
    }
  }, [selectedTemplate]);

  const generateFullPrompt = (template: PromptTemplate): string => {
    if (!template.id) {
      console.warn('Обнаружен шаблон без ID, используем пример');
      return generateFullPrompt(examplePromptTemplate);
    }

    let promptParts: string[] = [];

    // ----- Основная информация -----
    if (template.title) promptParts.push(`Название: ${template.title}`);
    if (template.description) promptParts.push(`Описание: ${template.description}`);
    if (template.version) promptParts.push(`Версия: ${template.version}`);

    // ----- Роль -----
    if (template.role?.enabled) {
      const r = template.role;
      const lines: string[] = [];
      if (r.position) lines.push(`- Позиция: ${r.position}`);
      if (r.experience) lines.push(`- Опыт: ${r.experience}`);
      if (r.specialization) lines.push(`- Специализация: ${r.specialization}`);
      if (r.communicationStyle) lines.push(`- Стиль общения: ${r.communicationStyle}`);
      if (r.priorities.length > 0) lines.push(`- Приоритеты: ${r.priorities.join(', ')}`);
      if (lines.length > 0) {
        promptParts.push('Роль:', ...lines);
      }
    }

    // ----- Контекст проекта -----
    if (template.projectContext?.enabled) {
      const ctx = template.projectContext;
      const lines: string[] = [];

      const techs = ctx.technologies
        .filter(t => t.name)
        .map(t => `${t.name}${t.version ? ' ' + t.version : ''}${t.purpose ? ': ' + t.purpose : ''}`)
        .join(', ');
      if (techs) lines.push(`- Технологии: ${techs}`);

      const archComponents = ctx.architecture.components.join(', ');
      if (ctx.architecture.type || archComponents) {
        lines.push(`- Архитектура: тип ${ctx.architecture.type || 'не указан'}, компоненты [${archComponents || 'Не указаны'}]`);
        if (ctx.architecture.interaction) lines.push(`  Взаимодействие: ${ctx.architecture.interaction}`);
      }

      const integ = ctx.integrations
        .filter(i => i.service)
        .map(i => `${i.service}${i.purpose ? ' (' + i.purpose + ')' : ''}`)
        .join(', ');
      if (integ) lines.push(`- Интеграции: ${integ}`);

      const std = ctx.standards.join(', ');
      if (std) lines.push(`- Стандарты: ${std}`);

      const ps = ctx.fullProjectStructure;
      if (ps?.content || ps?.rootDirectory || ps?.description) {
        lines.push('- Структура проекта:');
        if (ps.rootDirectory) lines.push(`  Корень: ${ps.rootDirectory}`);
        if (ps.type) lines.push(`  Формат: ${ps.type}`);
        if (ps.description) lines.push(`  Описание: ${ps.description}`);
        if (ps.content) lines.push(`  Содержимое:\n${ps.content}`);
      }

      if (lines.length > 0) {
        promptParts.push('Контекст проекта:', ...lines);
      }
    }

    // ----- Задача и ожидания -----
    if (template.taskAndExpectations?.enabled) {
      const t = template.taskAndExpectations;
      const lines: string[] = [];
      if (t.mainTask) lines.push(`- Основная задача: ${t.mainTask}`);
      if (t.expectedResult) lines.push(`- Ожидаемый результат: ${t.expectedResult}`);
      if (t.codeRequirements.length > 0) lines.push(`- Требования к коду: ${t.codeRequirements.join(', ')}`);
      if (t.outputFormat) lines.push(`- Формат вывода: ${t.outputFormat}`);
      if (lines.length > 0) {
        promptParts.push('Задача и ожидания:', ...lines);
      }
    }

    // ----- Технические требования -----
    if (template.technicalRequirements?.enabled) {
      const tr = template.technicalRequirements;
      const lines: string[] = [];
      if (tr.compatibility.length > 0) lines.push(`- Совместимость: ${tr.compatibility.join(', ')}`);
      if (tr.dataHandling.length > 0) lines.push(`- Обработка данных: ${tr.dataHandling.join(', ')}`);
      if (tr.security.length > 0) lines.push(`- Безопасность: ${tr.security.join(', ')}`);
      if (tr.performance.length > 0) lines.push(`- Производительность: ${tr.performance.join(', ')}`);
      if (lines.length > 0) {
        promptParts.push('Технические требования:', ...lines);
      }
    }

    // ----- Структура ответа -----
    if (template.responseStructure?.enabled) {
      const rs = template.responseStructure;
      const lines: string[] = [];
      const requiredSections = rs.sections.filter(s => s.required);
      if (requiredSections.length > 0) {
        lines.push(...requiredSections.map(s => `${s.name}:\n${s.format}`));
      }
      const cf = rs.codeFormat;
      if (cf.syntax) lines.push(`- Синтаксис: ${cf.syntax}`);
      if (cf.indentation) lines.push(`- Отступы: ${cf.indentation}`);
      if (cf.namingConvention) lines.push(`- Соглашение об именах: ${cf.namingConvention}`);
      if (lines.length > 0) {
        promptParts.push('Структура ответа:', ...lines);
      }
    }

    // ----- Особые сценарии -----
    if (template.specialScenarios?.enabled) {
      const ss = template.specialScenarios;
      const lines: string[] = [];
      if (ss.errorHandling) lines.push(`- Обработка ошибок: ${ss.errorHandling}`);
      if (ss.testing) lines.push(`- Тестирование: ${ss.testing}`);
      if (ss.scalability) lines.push(`- Масштабируемость: ${ss.scalability}`);
      if (ss.alternativeApproaches) lines.push(`- Альтернативные подходы: ${ss.alternativeApproaches}`);
      if (lines.length > 0) {
        promptParts.push('Особые сценарии:', ...lines);
      }
    }

    // ----- Ограничения и правила -----
    if (template.restrictionsAndRules?.enabled) {
      const rr = template.restrictionsAndRules;
      const lines: string[] = [];
      if (rr.forbiddenPractices.length > 0) lines.push(`- Запрещённые практики: ${rr.forbiddenPractices.join(', ')}`);
      if (rr.dependenciesPolicy) lines.push(`- Политика зависимостей: ${rr.dependenciesPolicy}`);
      if (rr.compliance.length > 0) lines.push(`- Соответствие стандартам: ${rr.compliance.join(', ')}`);
      if (rr.environmentConsiderations.length > 0) lines.push(`- Учёт окружения: ${rr.environmentConsiderations.join(', ')}`);
      if (lines.length > 0) {
        promptParts.push('Ограничения и правила:', ...lines);
      }
    }

    // ----- Дополнительные предпочтения -----
    if (template.additionalPreferences?.enabled) {
      const ap = template.additionalPreferences;
      const lines: string[] = [];
      if (ap.tone) lines.push(`- Тон: ${ap.tone}`);
      if (ap.length) lines.push(`- Длина: ${ap.length}`);
      if (ap.preferredPatterns.length > 0) lines.push(`- Предпочитаемые паттерны: ${ap.preferredPatterns.join(', ')}`);
      if (ap.specialEmphases.length > 0) lines.push(`- Особые акценты: ${ap.specialEmphases.join(', ')}`);
      if (lines.length > 0) {
        promptParts.push('Дополнительные предпочтения:', ...lines);
      }
    }

    // ----- Контекст кода (без изменений в логике, только обработаем пустые подпункты) -----
    if (template.codeContext?.enabled) {
      const cc = template.codeContext;
      const lines: string[] = [];
      lines.push(`- Язык: ${cc.language || 'Не указан'}`);
      lines.push(`- Тип источника: ${getSourceTypeLabel(cc.sourceType || CodeSourceType.Snippet)}`);

      const safeCodeSources = cc.codeSources || [];

      if (cc.sourceType === CodeSourceType.Snippet) {
        lines.push(`- Процесс: ${cc.process || 'Не указан'}`);
        lines.push(`- Цель: ${cc.purpose || 'Не указана'}`);
        lines.push(`- Зависимости: ${cc.dependencies?.join(', ') || 'Не указаны'}`);
        lines.push(`- Описание проблемы: ${cc.problemDescription || 'Не указана'}`);
        if (typeof safeCodeSources === 'string') {
          lines.push('- Фрагмент кода:');
          lines.push(safeCodeSources.trim() || '(фрагмент кода не указан)');
        }
      } else if (cc.sourceType === CodeSourceType.MultipleSnippets) {
        const snippets = Array.isArray(safeCodeSources) ? safeCodeSources as CodeSnippet[] : [];
        if (snippets.length > 0) {
          lines.push('- Фрагменты кода:');
          snippets.forEach((snippet, index) => {
            lines.push(`  Фрагмент ${index + 1}:`);
            if (snippet.code?.trim()) {
              lines.push(`    Код:\n${snippet.code}`);
            } else {
              lines.push('    Код: (не указан)');
            }
            if (snippet.purpose?.trim()) lines.push(`    Назначение: ${snippet.purpose}`);
            if (snippet.process) lines.push(`    Процесс: ${snippet.process}`);
            if (snippet.dependencies?.length) lines.push(`    Зависимости: ${snippet.dependencies.join(', ')}`);
            if (snippet.problemDescription?.trim()) lines.push(`    Описание проблемы: ${snippet.problemDescription}`);
          });
        } else {
          lines.push('- Фрагменты кода: (не указаны)');
        }
      } else if (cc.sourceType === CodeSourceType.FilePaths) {
        const files = Array.isArray(safeCodeSources) ? safeCodeSources as CodeFileReference[] : [];
        if (files.length > 0) {
          lines.push('- Пути к файлам:');
          files.forEach((file, index) => {
            lines.push(`  Файл ${index + 1}:`);
            if (file.path?.trim()) {
              lines.push(`    Путь: ${file.path}`);
            } else {
              lines.push('    Путь: (не указан)');
            }
            if (file.purpose?.trim()) lines.push(`    Назначение: ${file.purpose}`);
            if (file.process) lines.push(`    Процесс: ${file.process}`);
            if (file.problemDescription?.trim()) lines.push(`    Описание проблемы: ${file.problemDescription}`);
          });
        } else {
          lines.push('- Пути к файлам: (не указаны)');
        }
      }
      promptParts.push('Контекст кода:', ...lines);
    }

    // ----- Контекст разработки -----
    if (template.developmentContext?.enabled) {
      const dc = template.developmentContext;
      const lines: string[] = [];
      if (dc.buildProcess) lines.push(`- Сборка: ${dc.buildProcess}`);
      if (dc.deploymentStrategy) lines.push(`- Деплой: ${dc.deploymentStrategy}`);

      const bs = dc.backendStructure;
      if (bs && (bs.type || bs.rootDirectory || bs.description || bs.content)) {
        lines.push('- Структура бэкенда:');
        if (bs.type) lines.push(`  Тип: ${bs.type}`);
        if (bs.rootDirectory) lines.push(`  Корень: ${bs.rootDirectory}`);
        if (bs.description) lines.push(`  Описание: ${bs.description}`);
        if (bs.content) lines.push(`  Содержимое:\n${bs.content}`);
      }
      if (lines.length > 0) {
        promptParts.push('Контекст разработки:', ...lines);
      }
    }

    // Финальная очистка: убираем пустые строки и объединяем двойными переносами
    return promptParts.filter(part => part.trim()).join('\n\n').trim();
  };
  
  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    console.log('Выбран шаблон:', template);
    if (template) {
      setSelectedTemplate(template);
    }
  };

  const openSettingsDialog = () => {
    // Если нет выбранного шаблона, используем первый из списка или пример
    let templateToUse = selectedTemplate;
    console.log('Настройки шаблона:', templateToUse);

    if (!templateToUse) {
      templateToUse = templates.length > 0 ? templates[0] : examplePromptTemplate;
      setSelectedTemplate(templateToUse);
    }

    setIsSettingsDialogVisible(true);
  };

  const closeSettingsDialog = () => setIsSettingsDialogVisible(false);

  const handleSaveTemplate = (updatedTemplate: PromptTemplate) => {
    console.log('Сохраняем шаблон:', updatedTemplate);

    const templateWithUpdatedTime = {
      ...updatedTemplate,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    let success = false;

    // Если это пример — создаём новый шаблон
    if (updatedTemplate.id === examplePromptTemplate.id) {
      const newTemplate = manager.createPrompt({
        ...templateWithUpdatedTime,
        // Гарантируем уникальный ID
        id: crypto.randomUUID ? crypto.randomUUID() : `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
      setSelectedTemplate(newTemplate);
      success = true;
      // Сохраняем новый ID в localStorage
      localStorage.setItem(SELECTED_TEMPLATE_ID_KEY, newTemplate.id);
    } else {
      // Для обычных шаблонов обновляем через менеджер
      success = manager.updatePrompt(templateWithUpdatedTime.id, templateWithUpdatedTime);
      if (success) {
        // Обновляем localStorage, если это текущий выбранный шаблон
        if (selectedTemplate?.id === templateWithUpdatedTime.id) {
          localStorage.setItem(SELECTED_TEMPLATE_ID_KEY, templateWithUpdatedTime.id);
        }
      }
    }

    if (success) {
      setGeneratedPrompt(generateFullPrompt(templateWithUpdatedTime));
      setTemplates(prev => prev.map(t =>
        t.id === templateWithUpdatedTime.id ? templateWithUpdatedTime : t
      ));
      closeSettingsDialog();
      console.log('Шаблон успешно сохранён');
    } else {
      console.error('Не удалось сохранить шаблон:', templateWithUpdatedTime.id);
      alert('Ошибка сохранения шаблона. Проверьте консоль.');
    }
  };


  const handleAddNewTemplate = () => {
    const newTemplate = manager.createPrompt();
    setSelectedTemplate(newTemplate);
    setTemplates(prev => [...prev, newTemplate]);
  };

  // Получаем безопасный шаблон для передачи в диалог
  const getSafeTemplateForDialog = (): PromptTemplate => {
    const template = selectedTemplate || templates[0] || examplePromptTemplate;
    console.log('Возвращаем шаблон для диалога:', template);
    return template;
  };

  const handleSaveToFile = async () => {
    if (!selectedTemplate) {
      alert('Сначала выберите шаблон для сохранения');
      return;
    }

    try {
      const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
      // Вызываем IPC‑обработчик в main процессе
      const result = await electronAPI.ipcRenderer.invoke(
        'save-prompt-template',
        selectedTemplate
      );

      if (result.success) {
        alert(`Шаблон успешно сохранён:\n${result.filePath}`);
      } else {
        alert(`Ошибка сохранения: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка IPC вызова:', error);
      alert('Не удалось сохранить шаблон. Проверьте консоль.');
    }
  };

  const handleLoadFromFile = async () => {
    try {
      // Вызываем IPC‑обработчик в main процессе
      const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
      const result = await electronAPI.ipcRenderer.invoke('load-prompt-template');

      if (result.success) {
        const loadedTemplate = result.template;

        // Проверяем, существует ли уже шаблон с таким ID
        const existingTemplate = templates.find(t => t.id === loadedTemplate.id);

        if (existingTemplate) {
          // Если шаблон с таким ID уже есть, создаём копию с новым ID
          const newTemplate = createPromptTemplate({
            ...loadedTemplate,
            id: crypto.randomUUID ? crypto.randomUUID() : `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: `${loadedTemplate.title} (загружено)`
          });

          const success = manager.createPrompt(newTemplate);
          if (success) {
            setSelectedTemplate(newTemplate);
            setTemplates(prev => [...prev, newTemplate]);
            alert(`Шаблон "${newTemplate.title}" успешно загружен и добавлен как копия!`);
          }
        } else {
          // Добавляем шаблон как есть
          const success = manager.createPrompt(loadedTemplate);
          if (success) {
            setSelectedTemplate(loadedTemplate);
            setTemplates(prev => [...prev, loadedTemplate]);
            alert(`Шаблон "${loadedTemplate.title}" успешно загружен!`);
          }
        }
      } else {
        alert(`Ошибка загрузки: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка IPC вызова при загрузке:', error);
      alert('Не удалось загрузить шаблон. Проверьте консоль.');
    }
  };

  const handleCopyTemplate = () => {
    if (!selectedTemplate) {
      alert('Сначала выберите шаблон для копирования');
      return;
    }

    let newTitle = `${selectedTemplate.title} (копия)`;
    let counter = 1;

    // Проверяем, существует ли уже шаблон с таким названием
    while (templates.some(t => t.title === newTitle)) {
      counter++;
      newTitle = `${selectedTemplate.title} (копия ${counter})`;
    }

    const copiedTemplate = createPromptTemplate({
      ...selectedTemplate,
      id: crypto.randomUUID ? crypto.randomUUID() : `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newTitle,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    });

    const success = manager.createPrompt(copiedTemplate);

    if (success) {
      setSelectedTemplate(copiedTemplate);
      setTemplates(prev => [...prev, copiedTemplate]);
      alert(`Шаблон "${newTitle}" успешно создан!`);
    } else {
      console.error('Не удалось скопировать шаблон');
      alert('Ошибка при копировании шаблона. Проверьте консоль.');
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    const templateToDelete = templates.find(t => t.id === templateId);

    if (!templateToDelete) return;

    // Удаляем из менеджера
    const success = manager.deletePrompt(templateId);

    if (success) {
      // Обновляем состояние
      setTemplates(prev => prev.filter(t => t.id !== templateId));

      // Если удалённый шаблон был выбран, выбираем другой
      if (selectedTemplate?.id === templateId) {
        // Находим первый шаблон, который не удаляем
        const remainingTemplates = templates.filter(t => t.id !== templateId);
        let newSelected: PromptTemplate | null = null;

        if (remainingTemplates.length > 0) {
          // Берём первый оставшийся шаблон
          newSelected = remainingTemplates[0];
          // Сохраняем новый выбранный ID в localStorage
          localStorage.setItem(SELECTED_TEMPLATE_ID_KEY, newSelected.id);
        } else {
          // Если шаблонов не осталось, используем пример
          newSelected = examplePromptTemplate;
          // Сохраняем ID примера в localStorage
          localStorage.setItem(SELECTED_TEMPLATE_ID_KEY, examplePromptTemplate.id);
        }

        setSelectedTemplate(newSelected);
      } else {
        // Если удаляемый шаблон не был выбран, просто удаляем его ID из localStorage, если он там есть
        const savedId = localStorage.getItem(SELECTED_TEMPLATE_ID_KEY);
        if (savedId === templateId) {
          localStorage.removeItem(SELECTED_TEMPLATE_ID_KEY);
        }
      }

      alert(`Шаблон "${templateToDelete.title}" успешно удалён!`);
    } else {
      console.error('Не удалось удалить шаблон:', templateId);
      alert('Ошибка при удалении шаблона. Проверьте консоль.');
    }
  };
  
  useEffect(() => {
    if (selectedTemplate) {
      setGeneratedPrompt(generateFullPrompt(selectedTemplate));
    }
  }, [
    selectedTemplate,
    selectedTemplate?.role?.enabled,
    selectedTemplate?.projectContext?.enabled,
    selectedTemplate?.taskAndExpectations?.enabled,
    selectedTemplate?.technicalRequirements?.enabled,
    selectedTemplate?.responseStructure?.enabled,
    selectedTemplate?.specialScenarios?.enabled,
    selectedTemplate?.restrictionsAndRules?.enabled,
    selectedTemplate?.additionalPreferences?.enabled,
    selectedTemplate?.codeContext?.enabled,
    selectedTemplate?.developmentContext?.enabled
  ]);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Генератор промтов для LLM</h1>

      {/* Выпадающий список для выбора шаблона */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Button
          label={selectedTemplate ? selectedTemplate.title : "Выберите шаблон"}
          icon="pi pi-list"
          onClick={openTemplateSelector}
          className="p-button-accent p-button-lg"
          style={{
            width: '100%',
            fontSize: '16px',
            padding: '12px 16px'
          }}
        />
      </div>

      {/* Кнопки управления */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <Button
          label="Настройки промта"
          icon="pi pi-cog"
          onClick={openSettingsDialog}
          className="p-button-accent"
        />
        <Button
          label="Новый шаблон"
          icon="pi pi-plus"
          onClick={handleAddNewTemplate}
          className="p-button-accent"
        />
        <Button
          label="Копировать текущий"
          icon="pi pi-copy"
          onClick={handleCopyTemplate}
          className="p-button-accent"
          disabled={!selectedTemplate}
        />
      </div>

      {/* Предпросмотр промта */}
      <div
        style={{
          border: '1px solid #ddd',
          padding: '5px',
          textAlign: 'center'
        }}
      >
        <h4 className='p-1 m-2'>Предпросмотр промта</h4>
        <Button
          label="Обновить"
          icon="pi pi-refresh"
          onClick={() => selectedTemplate && setGeneratedPrompt(generateFullPrompt(selectedTemplate))}
          className="p-button-accent"
        />
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: '#3b3b3b',
            color: 'white',
            padding: '15px',
            maxHeight: '300px',
            overflowY: 'auto',
            textAlign: 'left',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}
        >
          {generatedPrompt || 'Выберите шаблон или создайте новый'}
        </pre>
      </div>

      {/* Диалоговое окно настроек */}
      <PromptEditorDialog
        visible={isSettingsDialogVisible}
        onHide={closeSettingsDialog}
        template={getSafeTemplateForDialog()}
        onSave={handleSaveTemplate}  // <-- здесь используется handleSaveTemplate
        packageJson={packageJson}
        configFiles={configFiles}
        projectTree={projectTree}
      />

      {/* Диалоговое окно выбора шаблона */}
      <TemplateSelectorDialog
        visible={isTemplateSelectorVisible}
        templates={templates}
        selectedTemplateId={selectedTemplate?.id || null}
        onSelect={handleTemplateSelection}
        onCreateNew={handleAddNewTemplate}
        onDelete={handleDeleteTemplate} // Передаём функцию удаления
        onHide={closeTemplateSelector}
      />

      <div className='flex gap-2' style={{ marginTop: '20px', textAlign: 'center' }}>
        <Button
          label="Загрузить из файла"
          icon="pi pi-upload"
          onClick={handleLoadFromFile}
          className="p-button-accent"
          tooltip="Загрузить шаблон промта из JSON‑файла"
          tooltipOptions={{ position: 'top' }}
        />
        <Button
          label="Сохранить в файл"
          icon="pi pi-download"
          onClick={handleSaveToFile}
          className="p-button-accent"
        />

      </div>

    </div>
  );
};

export default PromptGenerator;
