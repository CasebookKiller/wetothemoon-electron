#!/usr/bin/env bash
# @name wm-watch
# @purpose Живой фильтр лога приложения: только WARN/ERROR и ключевые модули, с записью в .cache/app.log
# @input argv[1]: путь к логу (default: самый свежий в ~/.config/wetothemoon-electron/logs/*.log); argv[2]: regex (опционально)
# @output stdout: отфильтрованные строки; файл .cache/app.log
# @args {"type":"object","properties":{"log":{"type":"string"},"pattern":{"type":"string"}}}
# @result null
# @exit 0 — остановлено пользователем
# @exit 1 — лог не найден
# @tool false
# @example bash scripts/bash/wm-watch.sh
# @example bash scripts/bash/wm-watch.sh ~/.config/wetothemoon-electron/logs/main.log

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
mkdir -p .cache

LOG="${1:-}"
PATTERN="${2:-ERROR|WARN|error|warn|navigator|gigachat|deepseek|gateway|Exception}"

if [[ -z "$LOG" ]]; then
  LOG_DIR="$HOME/.config/wetothemoon-electron/logs"
  if [[ -d "$LOG_DIR" ]]; then
    LOG="$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1 || true)"
  fi
fi

if [[ -z "$LOG" || ! -f "$LOG" ]]; then
  echo "✗ лог не найден. Передай путь: bash scripts/bash/wm-watch.sh <logfile>" >&2
  exit 1
fi

echo "→ $LOG  (фильтр: $PATTERN)  →  .cache/app.log"
tail -n +1 -f "$LOG" | grep --line-buffered -E "$PATTERN" | tee -a .cache/app.log
