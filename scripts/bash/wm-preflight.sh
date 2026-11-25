#!/usr/bin/env bash
# @name wm-preflight
# @purpose Быстрый префлайт проекта: компактный снимок + проверка «чужих» staged-файлов; пишет .cache/ctx.md
# @input argv: --tsc (добавить tsc-changed, медленно)
# @output stdout: снимок состояния; файл .cache/ctx.md
# @args {"type":"object","properties":{"tsc":{"type":"boolean"}}}
# @result {"type":"object","properties":{"ok":{"type":"boolean"},"snapshot":{"type":"string"}}}
# @exit 0 — успех
# @exit 1 — в staged есть «чужие» файлы
# @tool false
# @example bash scripts/bash/wm-preflight.sh
# @example bash scripts/bash/wm-preflight.sh --tsc

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
mkdir -p .cache

WITH_TSC=0
for a in "$@"; do [[ "$a" == "--tsc" ]] && WITH_TSC=1; done

node scripts/mjs/ctx-snapshot.mjs | tee .cache/ctx.md

if [[ $WITH_TSC -eq 1 ]]; then
  echo
  node scripts/mjs/tsc-changed.mjs || true
fi

FOREIGN_RE='scripts/manifest\.json|scripts/test-intervals-abort\.mjs|intervalsIcuProvider\.ts'
STAGED="$(git diff --cached --name-only || true)"
if echo "$STAGED" | grep -qE "$FOREIGN_RE"; then
  echo
  echo "⚠ В staged есть «чужие» файлы (обычно не коммитим):"
  echo "$STAGED" | grep -E "$FOREIGN_RE" | sed 's/^/    /'
  exit 1
fi

echo
echo "✓ staged чист по «чужим» файлам"
