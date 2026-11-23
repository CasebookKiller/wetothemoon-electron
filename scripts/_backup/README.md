# scripts/_backup/

Архив скриптов, выведенных из активного оборота в реорганизации 2026-11-23.
Ничего отсюда не вызывается из приложения. Физически оставлено на 1–2 сессии
для откатa.

## Категории

### 1. Gateway-дубли (были скопированы в `mjs/`/`bash/` 2026-11-21)
Root-версии устарели, канон — в подпапках.

- `preflight-check.mjs`         → канон `mjs/preflight-check.mjs`
- `sync-submodule.sh`           → канон `bash/sync-submodule.sh`
- `test-context-service.mjs`    → канон `mjs/test-context-service.mjs`
- `test-cont-source.mjs`        → канон `mjs/test-cont-source.mjs`
- `gen-context-manifest.mjs`    → канон `mjs/gen-context-manifest.mjs`

### 2. Мёртвые утилиты (0 вызовов, узкая польза)
- `sizes.sh`      — one-liner (`find . -name "*.md" | wc -m`)
- `tree.sh`       — демо `tree` + один полезный вызов в конце
- `fit_probe.mjs` — разбор Garmin `.fit` (спорт/личное, сентябрь 2026)
- `check-icon.sh`         — разовая диагностика `.desktop` (Linux, Yandex GW)
- `svg-to-gateway-icon.sh` — разовая конвертация SVG → PNG для иконки
- `inject-cookies.mjs` — старая версия (без patchright), канон `mjs/inject-cookies-patchright.mjs`

### 3. Закрытые эксперименты
- `recon-profile-menu{,v2..v5}.mjs` (5 версий) — итерации 2026-11-16 за 10 минут,
  эксперимент закрыт. Документированы в `docs/prompts/gateway/topics/03_RECON.md:88`
  как «профиль-меню (5 версий)».

### 4. Не Gateway (перенести в правильный модуль при касании)
- `kad-test/` (5 файлов) — тестовый harness **Kad.Arbitr** (OSINT/SIETCH).
  См. `src/main/services/osint/scrapers/kadArbitr/`. Перенести в `osint/scripts/`
  или удалить, если устарел.
- `zepp/` (2 файла) — probes клиента Zepp (prana-bindu). См.
  `src/main/services/pranaBindu/melange/`. Перенести в `prana-bindu/scripts/`.

> **Оставлено на месте (не в `_backup/`):** `test-intervals-abort.mjs` в `scripts/` —
> prana-bindu, разбирается отдельной сессией.