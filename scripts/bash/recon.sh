#!/usr/bin/env bash
# @name recon
# @purpose Снимок проекта GATEWAY для новой сессии: meta(git/toolchain), tree, manifests, inventory, symbols, recent, db-schema, entrypoints, key-sources, summary
# @input argv[1]: output_dir (по умолчанию: recon-out)
# @output <output_dir>/{00..07}-*.txt + key-sources/ + summary.txt
# @args { "type": "object", "properties": { "output_dir": { "type": "string", "default": "recon-out" } } }
# @result null
# @exit 0 — успех
# @exit 1 — ошибка (set -euo pipefail)
# @tool false
# @example bash scripts/bash/recon.sh recon-out
# recon.sh — разведка проекта GATEWAY для продолжения разработки в новом чате
# Usage: ./recon.sh [output_dir]
set -euo pipefail

OUT="${1:-recon-out}"
mkdir -p "$OUT"

# ---------- 0. Утилиты ----------
have() { command -v "$1" >/dev/null 2>&1; }
GREP() {
  if have rg; then rg "$@"; else grep -rn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build --exclude-dir=out --exclude-dir=release --exclude-dir=coverage "$@"; fi
}
TREE() {
  if have tree; then tree -a -I 'node_modules|.git|dist|build|out|release|coverage|.cache|.next|*.map' "$@";
  else find . -type d \( -name node_modules -o -name .git -o -name dist -o -name build -o -name out -o -name release -o -name coverage -o -name .cache \) -prune -o -print | sort; fi
}

echo "==> recon: writing to $OUT"
echo "==> cwd: $(pwd)"
echo "==> date: $(date -Iseconds)"

# ---------- 1. Мета ----------
{
  echo "# META"
  echo "cwd: $(pwd)"
  echo "date: $(date -Iseconds)"
  echo "user: $(whoami)@$(hostname)"
  echo "uname: $(uname -a)"
  echo
  echo "## Git"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 && {
    echo "branch: $(git rev-parse --abbrev-ref HEAD)"
    echo "last_commit: $(git log -1 --format='%h %ad %s' --date=iso 2>/dev/null || true)"
    echo
    echo "### status"
    git status --porcelain=v1
    echo
    echo "### recent commits (30)"
    git log --oneline -30 --decorate
    echo
    echo "### branches"
    git branch -a
  } || echo "no git repo"
  echo
  echo "## Toolchain"
  for t in node npm pnpm yarn bun tsc; do
    printf "%-6s " "$t"; "$t" --version 2>/dev/null | head -1 || echo "—"
  done
} > "$OUT/00-meta.txt"

# ---------- 2. Дерево ----------
TREE -L 4 > "$OUT/01-tree.txt" 2>/dev/null || true

# ---------- 3. Манифесты ----------
{
  for f in package.json pnpm-lock.yaml package-lock.json yarn.lock tsconfig.json tsconfig.*.json \
           vite.config.* electron-builder.* electron.vite.config.* playwright.config.* \
           .env.example .env.sample README.md CHANGELOG.md; do
    [ -f "$f" ] && { echo; echo "===== $f ====="; head -c 20000 "$f"; echo; }
  done
} > "$OUT/02-manifests.txt"

# ---------- 4. Инвентарь исходников ----------
echo "==> inventory"
{
  find . -type f \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \
       -o -name '*.json' -o -name '*.md' -o -name '*.sh' -o -name '*.sql' \) \
    -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' \
    -not -path '*/build/*' -not -path '*/out/*' -not -path '*/release/*' \
    -not -path '*/coverage/*' -not -name '*.map' -not -name '*lock*' \
    | sort \
    | while read -r f; do printf "%6d  %s\n" "$(wc -l < "$f" 2>/dev/null || echo 0)" "$f"; done
} > "$OUT/03-inventory.txt"

# ---------- 5. Индекс символов по roadmap ----------
echo "==> symbol index"
: > "$OUT/04-symbols.txt"
SYMBOLS=(
  # core services
  "sendMessage" "sendMessageWithFiles" "waitForAssistantResponse"
  "connectToYandex" "isYandexCdpAlive" "launchYandexWithCdp" "connectOverCDP"
  "snapshotHistory" "parseIndexedDbSnapshot" "markdownToHtml"
  "switchBranch" "getConversationMessages" "scrollHistory"
  "cleanupGhosts" "cleanupOrphans" "handleEditMessage"
  "dumpCurrentPage"
  # IPC / events
  "assistant:content-update" "reasoning:update" "message:error"
  "history:progress" "history:complete"
  "conversation:active-changed" "captcha:appeared"
  # rendering
  "GatewayMessageAssistant" "TopControlPanel" "GatewayIcons"
  "markdownRenderer" "chipFullHTML" "chipHTML"
  # DB
  "file_blobs" "message_files" "pending_edits" "messages_fts" "pw_key" "message_hash"
  # input area recon (5.5.1)
  "setInputFiles" "textareaReactHandlers" "onPaste" "bf38813a" "ec4f5d61" "_020ab5b"
  "f02f0e25" "M5.5498 9.75V5"
  # files
  "storageState" "deepseek_storage.json" "deepseek_cookies.json"
  "yandex-cdp-profile" "9222"
)
for sym in "${SYMBOLS[@]}"; do
  echo "### $sym" >> "$OUT/04-symbols.txt"
  GREP -n --no-heading -F "$sym" . \
    --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' \
    --glob '!build/**' --glob '!out/**' --glob '!release/**' \
    --glob '!coverage/**' --glob '!*.map' --glob '!*lock*' \
    >> "$OUT/04-symbols.txt" 2>/dev/null || true
  echo >> "$OUT/04-symbols.txt"
done

# ---------- 6. Недавно изменённые файлы ----------
{
  echo "# Recently modified (top 40 by mtime)"
  find . -type f \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.sql' -o -name '*.md' \) \
    -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' \
    -not -path '*/build/*' -not -path '*/out/*' -not -path '*/release/*' \
    -not -path '*/coverage/*' \
    -printf '%TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null \
    | sort -r | head -40
} > "$OUT/05-recent.txt"

# ---------- 7. DB schema / migrations ----------
echo "==> db schema"
{
  GREP -n --no-heading -E "CREATE TABLE|CREATE INDEX|CREATE TRIGGER|ALTER TABLE|INSERT INTO (file_blobs|message_files|pending_edits)" . \
    --glob '!node_modules/**' --glob '!*.map' 2>/dev/null | head -500 || true
} > "$OUT/06-db.txt"

# ---------- 8. Скрипты и entrypoints ----------
echo "==> entrypoints"
{
  echo "# scripts/ dir"
  [ -d scripts ] && ls -la scripts/ || true
  echo
  echo "# bin/shebang files"
  GREP -l -E '^#!' . --glob '!node_modules/**' 2>/dev/null || true
  echo
  echo "# package.json scripts"
  if have node; then node -e 'try{const p=require("./package.json");console.log(JSON.stringify(p.scripts||{},null,2))}catch(e){}' 2>/dev/null || true; fi
} > "$OUT/07-entrypoints.txt"

# ---------- 9. Ключевые исходники целиком (небольшие) ----------
# Копируем файлы, упомянутые в roadmap, если найдены и < 40KB
echo "==> copying key sources"
KEYGLOBS=(
  "**/deepseekService.ts"
  "**/markdownRenderer.ts"
  "**/GatewayCacheService*.ts"
  "**/GatewayMessageAssistant*.tsx"
  "**/GatewayIcons*.tsx"
  "**/TopControlPanel*.tsx"
  "**/recon-input-area.mjs"
  "**/gateway*.ts" "**/Gateway*.ts"
)
mkdir -p "$OUT/key-sources"
for g in "${KEYGLOBS[@]}"; do
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    sz=$(wc -c < "$f" 2>/dev/null || echo 0)
    if [ "$sz" -lt 40960 ]; then
      dest="$OUT/key-sources/${f#./}"
      mkdir -p "$(dirname "$dest")"
      cp "$f" "$dest" 2>/dev/null || true
    else
      echo "SKIP (>40KB): $f ($sz bytes)" >> "$OUT/key-sources/_skipped.txt"
    fi
  done < <(eval "ls -1 $g 2>/dev/null || true")
done

# ---------- 10. Сводка для чата ----------
{
  echo "# GATEWAY recon summary"
  echo
  echo "## Meta"
  cat "$OUT/00-meta.txt"
  echo
  echo "## Inventory (первые 120 строк по размеру)"
  awk '{n=$1; $1=""; print}' "$OUT/03-inventory.txt" | sort -k2 -rn | head -120
  echo
  echo "## Recent"
  cat "$OUT/05-recent.txt"
  echo
  echo "## Symbol hits — сводка (только факт найдено/нет)"
  awk '/^### /{sym=$0; next} /^$/{if(sym){print sym " — " (hits>0?"OK ("hits")":"NOT FOUND"); sym=""; hits=0}; next} {hits++}' "$OUT/04-symbols.txt"
  echo
  echo "## package.json scripts"
  cat "$OUT/07-entrypoints.txt" | tail -40
  echo
  echo "## Что отправить в чат"
  echo "- Содержимое этого файла (summary.txt)"
  echo "- При необходимости: $OUT/01-tree.txt, $OUT/04-symbols.txt"
  echo "- Архив: tar czf recon-out.tgz $OUT"
} > "$OUT/summary.txt"

echo "==> done."
echo "==> файлы: $OUT/"
ls -la "$OUT"
echo
echo "==> ОТПРАВЬ В ЧАТ: $OUT/summary.txt"
echo "==> плюс, если попрошу: $OUT/01-tree.txt и $OUT/04-symbols.txt"