# GATEWAY: Multi-Account + Memory + Tools Roadmap

Сохрани этот документ в `GATEWAY_MULTI_ACCOUNT_ROADMAP.md` — это отдельный трек от markdown-фиксов.

---

## Принципы (чтобы не переделывать)

1. **Session isolation с первого дня.** Даже если UI показывает 1 активный аккаунт — под капотом N независимых объектов. Никакой глобальный стейт.
2. **`profileId` везде.** В IPC, в bridge-событиях, в БД (уже есть), в API-ответах. Default = активный профиль.
3. **Обратная совместимость.** `DeepSeekService.getInstance()` остаётся как thin adapter → `Manager.getActive()`. Все 100+ существующих вызовов работают без изменений.
4. **Инкрементальность.** Каждая фаза — рабочее приложение. Нельзя «сначала 5 фаз, потом тест».

---

## Phase 1 — Session Abstraction (2-3 дня) ⭐ ФУНДАМЕНТ

**Цель:** `DeepSeekService` (singleton) → `DeepSeekSession` (per-profile instance) + `GatewaySessionManager` (Map). **UI не меняется.**

### Структура
```
src/main/services/gateway/
├── DeepSeekSession.ts      ← новый (выделяется из deepseekService.ts)
│   ├─ browser, context, page, bridgeEmitter
│   ├─ isLoggedIn, profileId, cdpPort
│   └─ все текущие методы: launch, sendMessage, snapshotHistory, ...
├── GatewaySessionManager.ts ← новый (singleton, но singleton — менеджер, не сессия)
│   ├─ sessions: Map<profileId, DeepSeekSession>
│   ├─ getActive(), get(profileId), create(profileId), destroy(profileId)
│   ├─ switchProfile(id) — только переключает activeId в ProfileService
│   └─ eventBus: EventEmitter ← агрегирует события из всех sessions
└── deepseekService.ts      ← остаётся, но как thin proxy
    └─ static getInstance() → Manager.getActive()
```

### Ключевое решение: **backward compatibility**

```typescript
// deepseekService.ts (после рефакторинга)
export class DeepSeekService {
  static getInstance(): DeepSeekSession {
    return GatewaySessionManager.getInstance().getActive();
  }
}
```

Все существующие IPC-хендлеры (`gateway:send-message`, `gateway:launch` и т.д.) **продолжают работать** — они получают `getInstance()` → активную сессию. **Ноль изменений в gatewayHandlers.ts.**

### Bridge events — через шину

```typescript
// GatewaySessionManager
getEventBus(): EventEmitter {
  // события от всех sessions: { profileId, type, payload, ts }
}

// GatewayPage.tsx — фильтр по profileId
api.onGatewayBridgeEvent((event) => {
  if (event.profileId !== activeProfileId && !showAllSessions) return;
  // ...
});
```

**Старые bridge-события** (без `profileId`) → считаются от активного. Новые — с `profileId`. Оба формата работают.

### Критерии готовности Phase 1
- `npx tsc --noEmit` чист
- Все существующие функции GW работают **как раньше**
- `Manager.list()` возвращает N сессий (только активная инициализирована, остальные lazy)
- Bridge-события содержат `profileId`

---

## Phase 2 — Parallel UI + Pool (2 дня) ⭐ ПАРАЛЛЕЛИЗМ

**Цель:** UI показывает 2+ аккаунта **одновременно**, отправка в любой без switch.

### UX — три варианта, делать все три (по возрастанию сложности)

**2A. Sidebar badge (простой, 2 часа)**
- Каждый диалог в sidebar помечен иконкой аккаунта (маленький аватар)
- Клик на диалог → если `profile_id` другой, `switchProfile` неявно
- **Пользователь видит, какой аккаунт где**

**2B. Tabs (средний, 1 день)**
- Сверху GW — табы: `Основной · kuznetsov.proff · ...`
- Каждый таб = один аккаунт + одна открытая беседа
- Отправка в активный таб
- **Пользователь работает с 2-3 параллельно**

**2C. Broadcast (1 час поверх B)**
- Кнопка «Отправить во все табы» → `Manager.broadcast(profileIds[], msg)`
- Ответы собираются в один view «сравнение»
- **Пользователь сравнивает 2-3 модели на один вопрос**

### Pool — контроль RAM

```typescript
class GatewaySessionManager {
  private maxLiveSessions = 5;   // настраивается
  private lruOrder: string[] = [];
  
  private evictIfNeeded() {
    while (this.sessions.size >= this.maxLiveSessions) {
      const oldest = this.lruOrder.shift();
      const session = this.sessions.get(oldest);
      if (session && !session.isBusy()) {
        session.destroy();  // kill Yandex, освободить RAM
        this.sessions.delete(oldest);
      }
    }
  }
}
```

**На T480s** с 16 GB → `maxLiveSessions = 5` (5 × 400 MB = 2 GB — норм). С 8 GB → 3.

### Критерии готовности Phase 2
- Открыты 2+ аккаунта, каждый со своим диалогом
- Отправка в любой — работает
- Закрытие таба → сессия в LRU → через N минут kill
- `broadcast` — 3 ответа на 1 вопрос

---

## Phase 3 — Pipeline Engine (2 дня) ⭐ КОНВЕЕР

**Цель:** автоматический последовательный прогон с ролями.

### Модель данных

```typescript
// pipeline-presets.json
{
  "version": 1,
  "presets": [{
    "id": "red-team",
    "name": "Red Team Review",
    "steps": [
      { "role": "analyst", "profileId": "p_acc2",
        "prompt": "Разбери задачу:\n{input}",
        "outputFormat": "text" },
      { "role": "critic", "profileId": "p_acc3",
        "prompt": "Найди слабые места в анализе:\n{input}",
        "outputFormat": "text" },
      { "role": "synthesizer", "profileId": "default",
        "prompt": "Собери финальный ответ из анализа и критики:\n{input}",
        "outputFormat": "text" }
    ]
  }]
}
```

### Engine

```typescript
class PipelineEngine {
  async run(presetId: string, input: string): Promise<PipelineRun> {
    const preset = loadPreset(presetId);
    const run: PipelineRun = { id, presetId, startedAt, steps: [], status: 'running' };
    
    let payload = input;
    for (const step of preset.steps) {
      const stepStart = Date.now();
      const session = manager.get(step.profileId) || await manager.create(step.profileId);
      await manager.setActive(step.profileId);  // UI видит прогресс
      
      const prompt = step.prompt.replace('{input}', payload);
      const response = await session.sendMessage(prompt, { newConversation: true });
      
      // Сохраняем в БД с меткой pipeline_run
      await cache.syncConversation(response.conversationId, {
        title: `[${run.id}] ${step.role}`,
        profileId: step.profileId,
        metadata: { pipelineRunId: run.id, role: step.role }
      });
      
      run.steps.push({
        role: step.role, profileId: step.profileId,
        input: payload, output: response.fullHtml || response.blocks.map(b => b.content).join('\n'),
        conversationId: response.conversationId,
        elapsedMs: Date.now() - stepStart,
      });
      
      payload = run.steps[run.steps.length - 1].output;
    }
    
    run.status = 'completed';
    return run;
  }
}
```

### UI

- Модалка «Запустить конвеер» → пресет + вопрос + «Запустить»
- Прогресс: 1/3 (analyst, ~15с) → 2/3 (critic, ~10с) → 3/3 (synth, ~8с)
- История прогонов в sidebar — как отдельная группа диалогов

### Критерии готовности Phase 3
- 3-шаговый конвеер проходит за ~30-40с
- Каждый шаг — отдельный диалог в своём аккаунте
- Прогресс виден в UI
- Отмена на любом шаге (abort controller)

---

## Phase 4 — Tool Calling (3-4 дня) ⭐ РАСШИРЕНИЕ

**Важный момент:** DeepSeek chat UI **не поддерживает** function calling как API. Поэтому — prompt-based:

### Протокол

```
System-prompt в каждый tool-enabled чат:
"Ты можешь вызывать инструменты. Формат:
```tool:имя_инструмента
{"arg": "value"}
```
Доступные: web_search, sqlite_query, read_file, write_file.
Когда даёшь финальный ответ — просто текст без блоков tool."
```

### Loop

```typescript
async function sendWithTools(session: DeepSeekSession, prompt: string, tools: Tool[]): Promise<string> {
  let payload = prompt;
  const MAX_ITER = 10;
  
  for (let i = 0; i < MAX_ITER; i++) {
    const response = await session.sendMessage(payload);
    const text = extractText(response);
    const toolCall = parseToolCall(text);   // ```tool:name\n{json}```
    
    if (!toolCall) return text;   // финальный ответ
    
    const result = await executeTool(toolCall, tools);
    payload = `Результат ${toolCall.name}: ${JSON.stringify(result)}\n\nПродолжай.`;
  }
  
  throw new Error('Tool loop exceeded');
}
```

### ToolRegistry

```typescript
interface Tool {
  name: string;
  description: string;
  schema: JSONSchema;    // для промпта
  execute: (args: unknown, ctx: ToolContext) => Promise<unknown>;
}

const BUILTIN_TOOLS: Tool[] = [
  {
    name: 'web_search',
    description: 'Поиск в интернете',
    schema: { query: 'string', max_results: 'number?' },
    execute: async ({ query, max_results }) => {
      // Через PW: активируем «Умный поиск» → sendMessage → парсим источники
      // Или напрямую через fetch к DuckDuckGo
    }
  },
  {
    name: 'sqlite_query',
    description: 'Поиск в истории всех аккаунтов',
    schema: { query: 'string', limit: 'number?' },
    execute: async ({ query, limit }) => {
      return cache.searchMessages(query, limit || 10);
    }
  },
  {
    name: 'read_file',
    description: 'Прочитать файл из вложений',
    schema: { resourceKey: 'string' },
    execute: async ({ resourceKey }) => ResourceService.getContentByKey(resourceKey)
  }
];
```

### Критерии готовности Phase 4
- Модель в GW умеет: `web_search` (поиск через PW)
- Tool-call detected → выполнен → результат возвращён модели → финальный ответ
- Отображение tool-trail в UI (какие вызовы были)

---

## Phase 5 — Long-term Memory (3-4 дня) ⭐ ПАМЯТЬ

**Цель:** RAG через **все** аккаунты. «Что я обсуждал про X 3 недели назад в acc2?»

### Архитектура

**5.1 Schema (migration v9)**
```sql
CREATE TABLE message_embeddings (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  embedding BLOB NOT NULL,        -- float16[384]
  model TEXT NOT NULL,             -- 'minilm-l6-v2'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE INDEX idx_emb_profile ON message_embeddings(profile_id);

-- sqlite-vec extension (если доступен)
CREATE VIRTUAL TABLE message_vec USING vec0(
  message_id TEXT PRIMARY KEY,
  embedding float[384]
);
```

**5.2 Embeddings pipeline**
```typescript
class EmbeddingsService {
  async embedAndStore(messageId: string, text: string, profileId: string): Promise<void> {
    const vec = await this.embed(text);          // local model
    this.db.prepare(`INSERT INTO message_embeddings ...`).run(...);
  }
  
  private async embed(text: string): Promise<Float32Array> {
    // Вариант A: local (transformers.js + all-MiniLM-L6-v2, ~80MB)
    // Вариант B: DeepSeek API embeddings endpoint
  }
}
```

**Batch backfill:** для существующих 1461 сообщений — 5-10 минут на local модели.

**5.3 Retrieval + Injection**
```typescript
class MemoryService {
  async retrieve(query: string, opts: { profileIds?, topK = 5 }): Promise<MemoryHit[]> {
    const qVec = await embed(query);
    // cosine sim через sqlite-vec (или brute force если < 100K)
    return this.db.prepare(`
      SELECT m.content_plain, m.profile_id, m.saved_at,
             vec_distance_cosine(message_vec.embedding, ?) AS dist
      FROM message_vec
      JOIN messages m ON m.id = message_vec.message_id
      WHERE m.role IN ('user', 'assistant')
        ${opts.profileIds ? 'AND m.profile_id IN (...)' : ''}
      ORDER BY dist ASC
      LIMIT ?
    `).all(qVec, opts.topK);
  }
  
  buildMemoryPrompt(hits: MemoryHit[]): string {
    return `Релевантный контекст из прошлых обсуждений:\n\n` +
      hits.map(h => `[${h.profile_id}, ${formatDate(h.saved_at)}]\n${h.content_plain}`).join('\n\n');
  }
}
```

**5.4 Интеграция с Pipeline**
```typescript
// В каждый step
const memories = await memory.retrieve(step.prompt, {
  profileIds: step.memorySources || undefined,  // «только из default + acc2»
  topK: 5
});
const fullPrompt = memory.buildMemoryPrompt(memories) + '\n\n---\n\n' + step.prompt;
```

**5.5 Настройки в UI**
- Per-step: `memorySources: ['default', 'p_acc2']` (или `'all'`)
- Global: «Использовать память» в TopPanel
- Индикатор: перед отправкой «N memories injected»

### Критерии готовности Phase 5
- Вопрос «что я говорил про X» → модель получает top-5 relevant из всех аккаунтов
- Pipeline с `memorySources` работает
- Backfill 1461 существующих сообщений за < 10 мин

---

## Phase 6 — Advanced Orchestration (ongoing)

По мере необходимости, не блокирует:

- **Conditional pipeline** — «если critic нашёл проблемы → loop, иначе → дальше»
- **Parallel fan-out** — в 3 аккаунта одновременно, потом merge (`Manager.broadcast`)
- **Human-in-the-loop** — пауза на шаге, подтверждение в UI
- **Cost tracking** — счётчик запросов на аккаунт в час
- **Auto-fallback** — если аккаунт rate-limited → switch на следующий, тест повторяется

---

## Schema Migrations Summary

| Версия | Что | Когда |
|---|---|---|
| v8 | `profile_id` в `conversations`, `messages` ✅ | **готово** |
| v9 | `message_embeddings`, `message_vec` (sqlite-vec) | Phase 5 |
| v10 | `pipeline_runs`, `pipeline_steps` (история) | Phase 3 |
| v11 | `tool_calls_log` (аудит) | Phase 4 |

**Важно:** каждая миграция — **обратно совместимая** (только ADD COLUMN/ADD TABLE). Rollback = старый код не видит новые таблицы.

---

## Risk register

| Риск | Влияние | Митигация |
|---|---|---|
| Phase 1 refactor ломает 100+ вызовов | 🔴 Всё приложение | Backward-compat `getInstance()` → `getActive()` |
| Bridge events из N сессий путаются | 🟡 UI не тот аккаунт показывает | `profileId` в payload с первого дня |
| RAM с 5+ Yandex | 🟡 Swap/OOM | LRU Pool + `maxLiveSessions` конфиг |
| DeepSeek rate-limit | 🟡 429 на активной сессии | Auto-fallback на другой профиль |
| Tool calling prompt-based | 🟡 Модель иногда не следует формату | 3 retry → fallback на plain response |
| Embedding quality | 🟢 RAG мимо | A/B: MiniLM vs DeepSeek API |

---

## Open questions (ответить до старта Phase)

**Q1 (для Phase 2):** Табы vs колонки?
- **Табы** — 1 активный, переключение
- **Колонки** — 2-3 одновременно видны (место в UI)

**Q2 (для Phase 3):** Presets — фиксированные или user-editable в UI?
- Fixed JSON → проще, меньше риска
- Editor в UI → гибче, +1 день работы

**Q3 (для Phase 4):** Tools — какие в первую очередь?
- `web_search` (через PW, есть уже)
- `sqlite_query` (поиск по БД, есть)
- `read_file` (вложения, есть через ResourceService)
- `http_fetch` (fetch URL → текст)
- `shell` (опасно, только sandbox)

**Q4 (для Phase 5):** Embedding model?
- **Local** MiniLM-L6-v2 — 80MB, ~50ms/message, 0 сетевых запросов, бесплатно
- **DeepSeek API** — качество выше, но нужен API key + сеть + cost
- **Local bigger** BGE-small — 130MB, лучше для русского

**Q5:** Параллельные аккаунты — 5 максимум одновременно, или сколько хочешь?

---

## Порядок реализации (рекомендация)

```
Week 1: Phase 1 (Session Abstraction) + Phase 2A (badge в sidebar)
Week 2: Phase 2B (tabs) + Phase 2C (broadcast)
Week 3: Phase 3 (Pipeline Engine)
Week 4: Phase 4 (Tools)  → web_search + sqlite_query
Week 5: Phase 5 (Memory) → local embed + RAG
Week 6: Phase 6 (advanced) + polish
```

**Каждая неделя — рабочая версия с новой функцией.** Не «заблокирован на 2 недели, потом релиз».

---

## Что делать сейчас

1. **Сохрани этот roadmap** в `GATEWAY_MULTI_ACCOUNT_ROADMAP.md` (или допиши в `GATEWAY_ROADMAP.md` как раздел).
2. **Ответь на Q1-Q5** — от них зависит финальный дизайн Phase 2/3/4/5.
3. **Phase 1 — старт.** Это большой, но механический рефакторинг. Без него всё остальное = переделывать дважды.
4. Параллельно закрываем текущие мелочи (kill-zombies косметика, markdown в другом чате) — они **не блокируют** Phase 1.

**Если хочешь — на следующем шаге дам детальный план Phase 1** (файл за файлом, метод за методом, что удаляется/добавляется/переносится). Это будет большая работа, но расписанная пошагово.