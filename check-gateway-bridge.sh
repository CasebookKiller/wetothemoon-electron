#!/usr/bin/env bash
# check-gateway-bridge.sh
# Проверка исходников и сборки для стриминга Gateway

set -u
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "============================================================"
echo "  Проверка bridge / стриминга"
echo "============================================================"
echo

# --- 1. Исходник injectedScript.ts чист от TS-типов ---
echo "[1] src/main/services/gateway/bridge/injectedScript.ts"
TS_COUNT=$(grep -c "HTMLElement\|as HTMLElement" src/main/services/gateway/bridge/injectedScript.ts 2>/dev/null || echo 0)
if [ "$TS_COUNT" -eq 0 ]; then
  pass "TS-типы (HTMLElement) отсутствуют"
else
  fail "Найдено $TS_COUNT строк с 'HTMLElement' — старый TS-синтаксис в JS-строке!"
  grep -n "HTMLElement" src/main/services/gateway/bridge/injectedScript.ts
fi

# --- 2. Маркер версии в исходнике ---
echo
echo "[2] Маркер версии в injectedScript.ts"
if grep -q "v4-streamObs" src/main/services/gateway/bridge/injectedScript.ts; then
  pass "v4-streamObs присутствует"
else
  fail "v4-streamObs маркер не найден (правка про version marker не применена)"
fi

# --- 3. streamObs присутствует ---
echo
echo "[3] streamObs присутствует в исходнике"
if grep -q "streamObs" src/main/services/gateway/bridge/injectedScript.ts; then
  pass "streamObs найден"
else
  fail "streamObs НЕ найден — блок 3.1-b не вставлен!"
fi

# --- 4. Собранный main.js содержит новую версию ---
echo
echo "[4] Собранный dist/main/main.js"
if [ ! -f dist/main/main.js ]; then
  fail "dist/main/main.js не найден — запустите сборку"
else
  ACOUNT=$(grep -c "assistant:content-update" dist/main/main.js 2>/dev/null || echo 0)
  V4COUNT=$(grep -c "v4-streamObs" dist/main/main.js 2>/dev/null || echo 0)
  if [ "$ACOUNT" -gt 0 ]; then
    pass "assistant:content-update в собранном файле ($ACOUNT вхождений)"
  else
    fail "assistant:content-update НЕ в собранном файле — старый билд!"
  fi
  if [ "$V4COUNT" -gt 0 ]; then
    pass "v4-streamObs в собранном файле ($V4COUNT вхождений)"
  else
    fail "v4-streamObs НЕ в собранном файле — старый билд, пересоберите!"
  fi
fi

# --- 5. Сравнение таймстампов ---
echo
echo "[5] Таймстампы (кто новее)"
if [ -f dist/main/main.js ]; then
  SRC_TS=$(stat -c '%Y' src/main/services/gateway/bridge/injectedScript.ts 2>/dev/null || echo 0)
  DIST_JS=$(stat -c '%Y' dist/main/main.js 2>/dev/null || echo 0)
  if [ "$DIST_JS" -ge "$SRC_TS" ]; then
    pass "dist новее исходника — сборка актуальна"
  else
    fail "Исходник новее сборки! Пересоберите (npm start)"
    echo "  src:  $(date -d @$SRC_TS 2>/dev/null || echo $SRC_TS)"
    echo "  dist: $(date -d @$DIST_JS 2>/dev/null || echo $DIST_JS)"
  fi
fi

# --- 6. exposeFunction содержит лог ---
echo
echo "[6] exposeFunction с console.log"
if grep -q "bridge-node" src/main/services/gateway/deepseekService.ts; then
  pass "console.log('[bridge-node]', ...) присутствует"
else
  warn "console.log('[bridge-node]', ...) НЕ найден — терминал не будет показывать события"
fi

# --- 7. gatewayHandlers с логом ---
echo
echo "[7] gatewayHandlers с console.log"
if grep -q "bridge-handler" src/main/ipcHandlers/gatewayHandlers.ts; then
  pass "console.log('[bridge-handler]', ...) присутствует"
else
  warn "console.log('[bridge-handler]', ...) НЕ найден — добавьте для диагностики"
fi

# --- 8. getGatewayWindow используется ---
echo
echo "[8] getGatewayWindow в gatewayHandlers"
if grep -q "getGatewayWindow" src/main/ipcHandlers/gatewayHandlers.ts; then
  pass "getGatewayWindow импортирован и используется"
else
  fail "gatewayHandlers не использует getGatewayWindow"
fi

# --- 9. React-обработчик assistant:content-update ---
echo
echo "[9] React handleSend и обработчик"
if grep -q "assistant:content-update" src/pages/GatewayPage/GatewayPage.tsx; then
  pass "assistant:content-update обрабатывается в GatewayPage"
else
  fail "assistant:content-update НЕ обрабатывается в GatewayPage!"
fi
if grep -q "sendingRef.current) return" src/pages/GatewayPage/GatewayPage.tsx; then
  warn "Найден 'if (!sendingRef.current) return' — может блокировать первые события"
else
  pass "Нет раннего return по sendingRef"
fi

# --- 10. GatewayLiveAssistant используется ---
echo
echo "[10] GatewayLiveAssistant"
if [ -f src/components/GATEWAY/GatewayLiveAssistant/GatewayLiveAssistant.tsx ]; then
  pass "Компонент GatewayLiveAssistant.tsx существует"
else
  fail "Компонент GatewayLiveAssistant.tsx отсутствует!"
fi
if grep -q "GatewayLiveAssistant" src/pages/GatewayPage/GatewayPage.tsx; then
  pass "GatewayLiveAssistant импортирован и рендерится"
else
  fail "GatewayLiveAssistant НЕ рендерится в GatewayPage!"
fi

echo
echo "============================================================"
echo "  Готово. Если всё ✓ — переходим к JS-проверке в браузере."
echo "============================================================"