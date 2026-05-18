import { CodeIndentation, PromptTemplate, ResponseDepth, ResponseLength } from '@/shared/types/promptgenerator';

export const examplePromptTemplate: PromptTemplate = {
  id: "web-app-dev-001",
  title: "Промт для разработки веб‑приложения на React + Node.js (Пример)",
  description: "Шаблон промта для генерации технического задания на разработку полнофункционального веб‑приложения с использованием современных технологий",
  version: "0.0.1",
  role: {
    position: "Full‑Stack Developer",
    experience: "Senior",
    specialization: "Веб‑разработка и архитектура приложений",
    communicationStyle: "Профессиональный, лаконичный, с техническими деталями",
    priorities: [
      "Проектирование архитектуры приложения",
      "Разработка фронтенда на React",
      "Реализация бэкенда на Node.js/Express",
      "Интеграция с базой данных MongoDB",
      "Настройка CI/CD пайплайна"
    ],
    enabled: true
  },
  projectContext: {
    technologies: [
      {
        name: "React",
        version: "18.2.0",
        purpose: "Разработка пользовательского интерфейса"
      },
      {
        name: "Node.js",
        version: "18.17.0",
        purpose: "Серверная часть приложения"
      },
      {
        name: "MongoDB",
        version: "6.0",
        purpose: "Хранение данных приложения"
      }
    ],
    architecture: {
      type: "Микросервисная архитектура",
      components: [
        "Фронтенд (React)",
        "Бэкенд API (Node.js/Express)",
        "База данных (MongoDB)",
        "Сервис аутентификации",
        "Платёжный шлюз"
      ],
      interaction: "Фронтенд взаимодействует с бэкендом через REST API. Бэкенд обращается к БД и платёжному шлюзу."
    },
    integrations: [
      {
        service: "Stripe API",
        purpose: "Обработка онлайн‑платежей"
      },
      {
        service: "Google Maps API",
        purpose: "Отображение геолокации продавцов"
      }
    ],
    standards: [
      "REST API conventions",
      "ESLint code style",
      "Jest unit tests",
      "Docker containerization"
    ],
    fullProjectStructure: {
      type: 'tree',
      content: `my-marketplace-app/
├── package.json
├── README.md
├── .eslintrc.js
├── docker-compose.yml
├── src/
│   ├── components/
│   │   ├── Header/
│   │   └── ProductCard/
│   ├── services/
│   │   └── api.js
│   └── utils/
│       └── helpers.js
└── tests/
    ├── unit/
    └── integration/`,
      rootDirectory: "my-marketplace-app",
      description: "Стандартная структура React + Node.js приложения с разделением на компоненты, сервисы и утилиты"
    },
    enabled: true
  },
  taskAndExpectations: {
    mainTask: "Разработать полнофункциональное веб‑приложение для маркетплейса с корзиной покупок и системой оплаты",
    expectedResult: "Готовое приложение с пользовательским интерфейсом, API, БД и документацией",
    codeRequirements: [
      "Использовать TypeScript",
      "Соблюдать принципы SOLID",
      "Написать unit‑тесты (80 % покрытие)",
      "Добавить комментарии к сложным алгоритмам"
    ],
    outputFormat: "Структурированный код с README.md файлом",
    enabled: true
  },
  technicalRequirements: {
    compatibility: [
      "Поддержка последних версий Chrome, Firefox, Safari",
      "Адаптивный дизайн для мобильных устройств"
    ],
    dataHandling: [
      "Валидация данных на фронтенде и бэкенде",
      "Шифрование чувствительных данных",
      "Логирование ошибок"
    ],
    security: [
      "HTTPS соединение",
      "JWT‑аутентификация",
      "Защита от XSS и SQL‑инъекций"
    ],
    performance: [
      "Время загрузки страницы < 2 с",
      "Обработка до 1000 запросов/с",
      "Оптимизация изображений"
    ],
    enabled: true
  },
  responseStructure: {
    sections: [
      {
        name: "Техническое задание",
        required: true,
        depth: ResponseDepth.Detailed,
        format: "Описание функциональности, пользовательских сценариев, технических требований"
      },
      {
        name: "Архитектура",
        required: true,
        depth: ResponseDepth.Detailed,
        format: "Диаграмма компонентов, описание взаимодействия, выбор технологий"
      },
      {
        name: "API Endpoints",
        required: true,
        depth: ResponseDepth.Detailed,
        format: "Список всех endpoints с HTTP‑методами, параметрами, примерами запросов/ответов"
      },
      {
        name: "Структура БД",
        required: true,
        depth: ResponseDepth.Short,
        format: "Схема коллекций/таблиц с основными полями"
      }
    ],
    codeFormat: {
      syntax: "ES6+",
      indentation: CodeIndentation.Spaces,
      namingConvention: "camelCase"
    },
    enabled: true
  },
  specialScenarios: {
    errorHandling: "Обработка сетевых ошибок, валидация ввода, graceful degradation",
    testing: "Unit‑тесты для бизнес‑логики, интеграционные тесты для API",
    scalability: "Горизонтальное масштабирование бэкенда, кэширование часто используемых данных",
    alternativeApproaches: "Возможность замены MongoDB на PostgreSQL, использование GraphQL вместо REST",
    enabled: true
  },
  restrictionsAndRules: {
    forbiddenPractices: [
      "Использование глобальных переменных",
      "Жёсткое кодирование конфигураций",
      "Игнорирование обработки ошибок"
    ],
    dependenciesPolicy: "Использовать только стабильные версии библиотек (не alpha/beta)",
    compliance: [
      "GDPR для персональных данных",
      "PCI DSS для платёжных данных"
    ],
    environmentConsiderations: [
      "Работа в Docker‑контейнерах",
      "Конфигурация для dev/staging/prod окружений"
    ],    
    enabled: true
  },
  additionalPreferences: {
    tone: "Технический, без лишней воды, с конкретными формулировками",
    length: ResponseLength.Detailed,
    preferredPatterns: [
      "Repository Pattern для работы с данными",
      "Factory Pattern для создания объектов"
    ],
    specialEmphases: [
      "Безопасность данных пользователей",
      "Производительность при высокой нагрузке"
    ],
    enabled: true
  },
  codeContext: {
    language: "TypeScript",
    codeSnippet: `interface User {
  id: string;
  email: string;
  name: string;
}

export class UserService {
  private users: User[] = [];

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: generateId(),
      ...userData
    };
    this.users.push(user);
    return user;
  }
}`,
    purpose: "Пример интерфейса и класса для работы с пользователями",
    process: "main",
    dependencies: ["TypeScript", "Node.js"],
    problemDescription: "Необходимо добавить валидацию данных при создании пользователя и обработку ошибок",
    enabled: true
  },
  developmentContext: {
    backendStructure: {
      type: 'tree',
      content: `src/
├── models/
│   └── user.ts
├── services/
│   └── userService.ts
├── controllers/
│   └── userController.ts
└── tests/
    └── userService.test.ts`,
      rootDirectory: "src",
      description: "Структура бэкенда с разделением на модели, сервисы и контроллеры"
    },
    buildProcess: "npm run build (Webpack + TypeScript compilation)",
    deploymentStrategy: "Docker container → Kubernetes cluster (CI/CD pipeline)",
    enabled: true
  },
  createdAt: "2024-04-15",
  updatedAt: "2024-04-20"
};