#!/bin/bash
# @name sync-submodule
# @purpose Bump submodule wetothemoon-electron в родительский репозиторий + push
# @input (нет аргументов)
# @output stdout: сообщение об успехе
# @exit 0 — успех
# @exit 1 — ошибка (нет git remote / submodule dirty)
# @tool false
# @example bash scripts/bash/sync-submodule.sh
set -e
cd "$(dirname "$0")/../.."
git push origin main
cd ..
git add wetothemoon-electron
git commit -m "chore: bump submodule to $(cd wetothemoon-electron && git rev-parse --short HEAD)"
git push origin main
echo "✅ submodule + parent pushed"