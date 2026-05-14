import React, { useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea as Textarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { ProjectStructure, TreeNode } from '@/types/promptgenerator';
import { selectFolder } from '@/utils/ipcUtils';
import ignore from 'ignore';

// Дефолтное значение структуры проекта
const DEFAULT_PROJECT_STRUCTURE: ProjectStructure = {
  type: 'tree',
  rootDirectory: '',
  content: '',
  description: '',
};

const PROJECT_TYPE_OPTIONS = [
  { label: 'Дерево', value: 'tree' },
  { label: 'Список', value: 'list' },
  { label: 'Диаграмма', value: 'diagram' },
];

interface ProjectStructureComponentProps {
  value: ProjectStructure | undefined;
  onChange: (value: ProjectStructure) => void;
  gitignoreContent?: string | null;
}

/**
 * Преобразует массив TreeNode в текстовое дерево с фильтром .gitignore
 */
function treeToString(
  nodes: TreeNode[],
  prefix = '',
  igFilter: ReturnType<typeof ignore> | null = null,
  isRoot = true
): string {
  let result = '';
  const filtered = igFilter
    ? nodes.filter((node) => !igFilter.ignores(node.path))
    : nodes;

  for (let i = 0; i < filtered.length; i++) {
    const node = filtered[i];
    const isLast = i === filtered.length - 1;
    
    if (isRoot) {
      // Корневой элемент без отступов и символов
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

export const ProjectStructureComponent: React.FC<ProjectStructureComponentProps> = ({
  value,
  onChange,
  gitignoreContent,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const displayValue = value || DEFAULT_PROJECT_STRUCTURE;

  const handleFieldChange = <K extends keyof ProjectStructure>(
    field: K,
    newValue: ProjectStructure[K]
  ) => {
    onChange({ ...displayValue, [field]: newValue });
  };

  // Единый метод получения и форматирования дерева
  const fetchAndDisplayTree = async (folderPath: string) => {
    const electronAPI = (window as any)?.electronAPI;
    if (!electronAPI?.getProjectTreeJson) {
      throw new Error('Метод getProjectTreeJson недоступен');
    }
    // Получаем содержимое выбранной папки
    const nodes: TreeNode[] = await electronAPI.getProjectTreeJson(folderPath);
    
    // Создаём корневой узел – сама выбранная папка
    const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
    const rootNode: TreeNode = {
      name: folderName,
      path: folderPath,
      type: 'directory',
      children: nodes,
    };
    
    const ig = gitignoreContent ? ignore().add(gitignoreContent) : null;
    // Передаём массив из одного корневого узла
    return treeToString([rootNode], '', ig);
  };

  const fetchProjectTreeWithDialog = async () => {
    try {
      setIsLoading(true);
      const selectedFolder = await selectFolder();
      if (!selectedFolder) return;

      const content = await fetchAndDisplayTree(selectedFolder);
      onChange({
        ...displayValue,
        type: displayValue.type || 'tree',
        rootDirectory: selectedFolder,
        content,
        description:
          `Структура папки: ${selectedFolder}` +
          (gitignoreContent ? ' (с фильтром .gitignore)' : ''),
      });
    } catch (error) {
      alert('Ошибка получения структуры папки');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProjectTree = async () => {
    if (!displayValue.rootDirectory) {
      alert('Сначала выберите папку');
      return;
    }
    try {
      setIsLoading(true);
      const content = await fetchAndDisplayTree(displayValue.rootDirectory);
      onChange({
        ...displayValue,
        content,
        description:
          `Обновлённая структура: ${displayValue.rootDirectory}` +
          (gitignoreContent ? ' (с фильтром .gitignore)' : ''),
      });
    } catch (error) {
      alert('Ошибка обновления структуры');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="p-mb-2">
      <FieldWrapper label="Формат">
        <Dropdown
          value={displayValue.type}
          options={PROJECT_TYPE_OPTIONS}
          onChange={(e) => handleFieldChange('type', e.value)}
          placeholder="Выберите формат"
          className="w-full text-sm"
        />
      </FieldWrapper>

      <FieldWrapper label="Корневая директория">
        <InputText
          value={displayValue.rootDirectory}
          onChange={(e) => handleFieldChange('rootDirectory', e.target.value)}
          placeholder="my-project"
          className="w-full text-sm"
          readOnly
        />
        <Button
          label={isLoading ? 'Получение структуры...' : 'Выбрать папку'}
          icon={isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-folder'}
          onClick={fetchProjectTreeWithDialog}
          disabled={isLoading}
          className={`p-button-accent-outlined p-button-sm mt-2 ${isLoading ? 'p-button-warning' : ''}`}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        />
      </FieldWrapper>

      <div className="mb-4 text-sm">
        <label className="block font-medium text-700 mb-2">Содержание:</label>
        <div className="flex gap-2 mb-2">
          <Button
            label={isLoading ? 'Обновление...' : 'Обновить структуру'}
            icon={isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
            onClick={refreshProjectTree}
            disabled={isLoading || !displayValue.rootDirectory}
            className={`p-button-accent-outlined p-button-sm ${isLoading ? 'p-button-warning' : ''}`}
            style={{ padding: '4px 8px', fontSize: '12px' }}
            title={!displayValue.rootDirectory ? 'Сначала выберите папку' : 'Обновить структуру'}
          />
        </div>
        <Textarea
          value={displayValue.content}
          onChange={(e) => handleFieldChange('content', e.target.value)}
          rows={6}
          placeholder="Введите структуру проекта..."
          className="w-full text-sm font-mono mt-2"
        />
      </div>

      <FieldWrapper label="Описание" className="mb-0 text-sm">
        <Textarea
          value={displayValue.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          rows={3}
          placeholder="Краткое описание..."
          className="w-full text-sm"
        />
      </FieldWrapper>
    </section>
  );
};

const FieldWrapper: React.FC<{
  label: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, children, className }) => (
  <div className={className || 'mb-4 text-sm'}>
    <label className="block font-medium text-700 mb-2">{label}</label>
    {children}
  </div>
);

/*import React, { useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea as Textarea } from 'primereact/inputtextarea';
import { ProjectStructure } from '@/types/promptgenerator';
import { getProjectTree, selectFolder } from '@/utils/ipcUtils';
import { Button } from 'primereact/button';

// Дефолтное значение структуры проекта
const DEFAULT_PROJECT_STRUCTURE: ProjectStructure = {
  type: 'tree',
  rootDirectory: '',
  content: '',
  description: ''
};

// Опции для Dropdown
const PROJECT_TYPE_OPTIONS = [
  { label: 'Дерево', value: 'tree' },
  { label: 'Список', value: 'list' },
  { label: 'Диаграмма', value: 'diagram' }
];

interface ProjectStructureComponentProps {
  value: ProjectStructure | undefined;
  onChange: (value: ProjectStructure) => void;
}

export const ProjectStructureComponent: React.FC<ProjectStructureComponentProps> = ({
  value,
  onChange
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Используем дефолтное значение, если value undefined
  const displayValue: ProjectStructure = value || DEFAULT_PROJECT_STRUCTURE;

  // Универсальный обработчик изменений полей
  const handleFieldChange = <K extends keyof ProjectStructure>(
    field: K,
    newValue: ProjectStructure[K]
  ) => {
    onChange({
      ...displayValue,
      [field]: newValue
    });
  };

  // Обработчик выбора папки и получения структуры (с диалоговым окном)
  const fetchProjectTreeWithDialog = async () => {
    try {
      setIsLoading(true);

      const selectedFolder = await selectFolder();
      if (!selectedFolder) return;

      const treeOutput = await getProjectTree(selectedFolder);

      onChange({
        ...displayValue,
        type: displayValue.type || 'tree',
        rootDirectory: selectedFolder,
        content: treeOutput,
        description: `Автоматически сгенерированная структура папки: ${selectedFolder}`
      });
    } catch (error) {
      alert('Не удалось получить структуру папки. Проверьте путь и права доступа.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик обновления структуры без диалогового окна (использует текущую rootDirectory)
  const refreshProjectTree = async () => {
    if (!displayValue.rootDirectory) {
      alert('Сначала выберите папку для анализа');
      return;
    }

    try {
      setIsLoading(true);
      const treeOutput = await getProjectTree(displayValue.rootDirectory);

      onChange({
        ...displayValue,
        content: treeOutput,
        description: `Обновлённая структура папки: ${displayValue.rootDirectory}`
      });
    } catch (error) {
      alert('Не удалось обновить структуру папки. Проверьте доступность папки.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="p-mb-2">
      {
        // Формат
      }
      <FieldWrapper label="Формат">
        <Dropdown
          value={displayValue.type}
          options={PROJECT_TYPE_OPTIONS}
          onChange={(e) => handleFieldChange('type', e.value)}
          placeholder="Выберите формат"
          className="w-full text-sm"
        />
      </FieldWrapper>

      {
        // Корневая директория
      }
      <FieldWrapper label="Корневая директория">
        <InputText
          value={displayValue.rootDirectory}
          onChange={(e) => handleFieldChange('rootDirectory', e.target.value)}
          placeholder="my-project"
          className="w-full text-sm"
          readOnly
        />
        <Button
          label={isLoading ? "Получение структуры..." : "Выбрать папку"}
          icon={isLoading ? "pi pi-spin pi-spinner" : "pi pi-folder"}
          onClick={fetchProjectTreeWithDialog}
          disabled={isLoading}
          className={`p-button-accent-outlined p-button-sm mt-2 ${isLoading ? 'p-button-warning' : ''}`}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        />
      </FieldWrapper>

      {
        // Содержание
      }
      <div className="mb-4 text-sm">
        <label className="block font-medium text-700 mb-2 flex items-center gap-2">
          Содержание:
        </label>
        <div className="flex gap-2 mb-2">
          <Button
            label={isLoading ? "Обновление..." : "Обновить структуру"}
            icon={isLoading ? "pi pi-spin pi-spinner" : "pi pi-refresh"}
            onClick={refreshProjectTree}
            disabled={isLoading || !displayValue.rootDirectory}
            className={`p-button-accent-outlined p-button-sm ${isLoading ? 'p-button-warning' : ''}`}
            style={{ padding: '4px 8px', fontSize: '12px' }}
            title={!displayValue.rootDirectory ? "Сначала выберите папку" : "Обновить структуру из текущей папки"}
          />
        </div>
        <Textarea
          value={displayValue.content}
          onChange={(e) => handleFieldChange('content', e.target.value)}
          rows={6}
          placeholder="Введите структуру проекта в выбранном формате..."
          className="w-full text-sm font-mono mt-2"
        />
      </div>

      {
        // Описание
      }
      <FieldWrapper label="Описание" className='mb-0 text-sm'>
        <Textarea
          value={displayValue.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          rows={3}
          placeholder="Краткое описание назначения структуры..."
          className="w-full text-sm"
        />
      </FieldWrapper>
    </section>
  );
};

// Вспомогательный компонент для группировки label + input
const FieldWrapper: React.FC<{
  label: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, children, className }) => (
  <div className={className || "mb-4 text-sm"}>
    <label className="block font-medium text-700 mb-2 flex items-center gap-2">
      {label}
    </label>
    {children}
  </div>
);
*/