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

## Проверка перед коммитом

- `git status --short` — только ожидаемые файлы.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.
- `grep -rn "dodofo_token\|intervals_api_key\|zepp_app_token" src/ | grep -v "safeStorage"` — пусто (кроме чтения из `sync_settings`).
- `docs/` — не коммитить.