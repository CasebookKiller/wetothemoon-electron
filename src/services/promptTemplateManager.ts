import { CodeIndentation, PromptTemplate, ResponseLength, CodeSourceType } from '@/shared/types/promptgenerator';

export class PromptTemplateManager {
  private prompts: PromptTemplate[] = [];
  private storageKey = 'promptTemplates';

  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Создаёт новый промпт с базовыми значениями
   */
  createPrompt(partialPrompt?: Partial<PromptTemplate>): PromptTemplate {
    const now = new Date().toISOString().split('T')[0];

    // Надёжная генерация ID
    const generateId = (): string => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    const newPrompt: PromptTemplate = {
      id: partialPrompt?.id || generateId(),
      title: partialPrompt?.title || 'Новый промпт',
      description: partialPrompt?.description || '',
      version: partialPrompt?.version || '1.0',
      createdAt: partialPrompt?.createdAt || now,
      updatedAt: partialPrompt?.updatedAt || now,

      role: partialPrompt?.role || {
        position: '',
        experience: '',
        specialization: '',
        communicationStyle: 'нейтральный',
        priorities: [],
        enabled: true
      },
      projectContext: partialPrompt?.projectContext || {
        technologies: [],
        architecture: { type: '', components: [], interaction: '' },
        integrations: [],
        standards: [],
        fullProjectStructure: {
          type: 'tree',
          content: '',
          rootDirectory: './',
          description: ''
        },
        enabled: true
      },
      taskAndExpectations: partialPrompt?.taskAndExpectations || {
        mainTask: '',
        expectedResult: '',
        codeRequirements: [],
        outputFormat: '',
        enabled: true
      },
      technicalRequirements: partialPrompt?.technicalRequirements || {
        compatibility: [],
        dataHandling: [],
        security: [],
        performance: [],
        enabled: true
      },
      responseStructure: partialPrompt?.responseStructure || {
        sections: [],
        codeFormat: {
          syntax: 'TypeScript',
          indentation: CodeIndentation.Spaces,
          namingConvention: 'camelCase'
        },
        enabled: true
      },
      specialScenarios: partialPrompt?.specialScenarios || {
        errorHandling: '',
        testing: '',
        scalability: '',
        alternativeApproaches: '',
        enabled: true
      },
      restrictionsAndRules: partialPrompt?.restrictionsAndRules || {
        forbiddenPractices: [],
        dependenciesPolicy: '',
        compliance: [],
        environmentConsiderations: [],
        enabled: true
      },
      additionalPreferences: partialPrompt?.additionalPreferences || {
        tone: 'профессиональный',
        length: ResponseLength.Detailed,
        preferredPatterns: [],
        specialEmphases: [],
        enabled: true
      },
      codeContext: partialPrompt?.codeContext || {
        language: 'TypeScript',
        sourceType: CodeSourceType.Snippet, // новое поле
        codeSources: '', // может быть строкой, массивом фрагментов или массивом ссылок на файлы
        purpose: '',
        process: 'main',
        dependencies: [],
        problemDescription: '',
        enabled: true
      },
      developmentContext: partialPrompt?.developmentContext || {
        backendStructure: {
          type: 'tree',
          content: '',
          rootDirectory: './',
          description: ''
        },
        buildProcess: '',
        deploymentStrategy: '',
        enabled: true
      }
    };

    this.prompts.push(newPrompt);
    this.saveToLocalStorage();
    return newPrompt;
  }

  /**
   * Находит промпт по ID
   */
  findPromptById(id: string): PromptTemplate | undefined {
    return this.prompts.find(prompt => prompt.id === id);
  }

  /**
   * Обновляет существующий промпт
   */
  updatePrompt(id: string, updates: Partial<PromptTemplate>): boolean {
    const index = this.prompts.findIndex(prompt => prompt.id === id);
    if (index === -1) return false;

    this.prompts[index] = {
      ...this.prompts[index],
      ...updates,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    this.saveToLocalStorage();
    return true;
  }

  /**
   * Удаляет промпт по ID
   */
  deletePrompt(id: string): boolean {
    const index = this.prompts.findIndex(prompt => prompt.id === id);
    if (index === -1) return false;

    this.prompts.splice(index, 1);
    this.saveToLocalStorage();
    return true;
  }

  /**
   * Получает все промты
   */
  getAllPrompts(): PromptTemplate[] {
    return [...this.prompts];
  }

  /**
   * Валидирует промпт на соответствие структуре
   */
  validatePrompt(prompt: PromptTemplate): boolean {
    try {
      return !!prompt.id &&
             !!prompt.title &&
             !!prompt.version &&
             !!prompt.createdAt &&
             !!prompt.updatedAt;
    } catch {
      return false;
    }
  }

  /**
   * Экспортирует все промты в JSON (для скачивания)
   */
  exportToJSON(): string {
    return JSON.stringify(this.prompts, null, 2);
  }

  /**
   * Импортирует промты из JSON
   */
  importFromJSON(jsonString: string): void {
    try {
      const importedPrompts: PromptTemplate[] = JSON.parse(jsonString);

      // Валидация каждого промпта
      for (const prompt of importedPrompts) {
        if (!this.validatePrompt(prompt)) {
          throw new Error(`Некорректный промпт с ID: ${prompt.id}`);
        }
      }

      this.prompts = [...importedPrompts];
      this.saveToLocalStorage();
    } catch (error) {
      throw new Error(`Ошибка импорта: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    }
  }

  /**
   * Сохраняет промты в localStorage
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.storageKey, this.exportToJSON());
    } catch (error) {
      console.error('Ошибка сохранения в localStorage:', error);
    }
  }

  /**
   * Загружает промты из localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed: PromptTemplate[] = JSON.parse(saved);
        // Дополнительная валидация при загрузке
        this.prompts = parsed.filter(prompt => this.validatePrompt(prompt));
      }
    } catch (error) {
      console.error('Ошибка загрузки из localStorage:', error);
      this.prompts = [];
    }
  }

  /**
   * Скачивает промты как JSON‑файл
   */
  downloadAsJSON(): void {
    const jsonString = this.exportToJSON();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompt-templates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Загружает промты из выбранного JSON‑файла
   * @param file Файл для загрузки
   * @returns Promise<void>
   */
  async uploadFromJSONFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const jsonString = event.target?.result as string;
          this.importFromJSON(jsonString);
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Ошибка чтения файла'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Фильтрует промты по ключевым словам в title или description
   */
  filterByKeyword(keyword: string): PromptTemplate[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.prompts.filter(prompt =>
      prompt.title.toLowerCase().includes(lowerKeyword) ||
      prompt.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Получает статистику по промтам
   */
  getStats(): {
    total: number;
    byVersion: Record<string, number>;
    lastUpdated: string | null;
  } {
    if (this.prompts.length === 0) {
      return { total: 0, byVersion: {}, lastUpdated: null };
    }

    const versionCount: Record<string, number> = {};
    let latestDate = '';

    for (const prompt of this.prompts) {
      versionCount[prompt.version] = (versionCount[prompt.version] || 0) + 1;
      if (prompt.updatedAt > latestDate) {
        latestDate = prompt.updatedAt;
      }
    }

    return {
      total: this.prompts.length,
      byVersion: versionCount,
      lastUpdated: latestDate
    };
  }
}

/*
import React, { useState, useEffect } from 'react';

const PromptManagerComponent: React.FC = () => {
  const [manager] = useState(() => new PromptTemplateManager());
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [keyword, setKeyword] = useState('');

  // Обновляем список промптов при изменениях
  useEffect(() => {
    setPrompts(manager.getAllPrompts());
  }, [manager]);

  const handleCreatePrompt = () => {
    manager.createPrompt({
      title: `Новый промпт ${new Date().toLocaleTimeString()}`,
      description: 'Автоматически созданный промпт'
    });
    setPrompts(manager.getAllPrompts());
  };

  const handleDownload = () => {
    manager.downloadAsJSON();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      manager.uploadFromJSONFile(file)
        .then(() => setPrompts(manager.getAllPrompts()))
        .catch(error => alert(`Ошибка загрузки: ${error.message}`));
    }
  };

  const filteredPrompts = keyword
    ? manager.filterByKeyword(keyword)
    : prompts;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Менеджер промптов</h1>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleCreatePrompt}>Создать новый промпт</button>
        <button onClick={handleDownload} style={{ marginLeft: '10px' }}>Скачать все промты</button>

        <div style={{ marginTop: '10px' }}>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
          />
          <label style={{ marginLeft: '5px' }}>Загрузить промты из JSON</label>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Поиск по названию или описанию..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ padding: '8px', width: '300px' }}
        />
      </div>

      <div>
        <h2>Статистика:</h2>
        <p>Всего промптов: {manager.getStats().total}</p>
        <p>Последняя обновка: {manager.getStats().lastUpdated || 'нет данных'}</p>
      </div>

      <div>
        <h2>Список промптов:</h2>
        {filteredPrompts.map(prompt => (
          <div key={prompt.id} style={{
            border: '1px solid #ddd',
            padding: '10px',
            margin: '10px 0',
            borderRadius: '4px'
          }}>
            <h3>{prompt.title}</h3>
            <p><strong>ID:</strong> {prompt.id}</p>
            <p><strong>Версия:</strong> {prompt.version}</p>
            <p><strong>Создан:</strong> {prompt.createdAt}</p>
            <p><strong>Описание:</strong> {prompt.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptManagerComponent;

*/


