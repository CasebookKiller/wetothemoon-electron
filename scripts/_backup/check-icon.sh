#!/bin/bash

echo "=========================================="
echo "  ДИАГНОСТИКА ИКОНКИ YANDEX (GW)          "
echo "=========================================="
echo ""

DESKTOP_FILE="$HOME/.local/share/applications/gatewayyandex.desktop"
ICON_NAME="gateway-icon"
ICON_PNG="$HOME/.local/share/icons/hicolor/256x256/apps/${ICON_NAME}.png"
ICON_SVG="$HOME/.local/share/icons/hicolor/scalable/apps/${ICON_NAME}.svg"

echo "1. Проверка .desktop файла:"
if [ -f "$DESKTOP_FILE" ]; then
    echo "✅ Файл существует: $DESKTOP_FILE"
    echo "   --- Содержимое ---"
    cat "$DESKTOP_FILE"
    echo "   ------------------"
    
    # Проверка StartupWMClass
    WM_CLASS=$(grep "^StartupWMClass=" "$DESKTOP_FILE" | cut -d'=' -f2)
    if [ "$WM_CLASS" == "GatewayYandex" ]; then
        echo "✅ StartupWMClass совпадает с xprop (GatewayYandex)"
    else
        echo "❌ ОШИБКА: StartupWMClass='$WM_CLASS' (должно быть 'GatewayYandex')"
    fi
    
    # Проверка Icon
    ICON_VAL=$(grep "^Icon=" "$DESKTOP_FILE" | cut -d'=' -f2)
    echo "ℹ️  Значение Icon в файле: '$ICON_VAL'"
else
    echo "❌ ОШИБКА: Файл $DESKTOP_FILE НЕ НАЙДЕН!"
fi
echo ""

echo "2. Проверка файлов иконок:"
if [ -f "$ICON_PNG" ]; then
    echo "✅ PNG найден: $ICON_PNG"
    ls -la "$ICON_PNG"
else
    echo "⚠️  PNG НЕ найден по пути: $ICON_PNG"
fi

if [ -f "$ICON_SVG" ]; then
    echo "✅ SVG найден: $ICON_SVG"
    ls -la "$ICON_SVG"
else
    echo "⚠️  SVG НЕ найден по пути: $ICON_SVG"
fi
echo ""

echo "3. Проверка валидности .desktop файла:"
if command -v desktop-file-validate &> /dev/null; then
    desktop-file-validate "$DESKTOP_FILE" || echo "❌ Найдены ошибки в .desktop файле (см. выше)"
else
    echo "ℹ️  Утилита desktop-file-validate не установлена (sudo apt install desktop-file-utils)"
fi
echo ""

echo "4. Проверка кэша иконок и приложений:"
if command -v update-desktop-database &> /dev/null; then
    echo "ℹ️  Запуск update-desktop-database..."
    update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1
    echo "✅ Кэш приложений обновлен."
else
    echo "⚠️  Утилита update-desktop-database не установлена."
fi

if command -v gtk-update-icon-cache &> /dev/null; then
    echo "ℹ️  Запуск gtk-update-icon-cache..."
    gtk-update-icon-cache "$HOME/.local/share/icons/hicolor/" -f >/dev/null 2>&1
    echo "✅ Кэш иконок обновлен."
else
    echo "⚠️  Утилита gtk-update-icon-cache не установлена."
fi
echo ""

echo "5. Проверка активных процессов Yandex:"
if lsof -ti :9222 > /dev/null; then
    echo "ℹ️  Yandex (GW) запущен."
    echo "   Проверка WM_CLASS через xprop для этого окна:"
    echo "   (Выполни вручную: xprop WM_CLASS, кликни по окну)"
else
    echo "ℹ️  Yandex (GW) сейчас НЕ запущен (порт 9222 свободен)."
fi
echo ""

echo "6. Тип графической сессии:"
echo "   XDG_SESSION_TYPE = $XDG_SESSION_TYPE"
echo "   WAYLAND_DISPLAY  = $WAYLAND_DISPLAY"
echo "   DISPLAY          = $DISPLAY"
echo "=========================================="