#!/usr/bin/env bash
# @name wm-guard
# @purpose Pre-commit guard: блокирует «чужие» файлы в staged и ошибки tsc в изменённых TS-файлах
# @input argv: --no-tsc (пропустить проверку типов)
# @output stdout: результат проверок
# @args {"type":"object","properties":{"no_tsc":{"type":"boolean"}}}
# @result {"type":"object","properties":{"ok":{"type":"boolean"}}}
# @exit 0 — можно коммитить
# @exit 1 — есть блокирующая проблема
# @tool false
# @example bash scripts/bash/wm-guard.sh
# @example bash scripts/bash/wm-guard.sh --no-tsc

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

NO_TSC=0
for a in "$@"; do [[ "$a" == "--no-tsc" ]] && NO_TSC=1; done

FAIL=0
FOREIGN_RE='scripts/manifest\.json|scripts/test-intervals-abort\.mjs|intervalsIcuProvider\.ts'
STAGED="$(git diff --cached --name-only || true)"

if echo "$STAGED" | grep -qE "$FOREIGN_RE"; then
  echo "✗ В staged «чужие» файлы:"
  echo "$STAGED" | grep -E "$FOREIGN_RE" | sed 's/^/    /'
  echo "  Убери их: git restore --staged <file>"
  FAIL=1
fi

if [[ $NO_TSC -eq 0 ]] && echo "$STAGED" | grep -qE '\.(ts|tsx)$'; then
  echo "→ tsc-changed…"
  if ! node scripts/mjs/tsc-changed.mjs; then
    echo "✗ Есть ошибки TypeScript в изменённых файлах"
    FAIL=1
  fi
else
  echo "→ tsc пропущен (нет TS в staged или --no-tsc)"
fi

[[ $FAIL -eq 0 ]] && echo "✓ guard пройден"
exit $FAIL
