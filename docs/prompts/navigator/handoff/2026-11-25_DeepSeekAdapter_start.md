# Navigator — Этап 1.5: DeepSeekAdapter (основной рабочий провайдер)

> Продолжение работы. Приоритет 1 (GigaChat sync) закрыт 2026-11-25.
> Handoff предыдущей сессии: `docs/prompts/navigator/handoff/2026-11-25.md`.
> **DeepSeek — основной инструмент**, подход внимательный, не спринт.

## Контекст

Navigator — универсальный Browser Hub. GigaChat уже работает end-to-end (sync, favorites, порядок, conversation-saved). Теперь — DeepSeek через browser (patchright), не через API.

**Архитектура (не менять):**
- `PROVIDER_TO_TOOL` в `sessionManager.ts:28` — мапа provider→toolId
- `makeLlmTool(id, name, options?)` в `llmTool.ts` — обёртка над `ProviderAdapter`
- `navigator:send` — провайдер резолвится из профиля, UI не меняется
- `MessageChunk` — универсальный контракт, `format: 'text' | 'markdown' | 'html'`
- БД схема v11, `conversations.position`, `messages.content_html`

**Контракт стрима (уже есть в `providers/types.ts`):**
```typescript
interface MessageChunk {
  type: 'text' | 'reasoning' | 'usage' | 'done' | 'error';
  text?: string;
  reset?: boolean;        // html-режим: заменить буфер
  format?: ChunkFormat;   // 'text' | 'markdown' | 'html'
  usage?: { promptTokens?, completionTokens?, totalTokens? };
  meta?: Record<string, unknown>;
}

interface ProviderAdapter {
  sendMessage(page: Page, message: string, opts?: SendMessageOpts): AsyncIterable<MessageChunk>;
  getConversations?(page: Page): Promise<Conversation[]>;
  isLoggedIn?(page: Page): Promise<boolean>;
}
```

**GigaChatAdapter** — эталон. Читать перед началом: `src/main/services/gateway/providers/gigachat/adapter.ts`.

## Ключевое отличие от GigaChat

| Аспект | GigaChat | DeepSeek |
|---|---|---|
| Формат ответа | **HTML** (`MarkdownRoot.innerHTML`) | **Markdown** (сырой текст) |
| Стрим-механика | Чанки с `reset: true` | Вероятно, append |
| Reasoning | Нет | **Возможно** (`thinking` перед ответом) |
| Cookies | Стабильные | **Могут ротироваться в WAF mid-stream** |
| Селекторы | Готовы, recon-скрипты | **Recon нужен** |

## Что УЖЕ есть в проекте (не писать с нуля)

1. **`src/main/services/gateway/deepseekService.ts`** — legacy Gateway-сервис. **НЕ трогать**, но **прочитать**: там уже есть работа с DS-браузером, селекторы, стрим. Это может быть 60–80% готового кода.
2. **`src/main/services/gateway/deepseekApiService.ts`** — API версия (не нужна нам, браузер лучше).
3. **`src/main/services/gateway/providers/deepseek/adapter.ts`** — заглушка? Прочитать, понять состояние.
4. **`scripts/mjs/test-deepseek/*`** — 6 recon-скриптов. Запустить по одному, собрать DOM-дампы.
5. **`DeepSeek` в `ProviderRegistry`** — уже зарегистрирован на уровне Gateway.

## План работы (поэтапно, с чек-поинтами)

### Фаза 0 — Recon (30 мин, БЕЗ кода)

1. Прочитать `deepseekService.ts` целиком — что уже работает.
2. Прочитать `providers/deepseek/adapter.ts` — что за заглушка.
3. Запустить `test-deepseek/*` по одному:
   - `test-deepseek-api` — проверить API (для сравнения)
   - `test-deepseek-models` — список моделей
   - `test-deepseek-stream` — стрим
   - Остальные 3 — что покажут
4. **Открыть DS в браузере** через наш patchright-профиль (`p_mwuafzcr_l5ki` или аналогичный). Сделать руками:
   - Отправить сообщение
   - Открыть DevTools
   - Найти селекторы: input, send button, message containers (user/assistant), streaming indicator, reasoning block, stop button
   - **Записать в handoff**: точные селекторы + скриншот DOM

### Фаза 0.5 — Persistence DS cookies (15 мин, БЕЗ кода)

**Цель:** убедиться, что cookies DS переживают закрытие/открытие app. Без этого DS-адаптер не имеет смысла.

**Проверить:**
1. `grep -n "launchPersistentContext\|storageState\|YANDEX" deepseekService.ts` — что загружается/сохраняется.
2. `ls ~/.config/wetothemoon-electron/profiles/p_mwuafzcr_l5ki/chrome-profile/Default/Cookies` — persistent работает?
3. `find ~/.config/wetothemoon-electron -name "storage-state*.json"` — JSON есть?
4. **Реальный тест:** залогиниться → DevTools → cookies Expires → graceful close → reopen → залогинен?
5. **DevTools → Cookies:** сколько Session cookies? Если много — проблема.

**Красные флаги:**
- `storageState save` есть, `load` нет — от второго механизма пользы нет.
- Chrome не graceful close — cookies не флашатся.
- Много Session cookies — DS политика, нужна стратегия auto-relogin.

**Если тест провален** — сначала фикс persistence (15–30 мин), потом адаптер.

### Фаза 1 — Контракт адаптера (15 мин)

Написать **пустой скелет** `DeepSeekAdapter` с типами, но без реализации:
- `sendMessage` — заглушка с TODO
- `getConversations` — заглушка
- `isLoggedIn` — заглушка

Зафиксировать в handoff: что делает каждый метод, какой формат чанков.

### Фаза 2 — sendMessage (главное, 40 мин)

Реализовать стрим:
- Ввод текста в input
- Клик по send
- Ожидание начала ответа
- Стрим: слушать DOM-мутации (MutationObserver в `page.evaluate` + polling)
- Определить момент `done`
- Отдавать чанки: `{type: 'text', text: delta, format: 'markdown'}`
- Если есть reasoning — `{type: 'reasoning', text}`
- В конце `{type: 'done'}`

**Особенности:**
- **Markdown, не HTML** — DS отдаёт чистый markdown, форматируем на клиенте
- **Append, не reset** — в отличие от GigaChat, скорее всего дельта-стрим
- **AbortSignal** — проверять `opts.signal?.aborted` в цикле
- **Retry на WAF-rotate** — если стрим прервался и сессия истекла, повторить 1 раз
- **Timeout safety** — 180с max (DS думает дольше GigaChat)

### Фаза 3 — Регистрация (10 мин)

1. `sessionManager.ts:28` — добавить `deepseek: 'deepseek'` в `PROVIDER_TO_TOOL`
2. `llmTool.ts:initTools()` — `register(makeLlmTool('deepseek', 'DeepSeek'))`
3. `hasSession(profileId, 'deepseek')` — проверить что смотрит домен DS, не только «профиль авторизован»

### Фаза 4 — Тест end-to-end (15 мин)

1. UI: выбрать DS-профиль в Sidebar.
2. Отправить сообщение → стрим идёт → ответ рендерится (markdown → HTML через `renderMarkdown`).
3. Сохранение в БД (`conversation-saved`).
4. Автопереезд диалога наверх (debounced syncConversations, как у GigaChat).
5. **Прерывание стрима** — нажать «Отправить» во время стрима? Или AbortSignal.

### Фаза 5 — Handoff + коммиты

Записать уроки, коммиты по группам.

## Риски (закрыть ДО кода)

1. **Cookies DS persistence** — проверить `userDataDir` в `ProfileService`. Если не сохраняет между запусками — капчи чаще. Тест: закрыть app → открыть → проверить что DS залогинен.
2. **WAF-rotate mid-stream** — если DS ротирует токен во время ответа, стрим рвётся. Решение: retry в адаптере (1 попытка) + safety-timer в UI (135с уже есть).
3. **Селекторы нестабильны** — DS часто редизайнит. Решение: вынести селекторы в константы, добавить fallback-цепочки (`[data-testid="..."]` + классы + aria-labels).
4. **Reasoning block** — если DS показывает «thinking», надо ли его стримить в UI? По контракту `type: 'reasoning'` есть, но UI его сейчас игнорирует. **Решить:** показывать или нет.
5. **Stop button** — если пользователь хочет прервать, есть ли в DS кнопка «Stop»? Реализовать AbortSignal → клик по Stop.

## Правила работы (из общего контекста)

- Формат правок: «найти → заменить» (два блока), не diff.
- `git commit` по группам, **никогда `git add .`**.
- Не коммитить: `scripts/manifest.json`, `scripts/test-intervals-abort.mjs`, `intervalsIcuProvider.ts`.
- Gateway не ломать — `deepseekService.ts` остаётся рабочим для legacy.
- `npm run start` (не `dev`).
- `patchright` не заменять.
- Перед правкой общих типов — читать файл целиком.

## Что подготовить в первом сообщении

1. `cat src/main/services/gateway/deepseekService.ts | head -100` — понять что уже есть.
2. `cat src/main/services/gateway/providers/deepseek/adapter.ts` — состояние заглушки.
3. `ls scripts/mjs/test-deepseek/` + запуск по одному.
4. `sed -n '20,40p' src/main/services/navigator/sessionManager.ts` — PROVIDER_TO_TOOL.
5. `sed -n '40,80p' src/main/services/navigator/llmTool.ts` — makeLlmTool + initTools.
6. `cat src/main/services/gateway/providers/gigachat/adapter.ts | head -80` — эталон для сверки (только header + метод getCurrentMessages).

## Стартовый вопрос к ассистенту

«Читаем deepseekService.ts + providers/deepseek/adapter.ts + запускаем recon-скрипты. Задача — понять, что уже готово, и составить план реализации DeepSeekAdapter без переписывания с нуля. Не пишем код, пока не увидим recon-результаты.»