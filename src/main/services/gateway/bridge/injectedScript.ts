// src/main/services/gateway/bridge/injectedScript.ts
//
// Код, который выполняется ВНУТРИ страницы Playwright.
// Ключевая оптимизация: НЕ подписываемся на #root. Подписываемся
// на конкретные контейнеры (sidebar, virtual-list-visible-items).
// Убрали characterData где можно — чтобы не ловить каждую букву.

export const INJECTED_SCRIPT = `
(() => {
  try {   // ← обёртка для диагностики
  // Cleanup предыдущей версии, если была
  if (window.__gatewayBridgeCleanup) {
    try { window.__gatewayBridgeCleanup(); } catch (_) {}
  }

  window.__scriptVersion = 'v7-rate-limit';
  console.log('[injected] script v7-rate-limit starting');

  if (window.__gatewayBridgeReady) {
    console.log('[injected] already running, skip');
    return;
  }
  window.__gatewayBridgeReady = true;

  // ---- Отслеживание observers для cleanup ----
  const observers = [];

  const send = (type, payload) => {
    try {
      if (typeof window.__gatewayBridge === 'function') {
        window.__gatewayBridge(type, payload);
      }
    } catch (_) {}
  };

  // ---- Throttle с trailing (гарантированно отправляет последнее значение) ----
  const throttleTrailing = (fn, delay) => {
    let last = 0;
    let timer = null;
    let pendingArgs = null;
    return (...args) => {
      const now = Date.now();
      const remaining = delay - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        pendingArgs = null;
        last = now;
        fn(...args);
      } else {
        pendingArgs = args;
        if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            if (pendingArgs) {
              const a = pendingArgs;
              pendingArgs = null;
              last = Date.now();
              fn(...a);
            }
          }, remaining);
        }
      }
    };
  };

  // ---- 1. Сеть: online / offline ----
  window.addEventListener('online', () => send('network:online', {}));
  window.addEventListener('offline', () => send('network:offline', {}));

  // ---- 2. Patch fetch ----
  try {
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      try {
        const resp = await origFetch.apply(this, args);
        if (!resp.ok) {
          let body = '';
          try {
            const clone = resp.clone();
            body = await clone.text();
            if (body.length > 4000) body = body.slice(0, 4000);
          } catch (_) {}
          send('fetch:error', { url, status: resp.status, statusText: resp.statusText, body });
        }
        return resp;
      } catch (err) {
        send('fetch:error', { url, status: 0, message: String((err && err.message) || err) });
        throw err;
      }
    };
  } catch (_) {}

  // ---- 3. Хелпер: подписка с автопереподпиской при смене элемента ----
  const observeContainer = (getContainer, config, callback) => {
    let currentEl = null;
    let obs = null;

    const attach = () => {
      const el = getContainer();
      if (el && el !== currentEl) {
        if (obs) obs.disconnect();
        obs = new MutationObserver(callback);
        obs.observe(el, config);
        currentEl = el;
        observers.push(obs);
      }
    };

    attach();

    // Периодически проверяем, не пересоздали ли контейнер
    const interval = setInterval(attach, 2000);
    observers.push({ disconnect: () => clearInterval(interval) });

    return () => {
      if (obs) obs.disconnect();
      clearInterval(interval);
    };
  };

  // ---- 4. Наблюдение за reasoning ----
  const reasoningThrottled = throttleTrailing((text) => {
    send('reasoning:update', { text });
  }, 200);

  const reasoningCallback = (mutations) => {
    const el = document.querySelector('div.ds-think-content');
    if (el) reasoningThrottled(el.textContent || '');
  };

  // Подписываемся на body — но это НЕ #root, и только на конкретный
  // путь через фильтр. Реально ловим только reasoning-мутации.
  // Используем подписку на .ds-virtual-list-items (контейнер сообщений).
  observeContainer(
    () => document.querySelector('div.ds-virtual-list-items'),
    { childList: true, subtree: true, characterData: true },
    reasoningCallback
  );

  // ---- 5. Наблюдение за стримом ответа ----
  let lastStreamingEl = null;
  let lastStreamingHtml = '';
  // 5.6: время последнего стрим-события — poller history:changed
  // не должен триггериться, пока идёт активный стрим.
  let lastStreamingEventTs = 0;

  const contentThrottled = throttleTrailing((html) => {
    lastStreamingEventTs = Date.now();
    send('assistant:content-update', { html });
  }, 150);

    const streamCallback = () => {
    const mains = document.querySelectorAll(
      'div.ds-markdown.ds-assistant-message-main-content'
    );
    if (!mains.length) return;
    const last = mains[mains.length - 1];
    if (!last) return;
    if (last !== lastStreamingEl) {
      lastStreamingEl = last;
      lastStreamingHtml = '';
    }
    let html = last.innerHTML;
    if (html) {
      html = html.replace(/>\\s+</g, '><');
    }
    if (html && html !== lastStreamingHtml) {
      lastStreamingHtml = html;
      contentThrottled(html);
    }
  };

  observeContainer(
    () => document.querySelector('div.ds-virtual-list-visible-items'),
    { childList: true, subtree: true, characterData: true },
    streamCallback
  );

  // ---- 6. Количество сообщений ----
  let lastMsgCount = 0;
  const msgThrottled = throttleTrailing(() => {
    const current = document.querySelectorAll(
      'div.ds-markdown.ds-assistant-message-main-content'
    ).length;
    if (current !== lastMsgCount && lastMsgCount !== 0) {
      send('message:count-changed', { current, prev: lastMsgCount });
    }
    lastMsgCount = current;
  }, 300);

  observeContainer(
    () => document.querySelector('div.ds-virtual-list-visible-items'),
    { childList: true, subtree: false },
    msgThrottled
  );

  // ---- 7. Сайдбар ----
  let lastConvCount = 0;
  const convThrottled = throttleTrailing(() => {
    const current = document.querySelectorAll('a._546d736').length;
    if (current !== lastConvCount && lastConvCount !== 0) {
      send('conversation:list-changed', { current, prev: lastConvCount });
    }
    lastConvCount = current;
  }, 500);

  observeContainer(
    () => document.querySelector('div._3586175'),
    { childList: true, subtree: true },
    convThrottled
  );

  // ---- 7b. Ошибки сети / "Check network and retry" ----
  // Признак: div.ds-button--warning внутри div.ds-message
  // (семантический класс PrimeReact, не хэшированный)
  let lastErrorCount = document.querySelectorAll('div.ds-message .ds-button--warning').length;

  const errorThrottled = throttleTrailing(() => {
    const btns = document.querySelectorAll('div.ds-message .ds-button--warning');
    const current = btns.length;
    if (current > lastErrorCount) {
      const lastBtn = btns[btns.length - 1];
      const item = lastBtn && lastBtn.closest('[data-virtual-list-item-key]');
      const errContainer = item && item.querySelector('._11d6b3a');
      const textSpan = errContainer && errContainer.querySelector('._1ce76f5');
      const text = (textSpan && textSpan.textContent && textSpan.textContent.trim())
        || (errContainer && errContainer.textContent && errContainer.textContent.trim().slice(0, 200))
        || 'Unknown network error';
      console.warn('[injected] message:error →', text);
      send('message:error', { text, count: current });
    }
    lastErrorCount = current;
  }, 400);

  observeContainer(
    () => document.querySelector('div.ds-virtual-list-visible-items'),
    { childList: true, subtree: true },
    errorThrottled
  );

  // ---- 7c. Poller: изменение содержимого без изменения count (5.6) ----
  //
  // Ловит regenerate / edit / branch-switch в PW: количество сообщений
  // не меняется, но контент последних видимых элементов другой.
  //
  // Логика:
  //   1. Берём последние N=2 видимых [data-virtual-list-item-key]
  //   2. Считаем fingerprint (textContent-hash, не innerHTML — стабильнее)
  //   3. Не триггерим, если:
  //      a) идёт наш собственный scroll (__gatewayIsScrolling)
  //      b) идёт активный стрим ассистента (<1.5с с последнего content-update)
  //      c) count изменился (это message:count-changed territory — сброс baseline)
  //      d) fingerprint совпадает с baseline
  //   4. Иначе — ждём 1 тик стабильности (pendingTicks), чтобы не ловить
  //      промежуточные состояния анимаций, и триггерим.
  const djb2 = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  };

  const computeVisibleFingerprint = () => {
    const container = document.querySelector(
      'div.ds-virtual-list.ds-virtual-list--printable'
    );
    if (!container) return '';
    const items = container.querySelectorAll(
      'div[data-virtual-list-item-key]'
    );
    const N = 2;
    const start = Math.max(0, items.length - N);
    const parts = [];
    for (let i = start; i < items.length; i++) {
      const el = items[i];
      const key = el.getAttribute('data-virtual-list-item-key') || '';
      const text = el.textContent || '';
      parts.push(key + ':' + text.length + ':' + djb2(text));
    }
    return parts.join('|');
  };

  let lastHistoryFingerprint = '';
  let lastHistoryCount = 0;
  let pendingHistoryFingerprint = '';
  let pendingHistoryTicks = 0;
  const HISTORY_POLL_MS = 1000;
  const HISTORY_STREAM_GRACE_MS = 1500;
  const HISTORY_STABLE_TICKS = 1;

  const historyPoller = setInterval(() => {
    // a) Наш собственный scroll
    if (window.__gatewayIsScrolling) return;

    // b) Активный стрим
    if (Date.now() - lastStreamingEventTs < HISTORY_STREAM_GRACE_MS) {
      // baseline подсветим «как есть», чтобы после стрима не было ложного триггера
      const container0 = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      );
      if (container0) {
        lastHistoryCount = container0.querySelectorAll(
          'div[data-virtual-list-item-key]'
        ).length;
        lastHistoryFingerprint = computeVisibleFingerprint();
      }
      pendingHistoryFingerprint = '';
      pendingHistoryTicks = 0;
      return;
    }

    const container = document.querySelector(
      'div.ds-virtual-list.ds-virtual-list--printable'
    );
    if (!container) return;

    const items = container.querySelectorAll(
      'div[data-virtual-list-item-key]'
    );
    const currentCount = items.length;
    if (currentCount < 2) {
      // Слишком мало сообщений — это не наш сценарий
      lastHistoryCount = currentCount;
      lastHistoryFingerprint = computeVisibleFingerprint();
      return;
    }

    // c) Count изменился — это работа message:count-changed,
    //    не триггерим history:changed, только сбрасываем baseline.
    if (currentCount !== lastHistoryCount) {
      lastHistoryCount = currentCount;
      lastHistoryFingerprint = computeVisibleFingerprint();
      pendingHistoryFingerprint = '';
      pendingHistoryTicks = 0;
      return;
    }

    const fp = computeVisibleFingerprint();

    // первый запуск — просто запоминаем baseline
    if (!lastHistoryFingerprint) {
      lastHistoryFingerprint = fp;
      return;
    }

    // d) без изменений
    if (fp === lastHistoryFingerprint) {
      pendingHistoryFingerprint = '';
      pendingHistoryTicks = 0;
      return;
    }

    // fingerprint изменился — набираем стабильность
    if (fp !== pendingHistoryFingerprint) {
      pendingHistoryFingerprint = fp;
      pendingHistoryTicks = 1;
    } else {
      pendingHistoryTicks++;
    }

    if (pendingHistoryTicks >= HISTORY_STABLE_TICKS) {
      const prev = lastHistoryFingerprint;
      lastHistoryFingerprint = fp;
      pendingHistoryFingerprint = '';
      pendingHistoryTicks = 0;
      console.log('[injected] history:changed fired');
      send('history:changed', { fingerprint: fp, prevFingerprint: prev });
    }
  }, HISTORY_POLL_MS);

  // регистрируем в cleanup-массиве
  observers.push({ disconnect: () => clearInterval(historyPoller) });

  // ---- 7d. Детекция rate-limit и бана ----
  // Срабатывает на [role="dialog"] .ds-modal-content--dialog (модалка)
  // или .ds-banner--info (баннер над инпутом). Шлёт profile:rate-limited /
  // profile:banned в main. Дедуп по сигнатуре текста — чтобы не спамить.
  // НЕ переключается само: решение принимает main-сторона (RATE_LIMIT →
  // failover; ACCOUNT_BANNED → стоп и алерт, чтобы не связывать по device_id).
  // ВАЖНО: внутри template literal бэкслеши удваиваются (\\d, \\s, \\.),
  // иначе JS съедает их и regex ищет буквы d/s/literal-dot.
  const RATE_RE = /Лимит будет (?:восстановлен|сброшен):?\\s*(\\d{2})\\.(\\d{2})\\.(\\d{4})[, ]+(?:в\\s+)?(\\d{2}):(\\d{2})/i;
  const BAN_MARKS  = ['заблокирован', 'banned', 'account_banned', '11140'];
  const RATE_MARKS = ['сервер занят', 'лимит использования', 'лимит будет восстановлен', 'quota exceeded', 'rate limit'];
  let lastLimitSig = '';

  const parseUntil = (t) => {
    const m = t.match(RATE_RE);
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  const classifyLimit = (t) => {
    const low = t.toLowerCase();
    if (BAN_MARKS.some((x) => low.includes(x))) return 'ACCOUNT_BANNED';
    if (RATE_MARKS.some((x) => low.includes(x))) return 'RATE_LIMIT';
    return null;
  };

  const checkLimit = () => {
    const els = [
      document.querySelector('[role="dialog"] .ds-modal-content--dialog'),
      document.querySelector('.ds-banner--info'),
    ].filter(Boolean);
    for (const el of els) {
      const text = (el.textContent || '').trim().slice(0, 500);
      const kind = classifyLimit(text);
      if (!kind) continue;
      const untilMs = parseUntil(text);
      const sig = kind + '|' + (untilMs || 0) + '|' + text.slice(0, 100);
      if (sig === lastLimitSig) continue;
      lastLimitSig = sig;
      console.warn('[injected] ' + kind + ':', text);
      send('profile:' + (kind === 'ACCOUNT_BANNED' ? 'banned' : 'rate-limited'), {
        kind, untilMs, rawText: text,
      });
      return;
    }
  };

  // document.documentElement существует уже на document-start,
  // document.body — ещё нет (addInitScript инжектит раньше). subtree:true
  // покрывает всё внутри body.
  // document существует всегда (раньше documentElement и body).
  // subtree:true покрывает всё дерево. observe(document, …) легален.
  const limitObserver = new MutationObserver(throttleTrailing(checkLimit, 500));
  limitObserver.observe(document, { childList: true, subtree: true, characterData: true });
  observers.push(limitObserver);
  checkLimit(); // первичная проверка — если уже открыт на баннере

  // ---- 8. Cleanup API ----
  window.__gatewayBridgeCleanup = () => {
    for (const o of observers) {
      try { o.disconnect(); } catch (_) {}
    }
    observers.length = 0;
    window.__gatewayBridgeReady = false;
    window.__scriptVersion = 'cleaned';
    console.log('[injected] cleanup done');
  };

  console.log('[injected] script v7-rate-limit fully loaded');
  } catch (err) {   // ← диагностика: сюда попадают любые падения IIFE
    console.error('[injected] CRASH:', err && err.stack || String(err));
  }
})();
`;