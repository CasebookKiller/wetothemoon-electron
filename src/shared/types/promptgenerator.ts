// Перечисления для строгой типизации
export enum ResponseDepth {
  Short = 'short',
  Detailed = 'detailed'
}

export enum CodeIndentation {
  Spaces = 'spaces',
  Tabs = 'tabs'
}

export enum ResponseLength {
  Concise = 'concise',
  Detailed = 'detailed'
}

// Основные интерфейсы
export interface Technology {
  name: string;
  version: string | null;
  purpose: string;
}

export interface Integration {
  service: string;
  purpose: string;
}

export interface Architecture {
  type: string;
  components: string[];
  interaction: string;
}

export interface ResponseSection {
  name: string;
  required: boolean;
  depth: ResponseDepth;
  format: string;
}

export interface CodeFormat {
  syntax: string;
  indentation: CodeIndentation;
  namingConvention: string;
}

export interface Role {
  position: string;
  experience: string;
  specialization: string;
  communicationStyle: string;
  priorities: string[];
  enabled: boolean;
}

export interface ProjectStructure {
  type?: 'tree' | 'list' | 'diagram'; // формат представления
  content?: string; // само дерево в текстовом виде
  rootDirectory?: string; // корневая директория проекта
  description?: string; // краткое описание назначения структуры
}

export interface ProjectContext {
  technologies: Technology[];
  architecture: Architecture;
  integrations: Integration[];
  standards: string[];
  fullProjectStructure: ProjectStructure;
  enabled: boolean;
}

export interface TaskAndExpectations {
  mainTask: string;
  expectedResult: string;
  codeRequirements: string[];
  outputFormat: string;
  enabled: boolean;
}

export interface TechnicalRequirements {
  compatibility: string[];
  dataHandling: string[];
  security: string[];
  performance: string[];
  enabled: boolean;
}

export interface ResponseStructure {
  sections: ResponseSection[];
  codeFormat: CodeFormat;
  enabled: boolean;
}

export interface SpecialScenarios {
  errorHandling: string;
  testing: string;
  scalability: string;
  alternativeApproaches: string;
  enabled: boolean;
}

export interface RestrictionsAndRules {
  forbiddenPractices: string[];
  dependenciesPolicy: string;
  compliance: string[];
  environmentConsiderations: string[];
  enabled: boolean;
}

export interface AdditionalPreferences {
  tone: string;
  length: ResponseLength;
  preferredPatterns: string[];
  specialEmphases: string[];
  enabled: boolean;
}

export interface CodeFileReference {
  path: string;
  purpose?: string;
  process?: 'main' | 'renderer'; // --- новое свойство --- необходимо доработать, начиная с templatemanager
  problemDescription?: string;
}

export interface CodeSnippet {
  code: string;
  purpose?: string;
  process?: 'main' | 'renderer';
  dependencies?: string[];
  problemDescription?: string;
}

export enum CodeSourceType {
  Snippet = 'snippet',
  MultipleSnippets = 'multiple-snippets',
  FilePaths = 'file-paths'
}

export interface CodeContext {
  language?: string;                                          // 'TypeScript', 'JavaScript' и т. д.
  sourceType?: CodeSourceType;                                // каким образом указан код --- новое свойство
  
  codeSnippet?: string;                                       // сам фрагмент кода --- старое свойство, убрать после доработки
  
  purpose?: string;                                           // цель фрагмента ('обработчик IPC', 'запрос к БД')
  process?: 'main' | 'renderer';                              // в каком процессе Electron выполняется --- это свойство должно использовать только для одного фрагмента или задано старое свойство codeSnippet
  
  problemDescription?: string;                                // описание проблемы (если есть ошибка)
                                  
  codeSources?: string | CodeSnippet[] | CodeFileReference[]; // строка либо массивы фрагментов или путей к файлам --- новое объединённое свойство

  dependencies?: string[];                                    // используемые зависимости
  enabled?: boolean;
}

export interface DevelopmentContext {
  backendStructure?: ProjectStructure;
  buildProcess?: string;
  deploymentStrategy?: string;
  enabled?: boolean;
}

// Основной интерфейс промпта
export interface PromptTemplate {
  id: string;
  
  title: string;
  description: string;
  version: string;
  createdAt: string; // Формат YYYY-MM-DD
  updatedAt: string; // Формат YYYY-MM-DD

  role: Role;
  projectContext: ProjectContext;
  taskAndExpectations: TaskAndExpectations;
  technicalRequirements: TechnicalRequirements;
  responseStructure: ResponseStructure;
  specialScenarios: SpecialScenarios;
  restrictionsAndRules: RestrictionsAndRules;
  additionalPreferences: AdditionalPreferences;

  codeContext?: CodeContext; // опционально — для задач с кодом
  developmentContext?: DevelopmentContext;

}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  category?: string;
  children?: TreeNode[];
}


// Тип для массива промптов
export type PromptTemplates = PromptTemplate[];

// Утилитарные функции для работы с интерфейсом

/**
 * Создаёт новый промпт с базовыми значениями
 */
export function createPromptTemplate(partialPrompt?: Partial<PromptTemplate>): PromptTemplate {
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return {
    id: partialPrompt?.id || crypto.randomUUID?.() || `prompt-${Date.now()}`,
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
       description: '',
       rootDirectory: './' 
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
      codeSnippet: '', // сохраняем для обратной совместимости
      sourceType: CodeSourceType.Snippet, // значение по умолчанию
      codeSources: '', // инициализируем пустой строкой (для sourceType: 'snippet')
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
        description: '',
        rootDirectory: './'
      },
      buildProcess: '',
      deploymentStrategy: '',
      enabled: true
    }
  };
}

/**
 * Валидирует промпт на соответствие структуре
 */
export function validatePromptTemplate(prompt: PromptTemplate): boolean {
  try {
    return !!prompt.id &&
           !!prompt.title &&
           !!prompt.version &&
           !!prompt.createdAt &&
           !!prompt.updatedAt &&
           validateRole(prompt.role) &&
           validateProjectContext(prompt.projectContext) &&
           (prompt.codeContext ? validateCodeContext(prompt.codeContext) : true);
  } catch {
    return false;
  }
}

export function validateRole(role: Role): boolean {
  return !!role.position &&
         !!role.experience &&
         !!role.specialization &&
         !!role.communicationStyle;
}

export function validateProjectContext(context: ProjectContext): boolean {
  return Array.isArray(context.technologies) &&
         !!context.architecture?.type &&
         Array.isArray(context.architecture?.components);
}

function validateCodeContext(context: CodeContext): boolean {
  if (!context.enabled) return true;
  if (!context.language) return false;

  // Проверка старого формата (codeSnippet)
  if (context.sourceType === undefined) {
    // Если sourceType не указан, используем старый формат
    return !!context.codeSnippet && typeof context.codeSnippet === 'string';
  }

  // Проверка нового формата (codeSources)
  switch (context.sourceType) {
    case CodeSourceType.Snippet:
      return typeof context.codeSources === 'string' && !!context.codeSources;
    case CodeSourceType.MultipleSnippets:
      if (!Array.isArray(context.codeSources)) return false;
      return context.codeSources.every(source =>
        typeof source === 'object' && 'code' in source && !!source.code
      );
    case CodeSourceType.FilePaths:
      if (!Array.isArray(context.codeSources)) return false;
      return context.codeSources.every(source =>
        typeof source === 'object' && 'path' in source && !!source.path
      );
    default:
      return false;
  }
}
