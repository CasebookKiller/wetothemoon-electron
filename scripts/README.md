## Поэтапный план оптимизации структуры проекта

**Контекст:** Electron + Electron Forge + Vite + React, множественные preload-скрипты, интеграция T-Invest API, нейро-подсистема (Ollama), генератор промптов.  
**Цель:** Устранить дублирование, привести к единообразной модульной архитектуре, повысить поддерживаемость, сохранить полную функциональность после каждого шага.

---

### **Шаг 0. Аудит и фиксация текущего состояния**
*Действия:*
- Закоммитить текущее состояние (`git add . && git commit -m "pre-optimization snapshot"`) или создать ветку.
- Сгенерировать полный список файлов и их зависимостей (например, `npx madge --image graph.png src`).
- Составить таблицу всех `preload` / `window` / `handler` связей.

*Проверка:*
- `git status` чист.
- Зависимости визуализированы, определены циклические связи.

---

### **Шаг 1. Очистка от мусора и устаревших артефактов**
*Проблемы:* Множество файлов `.old`, неиспользуемые конфиги, дубликаты proto в `dist/` (должен генерироваться билдом), `tree.txt` (результат ручного экспорта), `json`-файлы в `services/` похожи на артефакты нейро-ответов.

*Действия:*
- Удалить все файлы с расширением `.old` (`main.ts.old`, `menuBuilder.ts.old`, `routesAI.tsx.old` и др.).
- Удалить `dist/` (должен генерироваться) и добавить `dist/` в `.gitignore`, если ещё нет.
- Удалить `tree.txt`.
- Из `services/` удалить артефактные `.json`: `electron-forge-vite-config.json`, `ipc-file-handler.json`, `jsonTemplate.json`, `optimize-main-process-structure.json`, `refactor-project-structure.json`, `ui-component-preload-api.json`, `templateExample.old.json` – если они не используются кодом (проверить импорты). Перенести шаблонные данные в выделенную директорию `templates/` при необходимости.
- Удалить `vite.ai.config.ts.old`.
- Удалить содержимое `training/scripts/`, если оно не интегрировано в проект (или оставить как внешний инструмент вне `src`).

*Проверка:*
- Проект компилируется: `npm run build` (или `electron-forge make`) без ошибок.
- Приложение запускается, все окна открываются.

---

### **Шаг 2. Унификация preload-скриптов**
*Проблема:* 4 разных preload: `preload.ts`, `preloadai.ts`, `preloadbonds.ts`, `preloadpg.ts`. Они ведут к фрагментации API и дублированию IPC-каналов.

*Действия:*
- Создать единый `src/preload.ts` с использованием `contextBridge` и условного API в зависимости от `window.location.hash` или имени окна (Electron позволяет передавать параметры). Или разделить на функциональные модули, которые подключает общий preload.
- Определить общий тип `ElectronAPI`, в который входят AI, Bonds, PG, MainDashboard.
- Перенести все реализации из `preloadai.ts`, `preloadbonds.ts`, `preloadpg.ts` в единый preload, экспортируя именованные функции.
- Настроить `forge.config.ts` на использование одного `preload.ts` для всех окон, передавая идентификатор через параметры загрузки (`loadURL` с query-параметром). Альтернативно: для разных окон указать один и тот же preload.
- Удалить старые preload-файлы и соответствующие `vite.preload*.config.ts` (оставить один `vite.preload.config.ts`).

*Проверка:*
- Каждое окно (main, AI, bonds, pg) получает корректное API. Проверить `window.electronAPI.*` вызовы в рендерерах.
- Сборка завершается успешно, ошибок в консоли нет.

---

### **Шаг 3. Реорганизация main-процесса**
*Проблема:* `main/` содержит `ipcHandlers/`, `windows/`, `menus/`, `utils/`, `methods.ts`, `promptTemplateSaver.ts`, `training.ts`, `trainingManager.ts` – всё в одной куче. `main.ts` велик и, вероятно, инициализирует всё скопом.

*Действия:*
- Ввести чёткую структуру:
  ```
  src/main/
    index.ts              // точка входа, только запуск приложения
    app/
      windows.ts          // создание всех окон
      menus.ts            // меню приложения
    ipc/
      ai.ipc.ts
      bonds.ipc.ts
      dashboard.ipc.ts
      pg.ipc.ts
      training.ipc.ts
      index.ts            // регистрация всех обработчиков
    services/
      tbank/
        bondsService.ts   // переносим из src/api/tbank или main/methods
      ollama/
        ollamaClient.ts   // если используется в main, иначе оставить в api
    utils/
      pathUtils.ts
    proto/                // оставить символическую ссылку на proto/ в корне?
  ```
- Выделить `BondsService`, `MarketDataStreamService` и т.п. из `src/api/tbank` в `src/main/services/tbank`, потому что они используются только в main процессе (StreamService точно). Клиентские типы оставить в `src/api/tbank/`.
- `methods.ts` распределить по соответствующим сервисам или IPC-обработчикам.
- `promptTemplateSaver.ts` → `src/main/services/promptTemplateService.ts`.
- `training.ts`, `trainingManager.ts` → `src/main/services/training/`.
- Удалить `main.ts.old` (уже на шаге 1).

*Проверка:*
- `npm run start` – главное окно открывается, IPC-вызовы работают.
- Проверить каждый обработчик: AI-запросы, стримы маркетдаты, операции с облигациями.

---

### **Шаг 4. Упорядочивание рендерера**
*Проблема:* Компоненты разбросаны: `components/AI/...`, `components/BONDS/...`, `components/PG/...`, при этом страницы лежат в `pages/`. Есть `renderer/ai-window` и `renderer/main-window` с `index.html` и устаревшими файлами.

*Действия:*
- Оставить единый `src/renderer/` с поддиректорией `windows/` для точек входа разных окон:
  ```
  src/renderer/
    windows/
      main/
        index.html
        main.tsx
      ai/
        index.html
        ai.tsx
      bonds/
        index.html
        bonds.tsx
      pg/
        index.html
        pg.tsx
  ```
- Удалить `renderer/ai-window/index.tsx.old`, `renderer/ai-window/renderer.ts.old`.
- Перенести `App.tsx`, `AppAI.tsx`, `Root.tsx`, `RootAI.tsx` в соответствующие окна или сделать маршрутизацию внутри одного окна (если так задумано). Сейчас похоже, что есть разные `Root*`. Лучше: каждое окно имеет свой корневой компонент (`mainWindow/Root.tsx`, `aiWindow/RootAI.tsx` и т.п.), они лежат рядом с `index.html`.
- Компоненты остаются в `components/` с текущим разделением по фичам (AI, BONDS, COMMON, DASHBOARD, PG, TemplatePanels). Это нормально.
- Убедиться, что пути импортов не нарушены.

*Проверка:*
- Все окна рендерятся без ошибок в DevTools.
- Навигация и маршрутизация внутри каждого окна работает.

---

### **Шаг 5. Устранение дублирования proto-файлов**
*Проблема:* `proto/` в корне и `dist/main/proto/` (последний генерируется, но почему-то вручную добавлен в структуру). В `main/` есть `proto/marketdata.proto` – частичный дубликат.

*Действия:*
- Определить каноническое место: `proto/` в корне проекта.
- Убедиться, что `main/proto/marketdata.proto` не используется и удалить его.
- Проверить, что сборка копирует proto-файлы в `dist/main/proto/` (через `forge.config.ts` или Vite). Настроить `package.json` скрипты или `copy-webpack-plugin`-аналог.
- Добавить `proto/` в ресурсы Electron Forge (секция `packagerConfig.extraResource`).

*Проверка:*
- `dist/main/proto/` содержит актуальные proto-файлы после `npm run make`.
- gRPC/Proto-загрузка работает без ошибок.

---

### **Шаг 6. Стандартизация директорий сервисов и утилит**
*Проблема:* Сервисы в `src/services/` содержат как бизнес-логику, так и странные JSON-артефакты; утилиты разбросаны.

*Действия:*
- Оставить в `src/services/` только реальные сервисы рендерера, если они есть (например, `chatStorages.ts`). Перенести `promptTemplateManager.ts` в `src/main/services/` или оставить, если он шарится.
- `chatBackupService.ts` оставить в `src/services/`.
- `ipcUtils.ts` (из `src/utils/`) переместить в `src/shared/ipcUtils.ts` и использовать и на main, и на renderer (но осторожно: main-зависимости).
- `data-utils.ts`, `common.ts`, `chatExport.ts` — в `src/shared/utils/`.
- Создать `src/shared/types/` для общих типов IPC, перенеся туда `types/ips.ts`, `types/promptgenerator.ts`, `types/chat.ts`. Оставить в `types/` только то, что специфично для рендерера.
- `bem.ts`, `classnames.ts` — хорошо в `src/css/`.
- Удалить `src/main.global.css` (вероятно, не используется) или перенести в соответствующее окно.

*Проверка:*
- Компиляция без ошибок, импорты разрешены.
- Линтер ESLint доволен (запустить `npm run lint`).

---

### **Шаг 7. Рефакторинг API-слоя T-Invest**
*Проблема:* `src/api/tbank/` содержит и сервисы (используются в main), и типы, и `methods.ts`. Часть сервисов может вызываться из рендерера, но сейчас всё валится в кучу.

*Действия:*
- Разделить:
  - `src/shared/api/tbank/types/` – все TypeScript-типы из proto.
  - `src/main/services/tbank/` – сервисы, работающие только в main (стримы, операции). Перенести `MarketDataStreamService`, `OperationsStreamService`, `OrdersStreamService` и соответствующие типы стримов (`marketdataStreamTypes`, ...).
  - `src/api/tbank/` оставить только для методов, доступных в рендерере через IPC, либо сделать их прокси через preload. Но лучше все вызовы API делать через IPC, тогда сервисы живут в main, а рендерер получает готовые данные.
- Удалить `src/api/tbank/methods.ts` и интегрировать в сервисы.
- Проверить, что `BondsService.tsx` (почему `.tsx`?) не содержит JSX – переименовать в `.ts`.

*Проверка:*
- Все вызовы T-Invest API проходят.
- Вкладка Bonds получает данные, стримы работают.

---

### **Шаг 8. Унификация конфигурации Vite**
*Проблема:* Множество `vite.preload*.config.ts`, устаревшие конфиги.

*Действия:*
- Оставить один `vite.preload.config.ts`, который собирает единый preload.
- Удалить `vite.ai.config.ts.old`, `vite.preloadai.config.ts`, `vite.preloadbonds.config.ts`, `vite.preloadpg.config.ts`.
- Пересмотреть `vite.renderer.config.ts` – настроить мульти-вход для разных окон, если необходимо, или оставить один вход с роутингом.
- Сейчас `forge.config.ts` использует эти конфиги, нужно обновить его.

*Проверка:*
- `npm run start` запускает все окна без ошибок сборки.
- HMR работает в dev-режиме.

---

### **Шаг 9. Настройка документации и assets**
*Действия:*
- `docs/answers/` и `docs/neuro/codes/` – архивировать как историю разработки, убрать из активной кодовой базы (например, перенести в `docs/archive/`).
- `docs/prompts/` содержит шаблоны промптов; их стоит переместить в `training/prompts/` или `templates/prompts/`, так как они относятся к генерации, а не к документации.
- `assets/` – норм, только удалить дублирующийся `ollama-logo.svg` (есть `.png` и `.svg`). Оставить один вариант.

*Проверка:*
- Документация остаётся доступной.
- Иконки подгружаются.

---

### **Шаг 10. Итоговая проверка и автоматизация**
*Действия:*
- Запустить полный цикл: `npm run lint` → `npm run build` → `npm run start` (или `electron-forge start`).
- Проверить каждое окно и основные сценарии: AI-чат, облигации, стримы, генератор промптов, сохранение/загрузка чатов.
- Убедиться, что `forge.config.ts` обновлён под новую структуру (точки входа main, preload, renderer).
- Обновить `README.md` с описанием новой архитектуры.
- Добавить pre-commit хуки для автоформатирования.

*Проверка:*
- Приложение работает стабильно, все функции доступны.
- Код-ревью подтверждает соответствие стандартам.
- Структура готова к дальнейшему масштабированию.

---

### Результат оптимизации: ожидаемая структура (ключевые моменты)
```
.
├── assets
├── docs
│   ├── archive
│   └── main.md
├── proto
│   └── ...
├── src
│   ├── main
│   │   ├── index.ts
│   │   ├── ipc/
│   │   ├── services/
│   │   └── windows/
│   ├── preload.ts   (единый)
│   ├── renderer
│   │   ├── windows/
│   │   ├── components/
│   │   ├── pages/
│   │   └── shared/
│   ├── shared
│   │   ├── types/
│   │   ├── utils/
│   │   └── api/
│   └── services/    (только рендерер-специфичные)
├── templates
├── forge.config.ts
├── vite.main.config.ts
├── vite.preload.config.ts
└── vite.renderer.config.ts
```
*Чистота, модульность, отсутствие дублирования.*


Команда npx madge --image graph.png src вернула 0 файлов — значит, madge не обнаружил ни одного модуля для анализа в директории src. Это не ошибка, а особенность работы madge по умолчанию: он ищет файлы с расширениями .js, .mjs, .cjs, но не .ts/.tsx. В вашем проекте весь код на TypeScript, поэтому нужна явная настройка.

### Быстрое исправление
Укажите расширения TypeScript и точку входа (можно всю папку, но с фильтром):

```bash
npx madge --extensions ts,tsx --image graph.png src/
```

Если вы хотите видеть связи между конкретными подсистемами (например, между main, preload, renderer), удобнее задать корневые файлы:

```bash
npx madge --extensions ts,tsx --image graph.png \
  src/main/index.ts \
  src/preload.ts \
  src/renderer/windows/main/main.tsx \
  src/renderer/windows/ai/ai.tsx \
  ...
```

### Альтернатива – dependency-cruiser

Для TypeScript-проектов надёжнее использовать dependency-cruiser — он из коробки понимает алиасы, динамические импорты и конфиги Vite.

```bash
npx depcruise --include-only "^src" --output-type dot src | dot -T png > graph.png
```

```bash
npx depcruise --include-only "^src" --output-type dot src | dot -T svg > graph.svg
```

### Если график не обязателен

Для аудита связей (Шаг 0) важнее составить таблицу окон, preload-скриптов и обработчиков IPC. Это можно сделать вручную или вот такой быстрой командой:

```bash
grep -r "contextBridge\|ipcMain.handle\|ipcRenderer.invoke\|BrowserWindow" src/ --include="*.ts" --include="*.tsx"
```

Я бы на вашем месте сразу перешёл к ручному картированию, потому что автоматический граф в проектах Electron с несколькими процессами может запутать. Но если нужен визуальный результат, используйте depcruise — он справится.