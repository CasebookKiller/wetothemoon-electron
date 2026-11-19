# Архитектурные принципы — Prana-Bindu (не нарушать)

## Две линии тренировок

- **Stillsuit** — марафон (бег, пульс, темп, экономичность). Цель: 42,2 км 27.09.2027, старт подготовки 01.11.2026.
- **Crysknife** — Big-6 (6 движений × 10 ступеней), силовая по Convict Conditioning.

Пересекаются через **экономичность бега** и **восстановление** (Water Discipline).

## Внутренние имена (Дюна)

| Имя | Роль |
|---|---|
| **Prana-Bindu Core** | Движок зон, 80/20, фазы, ворота прогрессии |
| **Stillsuit** | Марафон |
| **Crysknife** | Big-6 |
| **Mentat** | Календарь, периодизация, каталог упражнений |
| **Water Discipline** | Восстановление (HRV, сон) |
| **Spice** | Аналитика, провайдеры, данные |
| **Melange** | Локальная БД (`prana_bindu.db`) |
| **Duna** | UI, визуал, стили |

## Изоляция слоёв

1. **`src/main/services/pranaBindu/` не импортирует `electron`.** Никаких `import { app } from 'electron'` в сервисах. Это правило железное — иначе сервисы нельзя тестировать вне Electron.
2. **`safeStorage` — только в handler** (`pranaBinduHandlers.ts`). Провайдеры и Melange остаются чистыми.
3. **Zero прямых обращений к БД из Core.** Core работает через слой Melange (репозитории), не через `db.prepare(...)`.
4. **Melange не импортирует `electron`.** Только `node:sqlite`.

## Методология тренировок

- **80/20**: ~80% объёма в зонах 1–2, ~20% в 4–5. Нарушение (систематический бег в З4 >20%) → автоблокировка.
- **SIRPOC** — сезонная периодизация (Base → Build → Peak → Taper).
- **Big-6** — только при benchmark + стабильном пульсе. Water Discipline блокирует прогрессию при низком HRV.
- **Прогрессия Big-6** — только через `checkProgressionGate` (Core). Не двигать вручную.

## Ключевые структуры данных

- **`run_facts`** — одна тренировка (одна строка = один источник). Дедуп по `(source, external_id)`.
- **`run_streams`** — потоки в `.msgpack` файлах, метаданные в БД.
- **`recovery_logs`** — wellness (сон, HRV, RHR, CTL/ATL). Merge по `date` (ICU + dodofo).
- **`plan_events`** — план из ICU. `local_keep` — «не удалять при mirror-синке».
- **`chains` / `chain_slots`** — цепочки маршрутов (v32/v33). `aggregate` = `best` | `sum`, `direction` = `any` | `forward` | `backward`.

## Архитектурные принципы (общие)

1. **Комментарии и UI-тексты — на русском.**
2. **`git commit` по группам, никогда `git add .`.**
3. **Правки — только в стиле «найти → заменить»** (два блока: что найти, на что заменить).
4. **`.bak-*` файлы не коммитить.**
5. **Токены `.env.local` — не выводить в чат/логи.**
6. **Не смешивать логику разных модулей.** Prana-Bindu не трогает Gateway, OSINT, Sietch.
7. **`training:*` ≠ Prana-Bindu.** `training:*` — fine-tuning Ollama, отдельная зона.
8. **Обновлять `PROJECT_STATE.md` при переключении чата.**
9. **`key.split('/').length`** в context_nodes = уровень (L0→L4). Не менять.

## Ключевые таблицы Melange (DDL — выжимка, v36)

```sql
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age INTEGER, max_hr INTEGER, lthr INTEGER, resting_hr INTEGER,
  weight_kg REAL, height_cm REAL, birth_date TEXT, gender TEXT DEFAULT 'male',
  goal_marathon_date TEXT, notes TEXT,
  hr_zones_json TEXT, pace_zones_json TEXT, threshold_pace_ms REAL,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, ordered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE chain_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  expected_repeats_min REAL NOT NULL DEFAULT 1,
  expected_repeats_max REAL NOT NULL DEFAULT 1,
  aggregate TEXT NOT NULL DEFAULT 'best',   -- 'best' | 'sum'
  min_coverage REAL NOT NULL DEFAULT 90,
  optional INTEGER NOT NULL DEFAULT 0,
  direction TEXT DEFAULT 'any',              -- 'any' | 'forward' | 'backward'
  clusters_json TEXT,
  specific_atoms_json TEXT,
  notes TEXT,
  FOREIGN KEY (chain_id) REFERENCES chains(id) ON DELETE CASCADE
);

CREATE TABLE water_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  amount_ml INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  weight_kg REAL NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE nutrition_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  meal_type TEXT NOT NULL, food_name TEXT NOT NULL,
  calories INTEGER, protein_g REAL, fat_g REAL, carbs_g REAL,
  source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL
);
```

**`SCHEMA_VERSION = 36`.** Миграции — массив функций, версия в `meta.schema_version`.

## ChainSlot (18b) — модель цепочки

```typescript
interface ChainSlot {
  clusters?: string[];                                    // группа похожих атомов
  specificAtoms?: number[];                               // конкретные атомы
  expectedRepeats: number | { min: number; max: number }; // повторы
  optional: boolean;
  minCoverage?: number;                                   // % покрытия КП
  direction?: 'any' | 'forward' | 'backward';             // v33
}
```

**`group:` (кластер)** — множество похожих. **`chain:` (цепочка)** — последовательность. `evaluateChain` учитывает `aggregate='sum'`, `minCoverage`, `direction`. Фундамент для 18 C.7 «Территория».

## Exercise Graph модель (16)

**7 kinds узлов:**
| Kind | Что |
|---|---|
| `pattern` | Биомеханический паттерн (13 корневых) |
| `exercise` | Упражнение. `isCanonical: true` — группа, `false` — конкретный уровень |
| `program` | Тренировочная программа |
| `catalog` | Источник (Wade, Cali, Thenics, Named, Smithrun) |
| `modality` | Способ (ring / band / weighted / …) |
| `tissue` | Анатомическая цель прехаба |
| `skill` | Технический навык бега (drills) |

**14 kinds рёбер:** `progresses-to`, `variant-of`, `progression-from`, `instance-of`, `belongs-to`, `equivalent-to`, `requires`, `conflicts-with`, `trains`, `targets`, `warms-up`, `used-in`, `modality-of`, `parent-of`.

**Сейчас:** только Wade (76 узлов / 210 рёбер). Остальные каталоги — этап B.

## Zepp-direct каркас (09)

**`@dofek/zepp-client@0.1.44`** (установлен).
- `signInToZepp(email, password, fetchFn = globalThis.fetch)` — третий аргумент вызывается (подмена хостов покрывает флоу).
- US2-хосты: `api-user-us2.zepp.com/v2/registrations/tokens`, `api-mifit-us2.zepp.com/v2/client/login`.
- `regionDetector.ts` — автодетект хостов (готов).
- `dofekProvider.ts`, `mcpProvider.ts`, `bridgeProvider.ts` — **заглушки**, реальные запросы — TODO (07 Spice после Push в ICU).

## Уроки марафона-7 (2026-09-27)

- **Пульс:** 145-155 вместо марафонской зоны 134-142.
- **Первые 2 км:** слишком быстро (6:42/км) — ошибка.
- **Стопы:** ныли на 30+ км — нужно укреплять (prehab, задача G).
- **Данные dodofo:** были искажены, исправлено 2026-09-30 (см. П1).
- **GPS в Москве:** глушат (СВО). Дистанция/темп — от акселерометра, но трек пишется и сохраняется.

**Влияет на 02 Core:** зоны и `checkEightyTwenty` должны учитывать эти уроки (не «идеальный» марафон, а «с текущими ошибками»).

## Browser-канал > API (принцип, 2026-11-19)

**API-канал — fallback.** Активная разработка — **браузерный** канал:
- DeepSeek (patchright + Chrome stealth) — текущий.
- GigaChat, Алиса, Duck.ai, g4f, HuggingChat — **recon** (browser-интерфейс).
- Параллельные браузеры: N `BrowserContext` через `BrowserPool` (пока в планах).
- Cookie/fingerprint трекинг — `cookieTracker.ts` (расширяется).

**Почему:** паттерн бана (20:00–22:00) → API-канал во время бана **бесполезен** (это тот же DeepSeek). Browser-канал с несколькими провайдерами — единственный способ **утилизировать окно**.

**Следствие:** `tokenCounter.ts` (API-бюджет) — **отложен**. `ProviderAdapter` + `BrowserPool` — **приоритет**.

### Browser-канал: архитектура (фундамент)

```
src/main/services/gateway/
├── providers/
│   ├── types.ts                   ← ProviderAdapter interface
│   ├── registry.ts                ← registerProvider / getProvider
│   ├── deepseek/{adapter,selectors,cookiePatterns}.ts
│   ├── alice/{adapter,selectors,cookiePatterns}.ts
│   └── gigachat/{adapter,selectors,cookiePatterns}.ts
├── pool/
│   ├── BrowserPool.ts             ← N BrowserContext, acquire/release
│   ├── TaskQueue.ts               ← очередь задач по приоритету
│   └── ProfileRouter.ts           ← профиль → провайдер
└── cookieTracker.ts               ← УЖЕ ЕСТЬ, расширить fingerprint
```

**`ProviderAdapter`** — единый интерфейс для всех провайдеров:
```ts
interface ProviderAdapter {
  name: string;
  connect(context: BrowserContext): Promise<void>;
  sendMessage(ctx, message, opts): AsyncIterable<Chunk>;
  getConversations(ctx): Promise<Conversation[]>;
  cookiePatterns: CookiePattern[];
  selectors: ProviderSelectors;  // input, send, response, stream
}
```

### Открытые вопросы по BrowserPool (на следующую сессию)

1. **Параллельность:** A) N аккаунтов одного провайдера / B) N разных провайдеров / C) N задач в одном аккаунте — какой приоритет?
2. **IP-изоляция:** 5 браузеров с одного IP → ускоренный бан. Прокси per-profile (SOCKS5) / VPN per-profile / один IP (готовы к быстрому бану)?
3. **Порядок:** `BrowserPool` → recon → cookie? Или Duck.ai smoke → pool → cookie?
4. **Аккаунты:** GigaChat (SberID/телефон/SMS) и Алиса (Yandex ID) — уже есть? Регистрация — отдельный трек?
5. **Cookie глубина:** a) cookies / b) + localStorage / c) + fingerprint / d) + TLS (JA3)?

## Проверка перед коммитом

- `git status --short` — только ожидаемые файлы.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.
- `grep -rn "dodofo_token\|intervals_api_key\|zepp_app_token" src/ | grep -v "safeStorage"` — пусто (кроме чтения из `sync_settings`).
- `docs/` — не коммитить.