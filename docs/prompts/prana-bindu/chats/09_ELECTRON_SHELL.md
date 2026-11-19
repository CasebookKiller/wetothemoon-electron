# Направление 09: Electron Shell (окно, меню, IPC)

## Роль
Оболочка модуля: окно, маршрут, меню, IPC-хендлеры, регистрация
в главном процессе, экспонирование через preload, каркас провайдеров
Zepp поверх уже реализованного `regionDetector.ts`.

## Зона ответственности
- Новое окно `pranaBinduWindow.ts` по образцу `osintWindow.ts`.
- Маршрут `#/prana-bindu` в `routes.tsx`.
- Страница `PranaBinduPage` (заглушка + блок синхронизации).
- Меню `pranaBinduWindowMenuTemplate` + пункт в `mainMenuTemplate`.
- Обработчик открытия окна в `main.ts` (как у OSINT).
- IPC-хендлеры `pranaBinduHandlers.ts` (каркас).
- Регистрация `registerPranaBinduHandlers()` в `main.ts`.
- Экспонирование `pb:*` методов через `preload.ts` в `electronAPI.pb`.
- **Три провайдера Zepp** в `spice/providers/` — `dofekProvider.ts`
  поверх `regionDetector.ts`, `mcpProvider.ts` и `bridgeProvider.ts`
  как заглушки.
- Расширение `sync_settings` полями `zepp_*` (миграция в Melange).

## Что нужно сделать

### 0. Разведка `@dofek/zepp-client` — ПРОЙДЕНА

Разведка выполнена 2026-09-23 probe-скриптами
`scripts/zepp/probe-zepp-client.mjs` и `scripts/zepp/probe-zepp-fetch.mjs`.
Результаты:

- Версия пакета: `@dofek/zepp-client@0.1.44` (установлен).
- Сигнатура: `signInToZepp(email, password, fetchFn = globalThis.fetch)`.
  Третий аргумент принимается и вызывается — `Всего вызовов fetch: 1`.
- Зашитые US2-хосты:
  - registration: `POST https://api-user-us2.zepp.com/v2/registrations/tokens`
  - exchange:    `POST https://api-mifit-us2.zepp.com/v2/client/login`
  - оба идут через `fetchFn` (`client.js:98`, `client.js:175`) — подмена
    хостов покрывает весь флоу.
- Реализация автодетекта: `spice/providers/regionDetector.ts` (создан).

См. ADR «Разведка `@dofek/zepp-client` (закрытие риска)» в `PROJECT_STATE.md`.

### 1. Окно — `src/main/windows/pranaBinduWindow.ts`

По образцу `osintWindow.ts`:

- `createPranaBinduWindow(): BrowserWindow`
- `getPranaBinduWindow(): BrowserWindow | null`
- Размеры: 1400×900, min 1100×700.
- `title: 'Prana-Bindu'`, `backgroundColor: '#212121'`.
- Загружает `#/prana-bindu`.
- Preload — общий (`src/preload.ts`) через `app.isPackaged` /
  `__dirname` (как в `osintWindow.ts`).
- Меню — `pranaBinduWindowMenuTemplate` внутри фабрики через
  `Menu.buildFromTemplate` + `win.setMenu`.
- `on('closed', () => { pranaBinduWindow = null; })`.

### 2. Страница — `src/pages/PranaBinduPage/`

- `PranaBinduPage.tsx` — заглушка с заголовком «Prana-Bindu»
  и подзаголовками модулей (Stillsuit, Crysknife, Mentat,
  Water Discipline, Spice).
- Блок «Синхронизация»: поля email и пароля Zepp, dropdown
  выбора провайдера (`dofek-zepp` / `zepp-mcp` / `zeppbridge`),
  кнопка «Проверить подключение».
- `PranaBinduPage.css` — базовые стили, классы `.pb-*`.

### 3. Маршрут — `src/navigation/routes.tsx`

Добавить:

```tsx
<Route path="/prana-bindu" element={<PranaBinduPage />} />
```

Не менять порядок существующих маршрутов — только добавить новый.

### 4. Меню — `src/main/menus/windowMenus.ts`

- Добавить `pranaBinduWindowMenuTemplate` по образцу
  `osintWindowMenuTemplate`.
- В `mainMenuTemplate` → подменю «Файл» добавить пункт **в конец
  списка, перед `separator` и «Выйти»**:

```ts
{ label: 'Открыть Prana-Bindu', id: 'open-prana-bindu' }
```

Порядок существующих пунктов не менять.

### 5. `src/main/main.ts`

- Добавить в импорт из `'./menus/windowMenus.ts'`:
  `pranaBinduWindowMenuTemplate`.
- Добавить импорты:
  - `createPranaBinduWindow`, `getPranaBinduWindow` из
    `'./windows/pranaBinduWindow.ts'`;
  - `registerPranaBinduHandlers` из
    `'./ipcHandlers/pranaBinduHandlers.ts'`.
- В `app.whenReady()`, внутри `if (fileMenu)`, добавить обработчик
  `click` по образцу OSINT:

```ts
const openPranaBindu = fileMenu.items.find(
  i => i.label === 'Открыть Prana-Bindu'
);
if (openPranaBindu) {
  openPranaBindu.click = () => {
    const existing = getPranaBinduWindow();
    if (existing && !existing.isDestroyed()) {
      existing.focus();
    } else {
      const win = createPranaBinduWindow();
      if (win) applyMenuToWindow(win, pranaBinduWindowMenuTemplate);
    }
  };
}
```

- В блоке регистрации хендлеров — рядом с `registerOsintHandlers()`:

```ts
registerPranaBinduHandlers();
```

### 6. IPC — `src/main/ipcHandlers/pranaBinduHandlers.ts`

Каркас с минимумом каналов:

- `pb:open-window` — открыть окно.
- `pb:ping` — health-check, возвращает `{ pong: true }`.
- `pb:get-profile` — чтение профиля.
- `pb:update-profile` — обновление профиля.
- `pb:sync-settings-get` — чтение настроек синхронизации.
- `pb:sync-settings-update` — обновление настроек.
- `pb:zepp-connect` — приём email и пароля, вызов
  `detectZeppConnection()` из
  `services/pranaBindu/spice/providers/regionDetector.ts`. При успехе —
  **шифрует** `appToken` и `zepp_credentials_json` через
  `safeStorage.encryptString`, сохраняет в `sync_settings` через
  Melange. Возвращает `ZeppConnectionResult` без `appToken`
  (только `userId`, `authHost`, `dataHost`).
- `pb:zepp-check-provider` — проверка доступности провайдера,
  возвращает `{ available: bool, reason?: string }`.

Стиль — как в `osintHandlers.ts`: `try / catch / return { success, error }`.
Пароль Zepp передаётся только в памяти, в БД не пишется.
Логи не должны содержать email/password/appToken.

**Важно:** `safeStorage` импортируется в **handler**, не в провайдер.
Провайдеры и Melange остаются чистыми (без `import { ... } from 'electron'`).

### 7. `src/preload.ts`

Добавить в объект `electronAPI` новое поле `pb` (не ломая
существующий экспорт):

```ts
pb: {
  openWindow: () => ipcRenderer.invoke('pb:open-window'),
  ping: () => ipcRenderer.invoke('pb:ping'),
  getProfile: () => ipcRenderer.invoke('pb:get-profile'),
  updateProfile: (patch: any) => ipcRenderer.invoke('pb:update-profile', patch),
  syncSettingsGet: () => ipcRenderer.invoke('pb:sync-settings-get'),
  syncSettingsUpdate: (patch: any) => ipcRenderer.invoke('pb:sync-settings-update', patch),
  zeppConnect: (email: string, password: string) =>
    ipcRenderer.invoke('pb:zepp-connect', email, password),
  zeppCheckProvider: (name: string) =>
    ipcRenderer.invoke('pb:zepp-check-provider', name),
},
```

### 8. Провайдеры Zepp

**Уже в каркасе, не создавать заново:**

- `spice/providers/types.ts` — интерфейс `ZeppDataProvider`,
  типы `RawWorkout`, `ProviderCheckResult`.
- `spice/providers/index.ts` — реестр `registerProvider` /
  `getProvider` / `listProviders`.
- `spice/providers/regionDetector.ts` — `detectZeppConnection()`.
  **Не реэкспортируется** из `index.ts` — внутренний для
  `dofekProvider.ts`.

**Создать в 09:**

- `spice/providers/dofekProvider.ts` — класс `DofekZeppProvider`,
  реализует `ZeppDataProvider`:
  - `name = 'dofek-zepp'`;
  - `isAvailable()` — читает `sync_settings` через Melange.
    Если есть `zepp_app_token` — `{ available: true }`, иначе
    `{ available: false, reason: 'not connected' }`;
  - `fetchWorkouts(from, to)` — пока `[]` (боевая логика — 07).
  - **Не импортирует `electron`**. `safeStorage` сюда не тащить.
- `spice/providers/mcpProvider.ts` — `ZeppMcpProvider` (заглушка):
  `isAvailable() → { available: false, reason: 'not implemented' }`,
  `fetchWorkouts() → []`.
- `spice/providers/bridgeProvider.ts` — `ZeppBridgeProvider` (заглушка),
  то же самое.

Регистрация провайдеров — в `pranaBinduHandlers.ts` при старте
(или в `spice/providers/index.ts` через явный `registerProvider`),
чтобы `listProviders()` возвращал три штуки.

Логика выбора и fallback провайдеров — в `07_SPICE.md`.

### 9. Настройки синхронизации в Melange

Таблица `sync_settings` дополняется полями:

```sql
zepp_provider           TEXT,   -- 'dofek-zepp' | 'zepp-mcp' | 'zeppbridge'
zepp_fallback_provider  TEXT,
zepp_credentials_json   TEXT,   -- safeStorage-encrypted
zepp_auth_host          TEXT,
zepp_data_host          TEXT,
zepp_app_token          TEXT,   -- safeStorage-encrypted
zepp_user_id            TEXT,
zepp_last_sync_at       TEXT,
zepp_last_sync_status   TEXT
```

Если Melange уже реализован — добавить миграцию (см. `08_MELANGE.md`).
Если нет — таблица создаётся сразу с этими полями.

### 10. `@dofek/zepp-client` — установлен

- Версия `0.1.44` в `package.json`.
- Импорт в main-процессе не падает.
- Вызывается через `spice/providers/regionDetector.ts`.

Дополнительных действий не требуется.

## Ограничения

- Не трогать существующие окна и меню.
- Не менять порядок существующих пунктов меню — только добавить.
- Префикс `pb:*` не пересекается с `training:*` (Ollama) и `osint:*`.
- Preload не ломает текущий экспорт `electronAPI` — только расширяет
  новым ключом `pb`.
- `appToken`, `loginToken`, `password` и учётные данные Zepp
  не логируем, не коммитим, не храним в открытом виде.
- Пароль Zepp передаётся в `pb:zepp-connect` только в памяти.
- `safeStorage` используется **только в handler**, не в сервисах
  (`services/pranaBindu/**` не импортирует `electron`).
- Не менять `marketDataBus`, `volumeProfileEngine`, `orderManager`,
  `scheduler`.

## Проверка (ручные сценарии)

1. **Запуск.** `npm start` → в главном меню есть «Открыть Prana-Bindu».
2. **Открытие.** Клик → открывается окно с заголовком «Prana-Bindu»,
   внутри заглушка и блок «Синхронизация».
3. **Повторный клик.** Окно фокусируется, дубликат не создаётся.
4. **Закрытие.** Закрыть окно → повторный клик снова открывает.
5. **IPC ping.** В DevTools консоли рендерера:

```js
await window.electronAPI.pb.ping()
// → { pong: true }
```

6. **Профиль.** `await window.electronAPI.pb.getProfile()` → объект
   профиля (пустой при первом запуске).
7. **Обновление профиля.**

```js
await window.electronAPI.pb.updateProfile({ age: 40, max_hr: 180 })
```

Профиль сохраняется, повторный `getProfile()` возвращает новые значения.

8. **Проверка провайдеров.** В блоке «Синхронизация» выбрать
   `zepp-mcp` → нажать «Проверить доступность» → получить
   `{ available: false, reason: 'not implemented' }`.
   То же для `zeppbridge`. Для `dofek-zepp` — `{ available: false,
   reason: 'not connected' }` до первого `pb:zepp-connect`
   и `{ available: true }` после.

9. **Настройки синхронизации.**

```js
await window.electronAPI.pb.syncSettingsGet()
// → { source: null, mode: 'manual', zepp_provider: null, ... }

await window.electronAPI.pb.syncSettingsUpdate({ zepp_provider: 'dofek-zepp' })
// → сохранено, повторный get вернёт новое значение
```

10. **`pb:zepp-connect` с реальными учётными данными.** Ввести email
    и пароль в блоке «Синхронизация» → нажать «Проверить подключение».
    Ожидаемо: `{ success: true, userId: '...', authHost: '...',
    dataHost: '...' }`. Пароль и токены в БД не хранятся в открытом
    виде. Неверный пароль → `{ success: false, error: '...' }`
    с перечнем хостов.

## Definition of Done

- Окно открывается, пункт меню есть, IPC `pb:ping` работает.
- Профиль читается и пишется через Melange.
- Настройки синхронизации читаются и пишутся.
- Три провайдера Zepp созданы и зарегистрированы; `dofek-zepp` —
  поверх `regionDetector.ts`, два других — заглушки.
- `pb:zepp-connect` реально вызывает `detectZeppConnection()`.
- `@dofek/zepp-client@0.1.44` установлен, импортируется, используется.
- Ничего из существующих модулей не сломано.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.
- `git commit` с осмысленным сообщением.

## Что НЕ делаем

- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline —
  это `10_UI_DUNA.md`.
- Бизнес-логику Core — это `02_CORE.md`.
- Реальные запросы к данным Zepp (тренировки, пульс) — это `07_SPICE.md`.
- Google Fit OAuth — это `07_SPICE.md`.
- Логику выбора и fallback провайдеров — это `07_SPICE.md`.



===========================
old version
===========================

# Направление 09: Electron Shell (окно, меню, IPC)

## Роль
Оболочка модуля: окно, маршрут, меню, IPC-хендлеры, регистрация
в главном процессе, экспонирование через preload, каркас провайдеров
Zepp.

## Зона ответственности
- Новое окно `pranaBinduWindow.ts` по образцу `osintWindow.ts`.
- Маршрут `#/prana-bindu` в `routes.tsx`.
- Страница `PranaBinduPage` (заглушка + блок синхронизации).
- Меню `pranaBinduWindowMenuTemplate` + пункт в `mainMenuTemplate`.
- Обработчик открытия окна в `main.ts` (как у OSINT).
- IPC-хендлеры `pranaBinduHandlers.ts` (каркас).
- Регистрация `registerPranaBinduHandlers()` в `main.ts`.
- Экспонирование `pb:*` методов через `preload.ts`.
- Каркас провайдеров Zepp в `spice/providers/` (заглушки).

## Что нужно сделать

### 1. Окно — `src/main/windows/pranaBinduWindow.ts`

По образцу `osintWindow.ts`:

- `createPranaBinduWindow(): BrowserWindow | null`
- `getPranaBinduWindow(): BrowserWindow | null`
- Размеры: 1400×900, min 1100×700.
- Загружает `#/prana-bindu`.
- Путь к preload — общий (`src/preload.ts`).

### 2. Страница — `src/pages/PranaBinduPage/`

- `PranaBinduPage.tsx` — заглушка с заголовком «Prana-Bindu»
  и подзаголовками модулей (Stillsuit, Crysknife, Mentat,
  Water Discipline, Spice).
- Блок «Синхронизация»: dropdown выбора провайдера
  (`dofek-zepp` / `zepp-mcp` / `zeppbridge`) и кнопка
  «Проверить доступность». Пока без реальной логики.
- `PranaBinduPage.css` — базовые стили, классы `.pb-*`.

### 3. Маршрут — `src/navigation/routes.tsx`

Добавить:

```tsx
<Route path="/prana-bindu" element={<PranaBinduPage />} />
```

### 4. Меню — `src/main/menus/windowMenus.ts`

- Добавить `pranaBinduWindowMenuTemplate` по образцу
  `osintWindowMenuTemplate`.
- В `mainMenuTemplate` → подменю «Файл» добавить пункт:

```ts
{ label: 'Открыть Prana-Bindu', id: 'open-prana-bindu' }
```

### 5. `src/main/main.ts`

- Импорт `createPranaBinduWindow`, `getPranaBinduWindow`.
- Импорт `registerPranaBinduHandlers`.
- В блоке `app.whenReady()` → найти пункт `open-prana-bindu`
  и назначить `click`, как у OSINT.
- Вызвать `registerPranaBinduHandlers()`.

### 6. IPC — `src/main/ipcHandlers/pranaBinduHandlers.ts`

Каркас с минимумом каналов:

- `pb:open-window` — открыть окно.
- `pb:ping` — health-check, возвращает `{ pong: true }`.
- `pb:get-profile` — чтение профиля.
- `pb:update-profile` — обновление профиля.
- `pb:sync-settings-get` — чтение настроек синхронизации.
- `pb:sync-settings-update` — обновление настроек.
- `pb:zepp-check-provider` — проверка доступности провайдера Zepp
  (возвращает `{ available: bool, reason?: string }`).

Остальные каналы добавляются по мере разработки модулей.

### 7. `src/preload.ts`

Добавить в `electronAPI`:

```ts
pb: {
  openWindow: () => ipcRenderer.invoke('pb:open-window'),
  ping: () => ipcRenderer.invoke('pb:ping'),
  getProfile: () => ipcRenderer.invoke('pb:get-profile'),
  updateProfile: (patch: any) => ipcRenderer.invoke('pb:update-profile', patch),
  syncSettingsGet: () => ipcRenderer.invoke('pb:sync-settings-get'),
  syncSettingsUpdate: (patch: any) => ipcRenderer.invoke('pb:sync-settings-update', patch),
  zeppCheckProvider: (name: string) => ipcRenderer.invoke('pb:zepp-check-provider', name),
},
```

### 8. Провайдеры Zepp (каркас, без реализации)

Создать `src/main/services/pranaBindu/spice/providers/`:

- `types.ts` — интерфейс `ZeppDataProvider`, типы `RawWorkout`,
  `ProviderCheckResult`.
- `dofekProvider.ts` — класс `DofekZeppProvider` (заглушка).
- `mcpProvider.ts` — класс `ZeppMcpProvider` (заглушка).
- `bridgeProvider.ts` — класс `ZeppBridgeProvider` (заглушка).
- `index.ts` — реестр провайдеров, `getProvider(name)`,
  `listProviders()`.

Интерфейс:

```ts
export interface ZeppDataProvider {
  name: string;
  isAvailable(): Promise<ProviderCheckResult>;
  fetchWorkouts(from: string, to: string): Promise<RawWorkout[]>;
}

export interface ProviderCheckResult {
  available: boolean;
  reason?: string;
}
```

Реализации — заглушки:
- `isAvailable()` возвращает `{ available: false, reason: 'not implemented' }`.
- `fetchWorkouts()` возвращает `[]`.

Полная реализация — в `07_SPICE.md`.

**Три провайдера и их назначение:**

1. **`dofek-zepp`** — прямой TypeScript-клиент
   (`@dofek/zepp-client`). Неофициальный. Требует Node.js 22.14+.
   Возвращает `appToken` через мобильный flow входа. Основной
   кандидат.

2. **`zepp-mcp`** — локальный MCP-сервер. Не требует телефона,
   root или Bluetooth. Работает через тот же облачный API.
   Вызывается как внешний процесс.

3. **`zeppbridge`** — локальный десктопный мост с CLI и MCP.
   Экспортирует JSON, CSV, GPX. Работает офлайн, данные не покидают
   машину. Вызывается через `child_process`.

Провайдеры 2 и 3 — резервные. Логика выбора и fallback — в
`07_SPICE.md`.

### 9. Настройки синхронизации в Melange

Таблица `sync_settings` дополняется полями:

```sql
zepp_provider TEXT,            -- 'dofek-zepp' | 'zepp-mcp' | 'zeppbridge'
zepp_fallback_provider TEXT,   -- резервный провайдер
zepp_credentials_json TEXT,    -- email/password (шифрование safeStorage)
zepp_last_sync_at TEXT,
zepp_last_sync_status TEXT
```

Соответствующие поля — в `08_MELANGE.md`. Если Melange уже
реализован, добавить миграцию.

### 10. Проверка `@dofek/zepp-client`

- Убедиться, что `node -v` ≥ 22.14.
- `npm install @dofek/zepp-client` — без конфликтов с
  существующими зависимостями.
- Импорт в main-процессе не падает.
- Пока НЕ вызываем `signInToZepp`, только проверяем установку.

## Ограничения

- Не трогать существующие окна и меню.
- Не менять порядок существующих пунктов меню — только добавить.
- Префикс `pb:*` не пересекается с `training:*` (Ollama) и `osint:*`.
- Preload не ломает текущий экспорт `electronAPI` — только расширяет.
- В `09` не реализуем реальные вызовы Zepp API — только каркас
  и заглушки.
- `appToken` и учётные данные Zepp не логируем, не коммитим,
  не храним в открытом виде.

## Проверка (ручные сценарии)

1. **Запуск.** `npm start` → в главном меню есть «Открыть Prana-Bindu».
2. **Открытие.** Клик → открывается окно с заголовком «Prana-Bindu»,
   внутри заглушка с названиями модулей и блок «Синхронизация».
3. **Повторный клик.** Окно фокусируется, дубликат не создаётся.
4. **Закрытие.** Закрыть окно → повторный клик снова открывает.
5. **IPC ping.** В DevTools консоли рендерера:

```js
await window.electronAPI.pb.ping()
// → { pong: true }
```

6. **Профиль.** `await window.electronAPI.pb.getProfile()` → объект
   профиля (пустой при первом запуске).
7. **Обновление профиля.**

```js
await window.electronAPI.pb.updateProfile({ age: 40, max_hr: 180 })
```

Профиль сохраняется, повторный `getProfile()` возвращает новые
значения.

8. **Проверка провайдеров.** В блоке «Синхронизация» выбрать
   `dofek-zepp` → нажать «Проверить доступность» → получить
   `{ available: false, reason: 'not implemented' }`. То же для
   остальных двух.
9. **Настройки синхронизации.**

```js
await window.electronAPI.pb.syncSettingsGet()
// → { source: null, mode: 'manual', zepp_provider: null, ... }

await window.electronAPI.pb.syncSettingsUpdate({ zepp_provider: 'dofek-zepp' })
// → сохранено, повторный get вернёт новое значение
```

10. **Установка `@dofek/zepp-client`.** Пакет в `package.json`,
    импорт в main-процессе не падает при старте приложения.

## Definition of Done

- Окно открывается, пункт меню есть, IPC `pb:ping` работает.
- Профиль читается и пишется через Melange.
- Настройки синхронизации читаются и пишутся.
- Три заглушки провайдеров Zepp созданы и зарегистрированы.
- Кнопка «Проверить доступность» возвращает `not implemented`.
- `@dofek/zepp-client` установлен, но не вызывается.
- Ничего из существующих модулей не сломано.
- `git commit` с осмысленным сообщением.

## Что НЕ делаем

- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline —
  это `10_UI_DUNA.md`.
- Бизнес-логику Core — это `02_CORE.md`.
- Реальную синхронизацию с Zepp — это `07_SPICE.md`.
- Google Fit OAuth — это `07_SPICE.md`.
- Логику выбора и fallback провайдеров — это `07_SPICE.md`.