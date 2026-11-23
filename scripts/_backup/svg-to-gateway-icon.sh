#!/bin/bash
# scripts/svg-to-gateway-icon.sh
# Usage: ./scripts/svg-to-gateway-icon.sh <путь-к-svg>
# Конвертирует SVG в PNG 256x256 с прозрачностью, копирует в hicolor,
# обновляет кэши. Скрипт сам выбирает рабочий конвертер.
#
## Из любой папки, с любым SVG:
#./scripts/svg-to-gateway-icon.sh assets/hacker-icon.svg
#
## Или абсолютным путём:
#./scripts/svg-to-gateway-icon.sh ~/hacker-icon.svg

set -e

if [ -z "$1" ]; then
  echo "Использование: $0 <путь-к-svg>"
  echo "Пример:        $0 assets/hacker-icon.svg"
  exit 1
fi

SVG_PATH="$(realpath "$1" 2>/dev/null || echo "$1")"

if [ ! -f "$SVG_PATH" ]; then
  echo "❌ Файл не найден: $SVG_PATH"
  exit 1
fi

DEST_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
DEST_PNG="$DEST_DIR/gateway-icon.png"
TMP_PNG="$(mktemp --suffix=.png)"
trap 'rm -f "$TMP_PNG"' EXIT

mkdir -p "$DEST_DIR"

echo "→ Исходник: $SVG_PATH"
echo "→ Цель:    $DEST_PNG"
echo ""

CONVERTED=0

# 1. rsvg-convert — лучший вариант: прозрачность по умолчанию, без sandbox
if [ "$CONVERTED" -eq 0 ] && command -v rsvg-convert &>/dev/null; then
  echo "→ Конвертер: rsvg-convert"
  if rsvg-convert -w 256 -h 256 -o "$TMP_PNG" "$SVG_PATH"; then
    CONVERTED=1
  fi
fi

# 2. python3-cairosvg — тоже даёт прозрачность из коробки
if [ "$CONVERTED" -eq 0 ] && python3 -c "import cairosvg" 2>/dev/null; then
  echo "→ Конвертер: python3-cairosvg"
  if python3 -c "
import cairosvg
cairosvg.svg2png(url='$SVG_PATH', write_to='$TMP_PNG',
                 output_width=256, output_height=256)
"; then
    CONVERTED=1
  fi
fi

# 3. inkscape — копируем в home (snap/flatpak sandbox не видит другие каталоги)
if [ "$CONVERTED" -eq 0 ] && command -v inkscape &>/dev/null; then
  echo "→ Конвертер: inkscape"
  TMP_SVG="$HOME/.gw-icon-tmp.svg"
  cp "$SVG_PATH" "$TMP_SVG"
  if inkscape "$TMP_SVG" \
       --export-type=png \
       --export-filename="$TMP_PNG" \
       --export-background-opacity=0 \
       -w 256 -h 256 2>/dev/null; then
    CONVERTED=1
  fi
  rm -f "$TMP_SVG"
fi

# 4. ImageMagick convert — ключевые флаги: -background none -alpha on
if [ "$CONVERTED" -eq 0 ] && command -v convert &>/dev/null; then
  echo "→ Конвертер: ImageMagick convert"
  TMP_SVG="$HOME/.gw-icon-tmp.svg"
  cp "$SVG_PATH" "$TMP_SVG"
  if convert -background none -alpha on \
       "$TMP_SVG" -resize 256x256 "$TMP_PNG" 2>/dev/null; then
    CONVERTED=1
  fi
  rm -f "$TMP_SVG"
fi

if [ "$CONVERTED" -eq 0 ]; then
  echo "❌ Не найден рабочий конвертер. Установи один из:"
  echo "   sudo apt install librsvg2-bin       # rsvg-convert (рекомендую)"
  echo "   sudo apt install python3-cairosvg   # python3-cairosvg"
  echo "   sudo apt install imagemagick        # convert"
  exit 1
fi

# Проверка результата
if ! file "$TMP_PNG" | grep -q "PNG image data"; then
  echo "❌ Конвертация не дала PNG. Результат:"
  file "$TMP_PNG" 2>&1
  exit 1
fi

# Копируем в целевое место
cp "$TMP_PNG" "$DEST_PNG"

echo ""
echo "✅ Готово:"
file "$DEST_PNG"
ls -la "$DEST_PNG"

# Обновляем кэши
echo ""
echo "→ Обновляю кэши..."
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor/" -f 2>/dev/null || true

echo ""
echo "✨ Иконка обновлена."
echo ""
echo "⚠️  На Wayland нужен logout/login, чтобы GNOME подхватил кэш:"
echo "   после logout/login:"
echo "     kill \$(lsof -ti :9222) 2>/dev/null"
echo "     npm run start"