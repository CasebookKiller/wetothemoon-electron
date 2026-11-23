#!/usr/bin/env bash
# @name recon-symbols
# @purpose Портативный поиск списка символов по проекту (rg или grep, без битых флагов)
# @input argv[1]: output_file (по умолчанию: recon-out/04-symbols.txt)
# @output указанный файл с результатами по списку SYMBOLS
# @args { "type": "object", "properties": { "output_file": { "type": "string", "default": "recon-out/04-symbols.txt" } } }
# @result null
# @exit 0 — успех (даже при 0 hits)
# @exit 1 — ошибка записи
# @tool false
# @example bash scripts/bash/recon-symbols.sh recon-out/04-symbols.txt
set -uo pipefail
OUT="${1:-recon-out/04-symbols.txt}"
mkdir -p "$(dirname "$OUT")"
: > "$OUT"

HAS_RG=0
command -v rg >/dev/null 2>&1 && HAS_RG=1

search() {
  local sym="$1"
  if [ "$HAS_RG" -eq 1 ]; then
    rg -n -F --no-heading "$sym" . \
      -g '!node_modules' -g '!.git' -g '!dist' -g '!build' \
      -g '!out' -g '!release' -g '!coverage' -g '!*.map' -g '!*lock*' \
      2>/dev/null || true
  else
    grep -rn -F --binary-files=text "$sym" . \
      --exclude-dir=node_modules --exclude-dir=.git \
      --exclude-dir=dist --exclude-dir=build \
      --exclude-dir=out --exclude-dir=release \
      --exclude-dir=coverage \
      --exclude='*.map' --exclude='*lock*' \
      2>/dev/null || true
  fi
}

SYMBOLS=(
  sendMessage sendMessageWithFiles waitForAssistantResponse waitForChips
  connectToYandex isYandexCdpAlive launchYandexWithCdp connectOverCDP
  snapshotHistory parseIndexedDbSnapshot markdownToHtml
  switchBranch getConversationMessages scrollHistory
  cleanupGhosts cleanupOrphans handleEditMessage dumpCurrentPage
  "assistant:content-update" "reasoning:update" "message:error"
  "history:progress" "history:complete" "conversation:active-changed" "captcha:appeared"
  "assistant:file" "file:attached" "attach:progress"
  GatewayMessageAssistant TopControlPanel GatewayIcons markdownRenderer
  chipFullHTML chipHTML chipSelector
  file_blobs message_files pending_edits messages_fts pw_key message_hash
  setInputFiles textareaReactHandlers onPaste
  bf38813a ec4f5d61 _020ab5b f02f0e25 "M5.5498 9.75V5"
  storageState deepseek_storage.json deepseek_cookies.json yandex-cdp-profile "9222"
  GatewayFilePickerModal GatewaySourcesPanel tokenEstimator ResourceService
  "migrations/v6" "migrations/v7"
)

for sym in "${SYMBOLS[@]}"; do
  hits=$(search "$sym")
  echo "### $sym" >> "$OUT"
  if [ -z "$hits" ]; then
    echo "  NOT FOUND" >> "$OUT"
  else
    n=$(printf "%s\n" "$hits" | wc -l)
    printf "%s\n" "$hits" | head -30 >> "$OUT"
    [ "$n" -gt 30 ] && echo "  ... ($n hits total, показаны 30)" >> "$OUT"
  fi
  echo >> "$OUT"
done

echo "OK: $OUT ($HAS_RG rg/grep)"