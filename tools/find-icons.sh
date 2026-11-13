#!/usr/bin/env bash
# tools/find-icons.sh
# Поиск всех мест в проекте, где используются иконки/эмодзи,
# кандидаты на замену <AppIcon />.
#
#   ./tools/find-icons.sh            # весь src/
#   ./tools/find-icons.sh src/...    # конкретная папка
#
set -euo pipefail

ROOT="${1:-src}"
EXCLUDE_DIRS=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.git)
EXCLUDE_FILES=(--exclude='*.test.tsx' --exclude='*.spec.tsx' --exclude='AppIcon.tsx' --exclude='AppIcon.css')

hr() { printf '\n\033[1;36m═══ %s ═══\033[0m\n' "$1"; }
g()  { grep -rn --color=always "${EXCLUDE_DIRS[@]}" "${EXCLUDE_FILES[@]}" "$@"; }

hr "1. Прямые <i className=\"pi pi-…\"> (замена на set=\"prime\")"
g --include='*.tsx' --include='*.jsx' \
  -E '<i[^>]*className=["{][^>]*\bpi pi-' "$ROOT" \
  | grep -v -E '^\s*//|^\s*\{\s*/\*' || true

hr "2. Динамические pi-классы (замена вручную, шаблонные строки)"
g --include='*.tsx' --include='*.jsx' \
  -E 'className=\{`[^`]*pi pi-|className=\{[^}]*\?[^}]*'"'"'pi pi-' "$ROOT" \
  | grep -v '`pi \$' || true

hr "3. Эмодзи и unicode-символы в JSX/TS (кандидаты на material)"
g --include='*.tsx' --include='*.jsx' --include='*.ts' \
  -P '[\x{2190}-\x{21FF}\x{2300}-\x{23FF}\x{25A0}-\x{25FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{2B00}-\x{2BFF}\x{1F300}-\x{1F5FF}\x{1F600}-\x{1F64F}\x{1F680}-\x{1F6FF}\x{1F900}-\x{1F9FF}]' "$ROOT" \
  | grep -v -E '^\s*//|^\s*\*|^\s*/\*' || true

hr "4. HTML-entities (✓ ✗ ★ etc.)"
g --include='*.tsx' --include='*.jsx' \
  -E '&(times|check|checkmark|star|hearts?|bull|deg|plusmn|#10003|#10007|#9733|#9734|#10004|#10008);' "$ROOT" || true

hr "5. Inline SVG с viewBox 0 0 16 16 / 0 0 24 24 (кандидаты на custom/material)"
g --include='*.tsx' --include='*.jsx' \
  -E '<svg[^>]*viewBox=["'"'"']0 0 (16 16|24 24)["'"'"']' "$ROOT" || true

hr "6. Использование <AppIcon> (для контроля прогресса)"
g --include='*.tsx' --include='*.jsx' '<AppIcon' "$ROOT" || true

hr "7. PrimeReact-пропы icon=\"pi pi-…\" (НЕ заменять — это API PrimeReact)"
g --include='*.tsx' --include='*.jsx' \
  -E '\bicon=["{][^>]*pi pi-' "$ROOT" || true

echo
echo "Готово."