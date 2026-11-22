// src/pages/GatewayPage/GatewayPage.tsx

import React, { useState, useEffect } from 'react';

import { TopControlPanel } from '@/components/GATEWAY/TopControlPanel/TopControlPanel';
import { GatewaySidebar } from '@/components/GATEWAY/GatewaySidebar/GatewaySidebar';
import { GatewayChatHeader } from '@/components/GATEWAY/GatewayChatHeader/GatewayChatHeader';
import { GatewayMessageUser } from '@/components/GATEWAY/GatewayMessageUser/GatewayMessageUser';
import { GatewayMessageAssistant } from '@/components/GATEWAY/GatewayMessageAssistant/GatewayMessageAssistant';
import { GatewayInputArea } from '@/components/GATEWAY/GatewayInputArea/GatewayInputArea';
import { GatewayWelcome } from '@/components/GATEWAY/GatewayWelcome/GatewayWelcome';
import GatewayShareModal from '@/components/GATEWAY/GatewayShareModal/GatewayShareModal';
import { GatewaySelectionPreview } from '@/components/GATEWAY/GatewaySelectionPreview/GatewaySelectionPreview';
import GatewayDeepseekShadowRoot from '@/components/GATEWAY/GatewayDeepseekShadowRoot/GatewayDeepseekShadowRoot';
import { GatewayConfirmModal } from '@/components/GATEWAY/GatewayConfirmModal/GatewayConfirmModal';
import { GatewayMessageNavigation } from '@/components/GATEWAY/GatewayMessageNavigation/GatewayMessageNavigation';
import { GatewayCacheManager } from '@/components/GATEWAY/GatewayCacheManager/GatewayCacheManager';
import { GatewaySearchModal } from '@/components/GATEWAY/GatewaySearchModal/GatewaySearchModal';
import { CheckIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import { GatewayLiveReasoning } from '@/components/GATEWAY/GatewayLiveReasoning/GatewayLiveReasoning';
import { GatewayLiveAssistant } from '@/components/GATEWAY/GatewayLiveAssistant/GatewayLiveAssistant';

import { parseMessageHtml, ChatMessage } from '@/components/GATEWAY/utils/parseMessageHtml';
import { GatewayInputModal } from '@/components/GATEWAY/GatewayInputModal/GatewayInputModal';
import { GatewayFilePanel, FilePanelState, getStoredPanelWidth } from '@/components/GATEWAY/GatewayFilePanel/GatewayFilePanel';
import { GatewayProgressToast, BatchUIState } from '@/components/GATEWAY/GatewayProgressToast/GatewayProgressToast';
import { GatewayDialogLoadToast, DialogLoadInfo } from '@/components/GATEWAY/GatewayDialogLoadToast/GatewayDialogLoadToast';
import { estimateConversationTokens, CONTEXT_WINDOW_TOKENS } from '@/components/GATEWAY/utils/tokenEstimator';
import { GatewayAttachedFile } from '@/components/GATEWAY/GatewayFilePickerModal/GatewayFilePickerModal';
import { GatewaySourcesPanel } from '@/components/GATEWAY/GatewaySourcesPanel/GatewaySourcesPanel';
import type { WebSource } from '@/components/GATEWAY/GatewaySourcesPanel/GatewaySourcesPanel';


export const GatewayPage: React.FC = () => {
  const [status, setStatus] = useState('stopped');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<{ id: string; title: string; group?: string }[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [deepThinking, setDeepThinking] = useState(true);
  const [search, setSearch] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Режим выбора диалогов (чатов) в сайдбаре
  const [isChatSelectMode, setIsChatSelectMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [topPanelOpen, setTopPanelOpen] = useState(false);
  const [panelHovered, setPanelHovered] = useState(false);
  const [liveReasoning, setLiveReasoning] = useState<string>('');
  const [liveAssistantHtml, setLiveAssistantHtml] = useState<string>('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Удаление диалога
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentTitle: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Управление кэшем
  const [cacheManagerOpen, setCacheManagerOpen] = useState(false);

  // Поиск по чатам
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Файлы: статусы загрузки (key = `${messageHash}:${chipIndex}`)
  const [fileStatuses, setFileStatuses] = useState<Map<string, 'ok' | 'failed'>>(
    new Map()
  );
  const [filePanel, setFilePanel] = useState<FilePanelState | null>(null);
  const [filePanelWidth, setFilePanelWidth] = useState<number>(() => getStoredPanelWidth());

  // Прогресс batch-загрузки файлов
  const [batchToast, setBatchToast] = useState<BatchUIState | null>(null);

  const [sourcesPanel, setSourcesPanel] = useState<{ isOpen: boolean, sources: WebSource[] }>({ isOpen: false, sources: [] });

  // API — объявлено до useEffect'ов, которые его используют
  const api = (window as any).electronAPI;

    // Универсальный маппер сообщений из БД (чтобы никогда не терять поля)
  const mapCachedMessage = React.useCallback((m: any, convId: string) => {
    const originalKey = m.id.startsWith(convId + '_')
      ? m.id.slice(convId.length + 1)
      : m.id;

    // 5.7.9-fallback: если в БД branch_total=1, но в contentHtml есть
    // switcher — парсим оттуда (для legacy записей).
    let branchTotal = m.branchTotal;
    let branchIndex = m.branchIndex;
    if (!branchTotal || branchTotal <= 1) {
      const html = m.contentHtml || '';
      const match = html.match(/dd7e4fda[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*</);
      if (match) {
        branchIndex = parseInt(match[1], 10);
        branchTotal = parseInt(match[2], 10);
      }
    }

    return {
      id: originalKey,
      role: m.role,
      thinking: m.thinking,
      sources: m.sources,
      blocks: m.blocks,
      fullHtml: m.contentHtml,
      messageHash: m.messageHash,
      pwKey: m.pwKey ?? null,
      branchTotal,
      branchIndex,
    };
  }, []);

  // Какие диалоги уже показывали toast «Диалог загружен»
  const toastShownForConvRef = React.useRef<Set<string>>(new Set());

  // Для каких диалогов уже запускали авто-batch (защита от повторного
  // запуска в рамках одной сессии открытия)
  const autoFetchStartedForConvRef = React.useRef<Set<string>>(new Set());

  // Toast «Диалог загружен» (висит до крестика)
  const [dialogLoadToast, setDialogLoadToast] = useState<DialogLoadInfo | null>(null);
  const dialogLoadToastRef = React.useRef<DialogLoadInfo | null>(null);
  React.useEffect(() => {
    dialogLoadToastRef.current = dialogLoadToast;
  }, [dialogLoadToast]);

  // Показываем toast «Диалог загружен» когда isHistoryLoading становится false
  // (после history:complete или timeout 90с). Это надёжнее, чем вызов из
  // bridge-обработчика (там stale closure на selectedConversation).
  React.useEffect(() => {
    if (isHistoryLoading) return;
    if (!selectedConversation) return;
    if (messages.length === 0) return;
    if (toastShownForConvRef.current.has(selectedConversation)) return;

    console.log(
      '[dialog-load-toast] триггер для',
      selectedConversation,
      'messages:', messages.length
    );
    toastShownForConvRef.current.add(selectedConversation);

    void (async () => {
      try {
        const statsBulk = await api.gatewayFileStatsBulk();
        console.log('[dialog-load-toast] statsBulk:', statsBulk);
        if (statsBulk.success && statsBulk.data) {
          const s = statsBulk.data[selectedConversation];
          setDialogLoadToast({
            convId: selectedConversation,
            messagesTotal: messages.length,
            filesTotal: s?.total || 0,
            filesLoaded: s?.loaded || 0,
            filesFailed: s?.failed || 0,
          });
          console.log('[dialog-load-toast] setDialogLoadToast:', {
            convId: selectedConversation,
            messages: messages.length,
            files: s?.total,
            loaded: s?.loaded,
          });
        } else {
          console.warn('[dialog-load-toast] statsBulk no data');
        }
      } catch (e) {
        console.warn(
          '[dialog-load-toast] error:',
          (e as Error).message
        );
      }
    })();
  }, [isHistoryLoading, selectedConversation, messages.length]);

  // Автозапуск batch при открытии диалога (если настройка > 0).
  // Ждёт 1.5с после окончания истории — чтобы PW-скролл и sync завершились.
  // Пропускает, если pending = 0 (нечего грузить) или batch уже идёт.
  React.useEffect(() => {
    if (isHistoryLoading) return;
    if (!selectedConversation) return;
    if (messages.length === 0) return;
    if (autoFetchStartedForConvRef.current.has(selectedConversation)) return;

    let count = 0;
    try {
      const raw = localStorage.getItem('gateway.autoFetchFileCount');
      if (raw !== null) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0) count = n;
      }
    } catch {
      /* ignore */
    }
    if (count <= 0) return;

    // Помечаем как «запущено» сразу, чтобы повторный setMessages не дублировал
    autoFetchStartedForConvRef.current.add(selectedConversation);

    const convId = selectedConversation;
    const timer = setTimeout(async () => {
      try {
        // 5.6: не запускаем batch, если PW упал/закрыт
        const statusRes = await api.gatewayGetStatus();
        if (!statusRes || statusRes.status !== 'running') {
          console.log('[auto-fetch] PW not running, skip batch');
          return;
        }

        const statsRes = await api.gatewayFileStatsBulk();
        if (!statsRes.success || !statsRes.data) return;
        const s = statsRes.data[convId];
        if (!s || s.pending === 0) {
          console.log(
            '[auto-fetch] нет pending для',
            convId,
            '(total:', s?.total ?? 0,
            'loaded:', s?.loaded ?? 0,
            ')'
          );
          return;
        }
        console.log(
          `[auto-fetch] запуск ${Math.min(count, s.pending)} из ${s.pending} (запрошено ${count})`
        );
        const r = await api.gatewayFileFetchBatch(
          convId,
          Math.min(count, s.pending)
        );
        if (r?.success && r.data?.started) {
          console.log(`[auto-fetch] batch запущен (${r.data.total})`);
        } else {
          console.log('[auto-fetch] batch не запустился:', r?.data);
        }
      } catch (e) {
        console.warn('[auto-fetch] error:', (e as Error).message);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isHistoryLoading, selectedConversation, messages.length]);

  const selectedConversationRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // 5.6.1: title lookup inside bridge-handlers (stale-free)
  const conversationsRef = React.useRef<{ id: string; title: string; group?: string }[]>([]);
  React.useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const sendingRef = React.useRef(sending);
  React.useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  // 5.6: batch сейчас идёт → игнорим message:count-changed
  // (PoW batch кликает чипы в PW, могут приходить ложные count-события)
  const batchRunningRef = React.useRef(false);

  // 5.7.44: пока идёт switchBranch — игнорируем message:count-changed / history:changed
  const branchSwitchingRef = React.useRef(false);

  // 5.6: history:changed — debounce
  const historyChangedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // После handleSend игнорируем bridge-события 3с: фоновые snapshot'ы
  // и visible-sync возвращают устаревшую БД и перезаписывают optimistic-result.
  const postSendIgnoreUntilRef = React.useRef<number>(0);

  // ============================================================
  // Автоскролл вниз во время стрима.
  // ============================================================

  // Ref на скролл-контейнер (вешается на .ds-virtual-list ниже в JSX)
  const isLoadingHistoryRef = React.useRef(false);
  React.useEffect(() => {
    isLoadingHistoryRef.current = isHistoryLoading;
  }, [isHistoryLoading]);
  const pendingScrollAdjustRef = React.useRef<{ isAtBottom: boolean; prevHeight: number; prevTop: number } | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = React.useRef(false);
  const latestHistoryRef = React.useRef<ChatMessage[]>([]);
  const historyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = React.useRef<ChatMessage[]>([]);

  React.useEffect(() => {
    messagesRef.current = messages;
    // ── TEMP DIAG: отслеживаем каждое изменение messages ──
    const snap = messages.slice(-4).map((m, idx) => ({
      i: messages.length - 4 + idx,
      key: String(m.id ?? m.messageHash ?? 'n/a'),
      role: m.role,
      text: (m.blocks?.[0]?.content || '').slice(0, 25),
      hash: m.messageHash ?? null,
      pwKey: m.pwKey ?? null,
    }));
    console.log(
      `[MSG-CHANGE] len=${messages.length}`,
      snap
    );
  }, [messages]);

  // Cleanup при размонтировании
  React.useEffect(() => {
    return () => {
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      if (historyChangedTimerRef.current) clearTimeout(historyChangedTimerRef.current);
    };
  }, []);

  // Умный скролл: если пользователь внизу — держим внизу, если наверху — сохраняем позицию
  const setMessagesWithPreserveScroll = React.useCallback((newMessages: ChatMessage[]) => {
    const el = scrollContainerRef.current;
    if (!el) {
      setMessages(newMessages);
      return;
    }
    
    const isAtBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 150;
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;

    setMessages(newMessages);

    requestAnimationFrame(() => {
      if (isAtBottom) {
        el.scrollTop = el.scrollHeight;
      } else {
        const diff = el.scrollHeight - prevHeight;
        if (diff > 0) {
          el.scrollTop = prevTop + diff;
        }
      }
    });
  }, []);

  // (удалено — используем latestHistoryRef + setMessagesWithPreserveScroll)

  // Скролл вниз. force=true — всегда (для userMsg).
  // force=false — только если пользователь не ушёл выше 500px (для live-стрима).
  const scrollToBottom = React.useCallback((force = false) => {
    const el = scrollContainerRef.current;
    if (!el) {
      console.log('[autoscroll] no ref');
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    console.log('[autoscroll]', {
      force,
      distanceFromBottom,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
      willScroll: force || distanceFromBottom < 500,
    });
    if (force || distanceFromBottom < 500) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // 1. Автоскролл при обновлении live-контента (reasoning или стрим)
  React.useEffect(() => {
    if (!liveAssistantHtml && !liveReasoning) return;
    // Двойной rAF: гарантирует пересчёт layout перед установкой scrollTop
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    });
    return () => cancelAnimationFrame(r1);
  }, [liveAssistantHtml, liveReasoning, scrollToBottom]);

  // 2. Умный скролл при обновлении истории
  React.useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || messages.length === 0) return;

    // Первое открытие диалога или отправка сообщения — скроллим вниз
    if (!initialScrollDoneRef.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDoneRef.current = true;
    } else if (sendingRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // 2b. Подгружаем историю, когда пользователь докручивает до самого верха
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      // Если пользователь на самом верху, и в фоне загружено больше, чем сейчас показано
      if (el.scrollTop < 10 && latestHistoryRef.current.length > messages.length) {
        setMessagesWithPreserveScroll(latestHistoryRef.current);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [messages.length, setMessagesWithPreserveScroll]);

  // 2c. Удерживаем скролл внизу, пока идет загрузка истории (чтобы не было прыжков)
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isHistoryLoading) return;

    const ro = new ResizeObserver(() => {
      const distanceToBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      // Если мы находимся в нижней части экрана, принудительно прижимаем к низу
      if (distanceToBottom < 300) {
        el.scrollTop = el.scrollHeight;
      }
    });
    const inner = el.querySelector('.ds-virtual-list-visible-items') || el;
    ro.observe(inner);
    return () => ro.disconnect();
  }, [isHistoryLoading]);

  // (удалено)

  // 3. ResizeObserver — ловит рост контента от любых причин
  // (включая рост live-блока, подгрузку и т.п.)
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;

    let lastHeight = el.scrollHeight;
    const ro = new ResizeObserver(() => {
      const nowHeight = el.scrollHeight;
      if (nowHeight > lastHeight) {
        lastHeight = nowHeight;
        if (liveAssistantHtml || liveReasoning) {
          scrollToBottom(false);
        }
      }
    });
    // Наблюдаем за внутренним контейнером, где растёт контент
    const inner = el.querySelector('.ds-virtual-list-visible-items') || el;
    ro.observe(inner);
    return () => ro.disconnect();
  }, [liveAssistantHtml, liveReasoning, scrollToBottom]);

  const updateStatus = async () => {
    try {
      const s = await api.gatewayGetStatus();
      setStatus(s.status);
      setIsLoggedIn(s.isLoggedIn);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    document.body.setAttribute('data-module', 'gateway');
    return () => document.body.removeAttribute('data-module');
  }, []);

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.add('dark');
    document.body.setAttribute('data-ds-dark-theme', 'dark');
    return () => {
      document.body.classList.remove('dark');
      document.body.removeAttribute('data-ds-dark-theme');
    };
  }, []);

  // PW-парсер не отдаёт messageHash (у него нет доступа к БД) — теряется
  // при history:progress/complete. Восстанавливаем по fingerprint контента
  // (role + все текстовые/файловые блоки), т.к. id у non-numeric сообщений
  // всегда undefined.
  const messageFingerprint = React.useCallback((msg: ChatMessage): string => {
    const parts = msg.blocks
      // code включаем: regenerate может менять только код, без текста.
      // Без code fingerprint был бы одинаковым у всех code-only ответов.
      .filter(
        (b) => b.type === 'text' || b.type === 'file' || b.type === 'code'
      )
      .map((b) => `${b.type}:${b.content}`)
      .join('\u0001');
    return `${msg.role}\u0002${parts}`;
  }, []);

  // 5.7.9: Извлекаем ветки из contentHtml (фолбэк для случаев,
  // когда в БД branch_total = 1, но switcher в HTML присутствует).
  const parseBranchFromHtml = React.useCallback(
    (html: string | null | undefined): { total: number; index: number } => {
      if (!html) return { total: 1, index: 1 };
      const m = html.match(/dd7e4fda[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*</);
      if (m) return { total: parseInt(m[2], 10), index: parseInt(m[1], 10) };
      return { total: 1, index: 1 };
    },
    []
  );

  const mergeWithExisting = React.useCallback(
    (incoming: ChatMessage[]): ChatMessage[] => {
      const prev = messagesRef.current;
      const prevById = new Map<string, ChatMessage>();
      const prevByFp = new Map<string, ChatMessage>();
      for (const m of prev) {
        if (!m.messageHash) continue;
        if (m.id) prevById.set(String(m.id), m);
        prevByFp.set(messageFingerprint(m), m);
      }
      return incoming.map((msg) => {
        if (msg.messageHash) return msg;
        // 1. По id (numeric)
        let old = msg.id ? prevById.get(String(msg.id)) : undefined;
        // 2. По fingerprint (role + blocks) — для non-numeric
        if (!old) old = prevByFp.get(messageFingerprint(msg));
        if (old?.messageHash) {
          return { ...msg, messageHash: old.messageHash, pwKey: old.pwKey ?? null };
        }
        return msg;
      });
    },
    [messageFingerprint]
  );

  // ---- Bridge: события из Playwright ----
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onGatewayBridgeEvent) {
      console.warn('[bridge] onGatewayBridgeEvent не доступен');
      return;
    }

    const unsubscribe = api.onGatewayBridgeEvent(
      (event: { type: string; payload: any; ts: number }) => {
        if (event.type !== 'assistant:content-update' && event.type !== 'reasoning:update') {
          console.log('[bridge-react]', event.type);
        }

        // Reasoning в реальном времени
        if (event.type === 'reasoning:update') {
          // Принимаем, если мы шлем ИЛИ если мы просто смотрим диалог
          if (!sendingRef.current && !selectedConversation) return;
          const text = (event.payload?.text as string) || '';
          if (text) {
            setLiveReasoning(text);
          }
          return;
        }

        // Стриминг ответа ассистента — обновляем live-контент
        if (event.type === 'assistant:content-update') {
          if (!sendingRef.current && !selectedConversation) return;
          const html = (event.payload?.html as string) || '';
          console.log(
            `[bridge] assistant:content-update len=${html.length} ` +
            `sendingRef=${sendingRef.current} messagesLast=${messagesRef.current[messagesRef.current.length - 1]?.role}`
          );
          if (html) setLiveAssistantHtml(html);
          return;
        }

        // Появилось новое сообщение ассистента
        if (event.type === 'message:count-changed') {
          if (isLoadingHistoryRef.current) return;
          if (batchRunningRef.current) return;
          if (branchSwitchingRef.current) return;
          if (sendingRef.current) return;
          if (Date.now() < postSendIgnoreUntilRef.current) {
            console.log('[bridge] message:count-changed пропущен (post-send)');
            return;
          }
          if (Date.now() < postSendIgnoreUntilRef.current) {
            console.log('[bridge] message:count-changed пропущен (post-send)');
            return;
          }

          const currentConv = selectedConversationRef.current;
          if (currentConv) {
            const title =
              conversationsRef.current.find((c) => c.id === currentConv)
                ?.title || 'Диалог';

            // 5.6.3: sync visible-only + перечитать ПОЛНУЮ историю из БД.
            api
              .gatewayGetConversationMessages(currentConv, title, {
                skipBackgroundScroll: true,
              })
              .then(async (res: any) => {
                if (!res.success) return;
                const cached = await api.gatewayCacheMessages(currentConv);
                if (
                  cached.success &&
                  cached.data &&
                  cached.data.length > 0 &&
                  selectedConversationRef.current === currentConv
                ) {
                  const mapped = cached.data.map((m: any) =>
                    mapCachedMessage(m, currentConv)
                  );
                  
                  // 5.6.5: фильтр по messageHash/id (вместо текста)
                  const uniqueMapped: ChatMessage[] = [];
                  const seenKeys = new Set<string>();
                  for (const msg of mapped) {
                    const key = msg.messageHash || msg.id || `${msg.role}:${msg.blocks?.map((b: any) => b.content).join('\n\n')}`;
                    if (!seenKeys.has(key)) {
                      seenKeys.add(key);
                      uniqueMapped.push(msg);
                    }
                  }
                  
                  setMessages(uniqueMapped);
                  latestHistoryRef.current = uniqueMapped;
                }
                setLiveAssistantHtml('');
                setLiveReasoning('');
              })
              .catch((e: Error) =>
                console.warn(
                  '[message:count-changed] sync failed:',
                  e.message
                )
              );
          }
          return;
        }

        // Состояния сети
        if (event.type === 'network:offline') {
          setError('Нет подключения к интернету');
          return;
        }
        if (event.type === 'network:online') {
          setError('');
          return;
        }

        // Ошибка от DeepSeek (retry-warning появляется в чате)
        if (event.type === 'message:error') {
          const text = (event.payload?.text as string) || 'Ошибка сети';
          setError(`DeepSeek: ${text}`);
          return;
        }

        // Прогресс подгрузки истории (приходит во время скролла PW)
        if (event.type === 'history:progress' || event.type === 'history:complete') {
          if (sendingRef.current) {
            console.log(`[bridge] ${event.type} пропущен (sending=true)`);
            return;
          }
          if (Date.now() < postSendIgnoreUntilRef.current) {
            console.log(`[bridge] ${event.type} пропущен (post-send)`);
            return;
          }
          const rawParsed = (event.payload?.rawMessages || []) as ChatMessage[];
          const scrollProgress = event.payload?.scrollProgress as
            | import('@/main/services/gateway/bridge/BridgeEvents').ScrollProgressMeta
            | undefined;

          // 5.8.2: обновляем прогресс в тосте (throttle на стороне main)
          if (scrollProgress && event.type === 'history:progress') {
            setDialogLoadToast((prev) => {
              const currentConvId = selectedConversationRef.current;
              if (!currentConvId) return prev;
              if (prev && prev.convId !== currentConvId) return prev;

              const messagesNow = scrollProgress.collectedCount || 0;
              const base: DialogLoadInfo = prev ?? {
                convId: currentConvId,
                messagesTotal: messagesRef.current.length || messagesNow,
                filesTotal: 0,
                filesLoaded: 0,
                filesFailed: 0,
              };
              const updatedTotal = base.messagesTotal > 0
                ? base.messagesTotal
                : Math.max(messagesNow, messagesRef.current.length);

              return {
                ...base,
                messagesTotal: updatedTotal,
                progress: scrollProgress,
              };
            });

            // 5.8.2: watchdog — пока идёт progress, таймаут сбрасывается
            resetHistoryTimeout(180000);
          }

          const prev = latestHistoryRef.current;

          // 5.6.3: на progress — быстрая перезапись видимым окном.
          if (event.type === 'history:progress') {
            const prevAllHashed =
              prev.length > 0 && prev.every((m) => !!m.messageHash);
            if (prevAllHashed) {
              if (rawParsed.length > prev.length) {
                const merged = mergeWithExisting(rawParsed);
                latestHistoryRef.current = merged;
                setMessagesWithPreserveScroll(merged);
                console.log(
                  '[gateway] history:progress: resync',
                  { prevLen: prev.length, rawLen: rawParsed.length }
                );
              }
            } else {
              const parsed = mergeWithExisting(rawParsed);
              if (parsed.length >= prev.length) {
                latestHistoryRef.current = parsed;
                setMessagesWithPreserveScroll(parsed);
              }
            }
          }

          // 5.6.3: на complete — читаем ПОЛНУЮ историю из БД (источник правды)
          if (event.type === 'history:complete') {
            if (Date.now() < postSendIgnoreUntilRef.current) {
              console.log('[bridge] history:complete пропущен (post-send)');
              return;
            }
            // 5.8.2: сохраняем elapsed последнего progress → finalElapsedMs
            setDialogLoadToast((prev) => {
              if (!prev) return prev;
              const finalElapsed = prev.progress?.elapsedMs;
              return {
                ...prev,
                progress: undefined,
                finalElapsedMs: finalElapsed ?? prev.finalElapsedMs,
              };
            });

            setIsHistoryLoading(false);
            isLoadingHistoryRef.current = false;

            if (historyTimeoutRef.current) {
              clearTimeout(historyTimeoutRef.current);
              historyTimeoutRef.current = null;
            }

            const currentConv = selectedConversationRef.current;
            const isSending = sendingRef.current;   // фиксируем в моменте
            if (currentConv) {
              // 1. Читаем ПОЛНУЮ историю из БД
              void (async () => {
                try {
                  const cached = await api.gatewayCacheMessages(currentConv);
                  if (
                    cached.success &&
                    cached.data &&
                    cached.data.length > 0 &&
                    selectedConversationRef.current === currentConv
                  ) {
                    // ⚠️ ЗАЩИТА ОТ RACE: если идёт отправка и в БД меньше
                    // сообщений чем уже в UI (оптимистичный user + старые),
                    // НЕ перезаписываем — иначе user-message исчезнет
                    // (это и был баг «ни запроса, ни ответа»).
                    if (isSending && cached.data.length <= messagesRef.current.length) {
                      console.log(
                        '[gateway] history:complete: skip (sending, DB smaller)',
                        { dbLen: cached.data.length, uiLen: messagesRef.current.length }
                      );
                      return;
                    }

                    const mapped = cached.data.map((m: any) =>
                      mapCachedMessage(m, currentConv)
                    );

                    // 5.6.5: фильтр по messageHash/id
                    const uniqueMapped: ChatMessage[] = [];
                    const seenKeys = new Set<string>();
                    for (const msg of mapped) {
                      const key =
                        msg.messageHash ||
                        msg.id ||
                        `${msg.role}:${msg.blocks
                          ?.map((b: any) => b.content)
                          .join('\n\n')}`;
                      if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        uniqueMapped.push(msg);
                      }
                    }

                    latestHistoryRef.current = uniqueMapped;
                    console.trace('[SET-MSG] history:complete → reloaded from DB', uniqueMapped.length);
                    setMessagesWithPreserveScroll(uniqueMapped);
                    console.log(
                      '[gateway] history:complete: reloaded from DB',
                      {
                        rawCount: mapped.length,
                        uniqueCount: uniqueMapped.length,
                      }
                    );
                  }
                } catch (e) {
                  console.warn(
                    '[gateway] history:complete reload failed:',
                    (e as Error).message
                  );
                }
              })();

              // 2. Финальная сверка статусов файлов из БД
              void (async () => {
                try {
                  const items: Array<{
                    messageHash: string;
                    chipIndex: number;
                  }> = [];
                  for (const msg of messagesRef.current) {
                    if (msg.role !== 'user' || !msg.messageHash) continue;
                    const files = (msg.blocks || []).filter(
                      (b: any) => b.type === 'file'
                    );
                    files.forEach((_f: any, i: number) => {
                      items.push({
                        messageHash: msg.messageHash!,
                        chipIndex: i,
                      });
                    });
                  }
                  if (items.length > 0) {
                    const r = await api.gatewayFileStatuses(
                      currentConv,
                      items
                    );
                    if (r.success && r.data) {
                      const next = new Map<string, 'ok' | 'failed'>();
                      for (const [k, v] of Object.entries(r.data)) {
                        next.set(k, v as 'ok' | 'failed');
                      }
                      setFileStatuses(next);
                    }
                  }
                } catch (e) {
                  console.warn(
                    '[gateway] fileStatuses refresh failed:',
                    (e as Error).message
                  );
                }
              })();
            }
          }
          return;
        }

        // ───── File batch: загрузка N файлов ─────
        if (event.type === 'file:batch-started') {
          const p = event.payload as { convId: string; total: number; skipped: number };
          batchRunningRef.current = true;
          setBatchToast({
            convId: p.convId,
            total: p.total,
            processed: 0,
            ok: 0,
            failed: 0,
            status: 'running',
            cancelled: false,
          });
          return;
        }

        if (event.type === 'file:batch-progress') {
          const p = event.payload as {
            convId: string;
            current: number;
            total: number;
            ok: number;
            failed: number;
            name: string;
            status: 'ok' | 'failed';
            error?: string;
            messageHash: string;
            chipIndex: number;
          };

          // 1. Progress-toast (batch) — обновляем счётчик/имя файла
          setBatchToast((prev) => {
            if (!prev || prev.convId !== p.convId) return prev;
            return {
              ...prev,
              total: p.total,
              processed: p.current,
              ok: p.ok,
              failed: p.failed,
              currentName: p.name,
            };
          });

          // 2. Dialog-load-toast — инкрементально: +1 к loaded/failed.
          //    p.status — статус ТЕКУЩЕГО файла, поэтому инкремент корректен.
          //    При batch-complete пересчитаем из statsBulk (это устранит дрейф
          //    от параллельных ручных fetchFileContent).
          setDialogLoadToast((prev) => {
            if (!prev || prev.convId !== p.convId) return prev;
            return {
              ...prev,
              filesLoaded: prev.filesLoaded + (p.status === 'ok' ? 1 : 0),
              filesFailed: prev.filesFailed + (p.status === 'failed' ? 1 : 0),
            };
          });

          // 3. Accent border: отмечаем чип загруженным/сломанным
          if (
            selectedConversation === p.convId &&
            p.messageHash &&
            typeof p.chipIndex === 'number'
          ) {
            setFileStatuses((prev) => {
              const next = new Map(prev);
              const key = `${p.messageHash}:${p.chipIndex}`;
              if (p.status === 'ok') {
                next.set(key, 'ok');
              } else if (p.status === 'failed') {
                next.set(key, 'failed');
              }
              return next;
            });
          }
          return;
        }

        if (event.type === 'file:batch-complete') {
          const p = event.payload as {
            convId: string;
            processed: number;
            total: number;
            ok: number;
            failed: number;
            status: 'completed' | 'cancelled' | 'failed';
          };
          batchRunningRef.current = false;

          // 1. Progress-toast (batch) — авто-исчезает
          setBatchToast((prev) => {
            if (!prev || prev.convId !== p.convId) return prev;
            return {
              ...prev,
              processed: p.processed,
              total: p.total,
              ok: p.ok,
              failed: p.failed,
              status: p.status,
              currentName: undefined,
              lastError:
                p.status === 'failed'
                  ? 'PW закрыт или потеря соединения'
                  : p.status === 'cancelled'
                  ? 'Отменено пользователем'
                  : undefined,
            };
          });

          // 2. Dialog-load-toast — обновляем БЕЗУСЛОВНО (без selectedConversationRef,
          //    потому что ref может быть ещё null). Функциональный setter
          //    сам решит, обновлять или нет (по prev.convId).
          void (async () => {
            try {
              const statsBulk = await api.gatewayFileStatsBulk();
              console.log(
                '[batch-complete] statsBulk:',
                JSON.stringify(statsBulk.data?.[p.convId] || null),
                '| toast conv:',
                dialogLoadToastRef.current?.convId,
                '| event conv:',
                p.convId
              );
              if (!statsBulk.success || !statsBulk.data) return;
              const s = statsBulk.data[p.convId];
              if (!s) return;

              setDialogLoadToast((prev) => {
                if (!prev) {
                  console.log(
                    '[batch-complete] toast отсутствует — не обновляем (закрыт юзером)'
                  );
                  return prev;
                }
                if (prev.convId !== p.convId) {
                  console.log(
                    '[batch-complete] toast для другого диалога — не обновляем'
                  );
                  return prev;
                }
                console.log(
                  '[batch-complete] обновляю toast:',
                  `${s.loaded}/${s.total}`,
                  `(было ${prev.filesLoaded}/${prev.filesTotal})`,
                  'failed:',
                  Math.max(s.failed || 0, p.failed || 0)
                );
                return {
                  ...prev,
                  filesTotal: s.total,
                  filesLoaded: s.loaded,
                  filesFailed: Math.max(s.failed || 0, p.failed || 0),
                };
              });
            } catch (e) {
              console.warn(
                '[batch-complete] statsBulk error:',
                (e as Error).message
              );
            }
          })();

          return;
        }

        // ───── 5.6: history:changed — regenerate / edit / branch-switch ─────
        if (event.type === 'history:changed') {
          if (isLoadingHistoryRef.current) return;
          if (batchRunningRef.current) return;
          if (branchSwitchingRef.current) return;
          if (sendingRef.current) {
            console.log('[bridge] history:changed пропущен (sending=true)');
            return;
          }
          if (Date.now() < postSendIgnoreUntilRef.current) {
            console.log('[bridge] history:changed пропущен (post-send)');
            return;
          }

          const currentConvId = selectedConversationRef.current;
          if (!currentConvId) return;

          // Дебаунс 1.5с — коалесцируем несколько событий подряд
          if (historyChangedTimerRef.current) {
            clearTimeout(historyChangedTimerRef.current);
          }
          historyChangedTimerRef.current = setTimeout(async () => {
            historyChangedTimerRef.current = null;

            // Повторная проверка гардов — за 1.5с могли переключить диалог
            if (isLoadingHistoryRef.current) return;
            if (batchRunningRef.current) return;
            if (selectedConversationRef.current !== currentConvId) return;

            console.log('[gateway] history:changed → resync', {
              convId: currentConvId,
              fingerprint: event.payload?.fingerprint,
            });

            setIsHistoryLoading(true);
            isLoadingHistoryRef.current = true;
            if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
            historyTimeoutRef.current = setTimeout(() => {
              historyTimeoutRef.current = null;
              setIsHistoryLoading(false);
              isLoadingHistoryRef.current = false;
              console.warn(
                '[gateway] history:changed sync timeout (30s) — forcing isLoading=false'
              );
            }, 30000);  // 30с — visible-only sync укладывается за 2-3с, 30с — с запасом

            try {
              // 5.6.1: visible-only sync (без scroll). Regenerate/edit/
              // branch-switch меняют только содержимое существующих слотов,
              // pw_key сохраняется → selectByPwKey делает in-place UPDATE.
              // prune НЕ нужен — иначе потеряем сообщения вне видимого окна.
              const title =
                conversationsRef.current.find((c) => c.id === currentConvId)
                  ?.title || 'Диалог';
              await api.gatewayGetConversationMessages(currentConvId, title, {
                skipBackgroundScroll: true,
              });

              // 5.6.2: перечитываем БД и обновляем UI. Без этого
              // regenerate/edit синкались в БД, но UI показывал старый
              // контент до переоткрытия диалога.
              const reloaded = await api.gatewayCacheMessages(currentConvId);
              if (
                reloaded.success &&
                reloaded.data &&
                reloaded.data.length > 0
              ) {
                const freshMapped = reloaded.data.map((m: any) =>
                  mapCachedMessage(m, currentConvId)
                );
                
                if (selectedConversationRef.current === currentConvId) {
                  // 5.6.5: фильтр по messageHash/id (вместо текста)
                  const uniqueMapped: ChatMessage[] = [];
                  const seenKeys = new Set<string>();
                  for (const msg of freshMapped) {
                    const key = msg.messageHash || msg.id || `${msg.role}:${msg.blocks?.map((b: any) => b.content).join('\n\n')}`;
                    if (!seenKeys.has(key)) {
                      seenKeys.add(key);
                      uniqueMapped.push(msg);
                    }
                  }
                  console.trace('[SET-MSG] message:count-changed → sync', uniqueMapped.length);
                  setMessages(uniqueMapped);
                  latestHistoryRef.current = uniqueMapped;
                  // Чистим live: финальный ответ уже в messages
                  setLiveAssistantHtml('');
                  setLiveReasoning('');
                }
              }
            } catch (e) {
              console.warn(
                '[gateway] history:changed visible sync failed:',
                (e as Error).message
              );
              if (selectedConversationRef.current === currentConvId) {
                setIsHistoryLoading(false);
                isLoadingHistoryRef.current = false;
                if (historyTimeoutRef.current) {
                  clearTimeout(historyTimeoutRef.current);
                  historyTimeoutRef.current = null;
                }
              }
            }
          }, 1500);
          return;
        }

        // 5.8.2: telemetry — шум в фоне (DeepSeek сам себе шлёт
        // POST /api/v0/telemetry, а наш injectedScript его блокирует).
        // Не показываем, не логируем, не отображаем юзеру.
        if (event.type === 'fetch:error') {
          const url = (event.payload?.url as string) || '';
          if (url.includes('/telemetry')) return;
          
          // TODO(5.8.3): реальные fetch:error — показывать юзеру (не телеметрию).
          // Сейчас падают в общий лог ниже, не в UI.
        }

        // P0.5 Phase 2: rate-limit / auto-switch → DOM-события
        // (preload пробрасывает только gateway:bridge-event, остальное — renderer сам)
        if (event.type === 'profile:rate-limited') {
          window.dispatchEvent(new CustomEvent('gateway:profile-rate-limited', { detail: event.payload }));
          return;
        }
        if (event.type === 'profile:switched') {
          if (event.payload?.needLogin) {
            window.dispatchEvent(new CustomEvent('gateway:need-login', { detail: { id: event.payload?.to } }));
          }
          window.dispatchEvent(new CustomEvent('gateway:profile-switched', { detail: { id: event.payload?.to } }));
          return;
        }
        if (event.type === 'all-profiles-limited') {
          window.dispatchEvent(new CustomEvent('gateway:all-profiles-limited', { detail: event.payload }));
          return;
        }

        // Остальное — пока в лог (этапы 2–4)
        console.log('[bridge]', event.type, event.payload);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const centerLeft = window.innerWidth * 0.25;
      const centerRight = window.innerWidth * 0.75;

      if (e.clientY <= 40 && e.clientX > centerLeft && e.clientX < centerRight) {
        setTopPanelOpen(true);
      } else if (!panelHovered && (e.clientY > 100 || e.clientX <= centerLeft || e.clientX >= centerRight)) {
        setTopPanelOpen(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [panelHovered]);

  // Multi-profile: при переключении аккаунта — полный сброс + перезагрузка
  useEffect(() => {
    const onSwitch = async () => {
      try {
        console.log('[GatewayPage] profile-switched → reset + reload');
        const api2 = (window as any)?.electronAPI;

        // 1. Сбрасываем состояние чата (чужой профиль — чужие диалоги)
        setSelectedConversation(null);
        selectedConversationRef.current = null;
        setMessages([]);
        messagesRef.current = [];
        latestHistoryRef.current = [];
        initialScrollDoneRef.current = false;
        setMessage('');
        setLiveAssistantHtml('');
        setLiveReasoning('');
        setFileStatuses(new Map());
        setDialogLoadToast(null);
        setSourcesPanel({ isOpen: false, sources: [] });

        // 2. Обновляем статус (мог измениться isLoggedIn)
        if (api2?.gatewayGetStatus) {
          const s = await api2.gatewayGetStatus();
          if (s) {
            setStatus(s.status);
            setIsLoggedIn(!!s.isLoggedIn);
          }
        }

        // 3. Перезагружаем список диалогов
        if (api2?.gatewayGetConversations) {
          const r = await api2.gatewayGetConversations();
          if (r?.success && Array.isArray(r.data)) setConversations(r.data);
          else setConversations([]);
        }
      } catch (err) {
        console.warn('[GatewayPage] profile-switched failed:', err);
      }
    };
    window.addEventListener('gateway:profile-switched', onSwitch);
    return () => window.removeEventListener('gateway:profile-switched', onSwitch);
  }, []);

  // Реакция на убийство зомби: обновить статус (Yandex закрыт → stopped)
  useEffect(() => {
    const onKilled = async () => {
      console.log('[GatewayPage] zombies-killed → обновляю статус');
      try {
        const api = (window as any)?.electronAPI;
        const s = await api?.gatewayGetStatus();
        if (s) {
          setStatus(s.status || 'stopped');
          setIsLoggedIn(!!s.isLoggedIn);
        }
        // Сбрасываем чат — PW мог быть закрыт
        setSelectedConversation(null);
        selectedConversationRef.current = null;
        setMessages([]);
        messagesRef.current = [];
        latestHistoryRef.current = [];
        setLiveAssistantHtml('');
        setLiveReasoning('');
      } catch (e) {
        console.warn('[GatewayPage] zombies-killed handler:', e);
      }
    };
    window.addEventListener('gateway:zombies-killed', onKilled);
    return () => window.removeEventListener('gateway:zombies-killed', onKilled);
  }, []);

  // Переключились на профиль без сессии — обновляем статус и подсвечиваем "Войти"
  useEffect(() => {
    const onNeedLogin = () => {
      console.log('[GatewayPage] need-login → updating status');
      updateStatus(); // isLoggedIn = false → покажет TopPanel "Login required"
    };
    window.addEventListener('gateway:need-login', onNeedLogin);
    return () => window.removeEventListener('gateway:need-login', onNeedLogin);
  }, []);

  // P0.5 Phase 2: все профили в лимите — alert (DOM-событие приходит из bridge-handler выше)
  useEffect(() => {
    const onAll = (e: any) => {
      const d = e?.detail || {};
      const until = d.untilMs ? new Date(d.untilMs).toLocaleString('ru-RU') : '?';
      console.warn('[GatewayPage] all-profiles-limited', d);
      alert(`Все профили в лимите DeepSeek.\nБлижайший сброс: ${until}.\nПричина: ${d.reason || 'no-next'}`);
    };
    window.addEventListener('gateway:all-profiles-limited', onAll);
    return () => window.removeEventListener('gateway:all-profiles-limited', onAll);
  }, []);

  // Multi-profile: при выходе из аккаунта — сбрасываем UI
  useEffect(() => {
    const onLogout = () => {
      console.log('[GatewayPage] logged-out → reset UI');
      // (мягкий и полный выход обрабатываются одинаково — просто сброс)
      setSelectedConversation(null);
      selectedConversationRef.current = null;
      setMessages([]);
      messagesRef.current = [];
      latestHistoryRef.current = [];
      initialScrollDoneRef.current = false;
      setMessage('');
      setLiveAssistantHtml('');
      setLiveReasoning('');
      setFileStatuses(new Map());
      setDialogLoadToast(null);
      setConversations([]);
      setSourcesPanel({ isOpen: false, sources: [] });
      
      // Обновляем статус (PW всё ещё работает, но isLoggedIn=false)
      updateStatus();
    };
    window.addEventListener('gateway:logged-out', onLogout);
    return () => window.removeEventListener('gateway:logged-out', onLogout);
  }, []);

  const syncToggleState = async () => {
    try {
      const dt = await api.gatewayGetDeepThinking();
      if (dt.success) setDeepThinking(dt.data);
      const st = await api.gatewayGetSearch();
      if (st.success) setSearch(st.data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      syncToggleState();
      handleRefreshConversations();
    }
  }, [isLoggedIn]);


  // 5.8.2: единый хелпер — ставит/перезапускает таймаут. Вызывается
  // и при старте, и при каждом history:progress (watchdog на зависание).
  const resetHistoryTimeout = React.useCallback((ms: number = 180000) => {
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = setTimeout(() => {
      historyTimeoutRef.current = null;
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = false;
      console.warn(
        `[gateway] history:complete timeout (${Math.round(ms / 1000)}s) — forcing isLoading=false`
      );
    }, ms);
  }, []);

  // 5.8.1: Ctrl+Alt+R — force-resync текущего диалога.
  // Полезно после regenerate/edit в середине диалога (когда bridge
  // history:changed не срабатывает — fingerprint хвоста не менялся).
  // 5.8.2: вынесено из hotkey — теперь используется и в GatewayDialogLoadToast
  const handleForceResync = React.useCallback(async () => {
    const convId = selectedConversationRef.current;
    if (!convId) {
      console.warn('[force-resync] нет выбранного диалога');
      return;
    }
    if (isLoadingHistoryRef.current) {
      console.log('[force-resync] уже идёт sync — игнор');
      return;
    }

    console.log('[force-resync] запуск', convId);
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = true;
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    
    // 5.8.2: используем централизованный таймаут
    resetHistoryTimeout(180000);

    try {
      const mode = localStorage.getItem('gateway.scrollMode') || 'snapshot';
      console.log(`[force-resync] mode=${mode}`);

      if (mode === 'snapshot') {
        const r = await api.gatewaySnapshotHistory(convId);
        if (r?.success) {
          console.log(`[force-resync] snapshot OK: source=${r.data?.source}`);
        } else {
          console.warn(
            `[force-resync] snapshot failed: ${r?.error}, falling back to traverse`
          );
          // Fallback: traverse — но только если snapshot явно упал.
          // Внутри service уже есть fallback на traverse, но на всякий случай.
          const collectInactive =
            localStorage.getItem('gateway.collectAllBranches') === '1';
          await api.gatewayScrollHistory(convId, {
            prune: true,
            collectInactive,
            speed: localStorage.getItem('gateway.scrollSpeed') || 'normal',
          });
        }
      } else {
        const collectInactive = mode !== 'quick' && mode !== 'normal';
        await api.gatewayScrollHistory(convId, {
          prune: true,
          collectInactive,
          speed: localStorage.getItem('gateway.scrollSpeed') || 'normal',
        });
      }
    } catch (err) {
      console.error('[force-resync] failed:', (err as Error).message);
      if (selectedConversationRef.current === convId) {
        setIsHistoryLoading(false);
        isLoadingHistoryRef.current = false;
        if (historyTimeoutRef.current) {
          clearTimeout(historyTimeoutRef.current);
          historyTimeoutRef.current = null;
        }
      }
    }
  }, [api, resetHistoryTimeout]);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey) {
        console.log('[hotkey] Ctrl+Alt pressed, code:', e.code, 'key:', e.key);
      }

      if (!(e.ctrlKey && e.altKey && !e.shiftKey)) return;
      if (e.code !== 'KeyR') return;

      e.preventDefault();
      await handleForceResync();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleForceResync]);

  const contextUsage = React.useMemo(() => {
    const used = estimateConversationTokens(
      messages.map((m) => ({
        contentPlain: m.blocks.map((b) => b.content).join('\n\n'),
        thinking: m.thinking,
      }))
    );
    return { used, total: CONTEXT_WINDOW_TOKENS, percent: (used / CONTEXT_WINDOW_TOKENS) * 100 };
  }, [messages]);

  const handleLaunch = async () => {
    setLoading(true);
    setError('');
    setIsHistoryLoading(true);
    initialScrollDoneRef.current = false;
    latestHistoryRef.current = [];
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    // Fallback: если history:complete не придёт за 30с —
    // сбрасываем флаг, иначе UI зависнет в «загрузке» навсегда.
    resetHistoryTimeout(180000);
    try {
      const result = await api.gatewayLaunch();
      if (result.success) {
        const data = result.data;
        setStatus(data.status);
        setIsLoggedIn(!data.loginRequired);
      } else {
        setError(result.error || 'Ошибка запуска');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.gatewayClose();
      if (result.success) {
        setStatus('stopped');
        setIsLoggedIn(false);
        setMessages([]);
      } else {
        setError(result.error || 'Ошибка остановки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (files: GatewayAttachedFile[]) => {
    if (!message.trim() || sending) return;

    // Отменяем ЛЮБОЙ висящий history:changed debounce — он мог сработать
    // во время await и вернуть старые данные.
    if (historyChangedTimerRef.current) {
      clearTimeout(historyChangedTimerRef.current);
      historyChangedTimerRef.current = null;
    }

    const userText = message;
    const prevMessages = messages;
    const convIdAtStart = selectedConversationRef.current;

    // Multi-provider (2026-11-22): провайдер из localStorage (см. TopControlPanel)
    const providerId = (localStorage.getItem('gateway-provider') as string) || 'deepseek';
    if (providerId !== 'deepseek' && files.length > 0) {
      console.warn('[handleSend] Файлы поддерживаются только для DeepSeek (MVP), игнорирую');
    }

    // ⚠️ СИНХРОННО ставим флаг ДО setSending (React setState асинхронный,
    // useEffect обновит sendingRef.current только через рендер + микротаск,
    // а bridge-события успевают прийти между ними → race).
    sendingRef.current = true;
    setSending(true);
    setMessage('');

    // ── ОПТИМИСТИЧНАЯ ВСТАВКА user-message ──
    // Пока main работает (setInputFiles + upload 88KB + ожидание ответа = до 60с),
    // UI должен показывать user-сообщение + стримящийся ответ. Без этого
    // пользователь видит «голый ответ в воздухе».
    const optimisticUserMsg: ChatMessage = {
      id: `optimistic-user-${Date.now()}`,
      role: 'user',
      blocks: [
        ...files.map(f => ({
          type: 'file' as const,
          content: f.name,
          mime: f.mime,
          size: '',
        })),
        ...(userText.trim()
          ? [{ type: 'text' as const, content: userText }]
          : []),
      ],
      fullHtml: undefined,
    } as ChatMessage;

    const optimisticMessages = [...prevMessages, optimisticUserMsg];
    console.trace('[SET-MSG] handleSend → optimistic user');
    setMessages(optimisticMessages);
    latestHistoryRef.current = optimisticMessages;
    requestAnimationFrame(() => scrollToBottom(true));

    // Блокируем bridge ДО await: main эмитит history:complete ещё
    // внутри send-message-with-files (snapshot → эмит → return IPC),
    // поэтому 5с от старта = 5с покрывают всё окно ожидания + возврат.
    postSendIgnoreUntilRef.current = Date.now() + 5000;

    try {
      const result = providerId !== 'deepseek'
        ? await (api as any).gatewaySendViaProvider(providerId, userText)
        : (files.length > 0
            ? await api.gatewaySendMessageWithFiles(userText, files)
            : await api.gatewaySendMessage(userText));

      if (!result?.success) {
        throw new Error(result?.error || 'Отправка не удалась (нет details от main)');
      }

      // ═══ ГЛАВНЫЙ ФИКС: используем готовый ответ из result.data ═══
      // sendMessage/sendMessageWithFiles возвращает GatewayChatMessage
      // с полным HTML ответа. Не ждём IndexedDB (она может отставать на
      // десятки секунд) — сразу вставляем в messages с кнопками.
      if (result.data?.fullHtml) {
        const assistantMsg: ChatMessage = {
          id: result.data.id || `optimistic-assistant-${Date.now()}`,
          role: 'assistant',
          thinking: result.data.thinking,
          blocks: (result.data.blocks || []).filter(
            (b: any) => b.type !== 'file'
          ),
          fullHtml: result.data.fullHtml,
        };
        // Берём текущий стейт messages (мог обновиться от bridge-событий)
        // и удаляем наши оптимистичные дубликаты перед вставкой финальных.
        const currentMessages = messagesRef.current;
        const baseMessages = currentMessages.filter(m => {
          // Оставляем всё, кроме оптимистичных user с нашим текстом
          // и оптимистичных assistant (id начинается с optimistic-)
          if (m.id && String(m.id).startsWith('optimistic-')) return false;
          return true;
        });
        const finalMessages = [...baseMessages, optimisticUserMsg, assistantMsg];
        console.trace('[SET-MSG] handleSend → result.data');
        setMessages(finalMessages);
        latestHistoryRef.current = finalMessages;
        setLiveAssistantHtml('');
        setLiveReasoning('');
        requestAnimationFrame(() => scrollToBottom(true));
        // Блокируем bridge-события на 3с, чтобы фоновые snapshot'ы
        // не затирали только что вставленный result.data.
        postSendIgnoreUntilRef.current = Date.now() + 3000;
        console.log(
          '[handleSend] мгновенный ответ из result.data (chars=',
          result.data.fullHtml.length,
          ')'
        );
      } else {
        // Если result.data пустой (timeout в PW) — блокируем bridge,
        // чтобы не перезаписать live-стрим устаревшей БД.
        postSendIgnoreUntilRef.current = Date.now() + 3000;
      }

      // ── Фоновый polling БД (не блокирует UI) ──
      // Когда БД догонит — заменим optimistic-данные на настоящие
      // с правильными id/messageHash/pwKey.
      const isNewPairInDb = (fresh: any[]): boolean => {
        if (fresh.length < 2) return false;
        const last = fresh[fresh.length - 1];
        const penult = fresh[fresh.length - 2];
        if (last.role !== 'assistant' || penult.role !== 'user') return false;
        // Проверяем, что предпоследний user содержит наш текст.
        // Файлы проверять не нужно — они в blocks[], а текст — самое
        // надёжное, что мы контролируем.
        if (userText.trim().length === 0) {
          // Только файлы — проверяем имена
          const fileNamesInDb = (penult.blocks || [])
            .filter((b: any) => b.type === 'file')
            .map((b: any) => b.content)
            .sort()
            .join(',');
          const fileNamesExpected = files.map(f => f.name).sort().join(',');
          return fileNamesExpected.length > 0 && fileNamesInDb.includes(fileNamesExpected.slice(0, 20));
        }
        const userInDb = (penult.blocks || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => (b.content || '').trim())
          .join('\n');
        return userInDb.includes(userText.trim().slice(0, 30));
      };

      if (selectedConversationRef.current === convIdAtStart && convIdAtStart) {
        // Фоновый polling — не блокирует UI (он уже показал ответ из result.data)
        void (async () => {
          let caught = false;
          const deadline = Date.now() + 60000;   // 60с, а не 30с
          while (Date.now() < deadline) {
            try {
              const reloaded = await api.gatewayCacheMessages(convIdAtStart);
              if (
                reloaded.success &&
                Array.isArray(reloaded.data) &&
                isNewPairInDb(reloaded.data)
              ) {
                if (selectedConversationRef.current !== convIdAtStart) return;
                const freshMapped = reloaded.data.map((m: any) =>
                  mapCachedMessage(m, convIdAtStart)
                );
                console.trace('[SET-MSG] handleSend → polling reload', reloaded.data.length);
                setMessages(freshMapped);
                latestHistoryRef.current = freshMapped;
                setLiveAssistantHtml('');
                setLiveReasoning('');
                console.log(
                  '[handleSend] фоновый reload OK:',
                  reloaded.data.length,
                  'msgs'
                );
                caught = true;
                break;
              }
            } catch (e) {
              console.warn(
                '[handleSend] фоновый poll error:',
                (e as Error).message
              );
            }
            await new Promise(r => setTimeout(r, 2000));
          }
          if (!caught) {
            console.warn(
              '[handleSend] фоновый polling: DB did not catch up in 60s. ' +
              'UI остаётся на optimistic + result.data.'
            );
          }
        })();
      }
    } catch (e) {
      console.error('[handleSend]', e);
      setError((e as Error).message);
      // ROLLBACK optimistic — возвращаем UI к prevMessages + восстанавливаем текст
      setMessages(prevMessages);
      latestHistoryRef.current = prevMessages;
      setMessage(userText);
    } finally {
      // ⚠️ Синхронно снимаем флаг
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleRefreshConversations = async () => {
    try {
      const result = await api.gatewayGetConversations();
      if (result.success) {
        setConversations(result.data || []);
      } else {
        setError(result.error || 'Ошибка загрузки диалогов');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDeepThinkingChange = async (value: boolean) => {
    setDeepThinking(value);
    try {
      await api.gatewaySetDeepThinking(value);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSearchChange = async (value: boolean) => {
    setSearch(value);
    try {
      await api.gatewaySetSearch(value);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleOpenConversation = async (id: string) => {
    setSelectedConversation(id);
    const title = conversations.find(c => c.id === id)?.title || 'Диалог';
    setLoading(true);
    setError('');
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = true;
    initialScrollDoneRef.current = false;
    latestHistoryRef.current = [];
    setFileStatuses(new Map());
    setDialogLoadToast(null);
    toastShownForConvRef.current.delete(id);
    autoFetchStartedForConvRef.current.delete(id);
    // Сбрасываем «отложенный» history:changed, если был для другого диалога
    if (historyChangedTimerRef.current) {
      clearTimeout(historyChangedTimerRef.current);
      historyChangedTimerRef.current = null;
    }
    // 5.6.1: сбрасываем ЛЮБОЙ висящий 90-секундный фолбэк от предыдущего
    // open — иначе он вырубит isLoading во время текущего scroll.
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }

    let hasCachedData = false;
    let prevCache: ChatMessage[] = [];

    // ── Stage 1: БД → UI (мгновенно) ─────────────────────────
    try {
      const cached = await api.gatewayCacheMessages(id);
      if (cached.success && cached.data && cached.data.length > 0) {
        const mapped = cached.data.map((m: any) =>
          mapCachedMessage(m, id)
        );
        setMessages(mapped);
        latestHistoryRef.current = mapped;
        prevCache = mapped;
        hasCachedData = true;

        // Bulk file-statuses для accent border
        try {
          const items: Array<{ messageHash: string; chipIndex: number }> = [];
          for (const msg of mapped) {
            if (msg.role !== 'user' || !msg.messageHash) continue;
            const files = (msg.blocks || []).filter(
              (b: any) => b.type === 'file'
            );
            files.forEach((_f: any, i: number) => {
              items.push({ messageHash: msg.messageHash!, chipIndex: i });
            });
          }
          if (items.length > 0) {
            const statusRes = await api.gatewayFileStatuses(id, items);
            if (statusRes.success && statusRes.data) {
              const next = new Map<string, 'ok' | 'failed'>();
              for (const [k, v] of Object.entries(statusRes.data)) {
                next.set(k, v as 'ok' | 'failed');
              }
              setFileStatuses(next);
            }
          }
        } catch (e) {
          console.warn('[file-statuses] error:', e);
        }
      } else {
        setMessages([]);
      }
    } catch (e) {
      console.warn('Ошибка загрузки из кэша:', e);
    }

    // ── Stage 2: PW open ────────────────────────────────────
    try {
      const resultOpen = await api.gatewayOpenConversation(id);
      if (!resultOpen.success) {
        if (hasCachedData) {
          setError(
            `PW недоступен. Показана кэшированная версия. (${resultOpen.error})`
          );
        } else {
          setError(resultOpen.error || 'Ошибка открытия диалога в PW');
        }
        setIsHistoryLoading(false);
        isLoadingHistoryRef.current = false;
        setLoading(false);
        return;
      }

      // ── Stage 3: видимое окно PW + file-stats — параллельно ──
      // skipBackgroundScroll: true — возвращаемся мгновенно, без scroll.
      // Внутри IPC-хендлера syncConversation всё равно сделает upsert
      // видимых сообщений (хеши обновятся).
      const [resultMessages, statsBulk] = await Promise.all([
        api.gatewayGetConversationMessages(id, title, {
          skipBackgroundScroll: true,
        }),
        api.gatewayFileStatsBulk(),
      ]);

      const pwVisible: ChatMessage[] = resultMessages.success
        ? resultMessages.data || []
        : [];
      const fileStats =
        statsBulk.success && statsBulk.data ? statsBulk.data[id] : undefined;
      const pending = fileStats?.pending || 0;

      // ── Stage 4: fingerprint сравнение ───────────────────────
      // prevCache — то, что БЫЛО в кэше ДО этого sync (ещё не перезаписано)
      // pwVisible — что PW отдал прямо сейчас (обычно последние 5-6)
      //
      // Стратегия: сравниваем ХВОСТ из K сообщений. Для skip нужно, чтобы:
      //   - кэш содержал не меньше сообщений, чем видит PW (prevLen >= visLen)
      //   - последние K совпали по fingerprint
      // Это даёт skip для БОЛЬШИХ диалогов (кэш 100 / visible 5 → сравниваем
      // последние 5). Компромисс: regenerate в середине диалога, не
      // затронувший хвост, не будет пойман — для этого есть bridge
      // history:changed (ловит изменение видимого окна) и кнопка force
      // resync (см. §11.8, реализуем позже).
      const prevLen = prevCache.length;
      const visLen = pwVisible.length;
      const TAIL_K = 5;

      let lastMatches = false;
      let tailSize = 0;
      if (prevLen >= visLen && visLen > 0) {
        tailSize = Math.min(TAIL_K, visLen);
        const prevTail = prevCache.slice(prevLen - tailSize);
        const visTail = pwVisible.slice(visLen - tailSize);
        lastMatches = prevTail.every((m, i) => {
          const vis = visTail[i];
          if (!vis) return false;
          if (m.role !== vis.role) return false;
          return messageFingerprint(m) === messageFingerprint(vis);
        });
      }

      // sizesMatch: «кэш по размеру не меньше видимого окна».
      // Строгое равенство здесь не годится — большой диалог в БД содержит
      // всю историю, а PW рендерит только видимое окно.
      const sizesMatch = prevLen >= visLen;

      // ── Stage 5: решение ──────────────────────────────────
      // 5.8.2: pending файлов — не причина для полного sync.
      // Файлы качаются отдельно через FileBatchService. Полный sync
      // нужен только если содержимое сообщений реально разъехалось.
      // Раньше: pending > 0 → forced full scroll (975с на 97 сообщениях!).
      if (lastMatches && sizesMatch) {
        // SKIP: DB актуальна, файлы все загружены.
        // Перечитываем БД (sync мог заполнить message_hash у legacy-строк).
        try {
          const reloaded = await api.gatewayCacheMessages(id);
          if (reloaded.success && reloaded.data && reloaded.data.length > 0) {
            const freshMapped = reloaded.data.map((m: any) =>
              mapCachedMessage(m, id)
            );
            
            setMessages(freshMapped);
            latestHistoryRef.current = freshMapped;
          }
        } catch (e) {
          // ignore — UI уже с кэшем
        }

        setIsHistoryLoading(false);
        isLoadingHistoryRef.current = false;
        if (historyTimeoutRef.current) {
          clearTimeout(historyTimeoutRef.current);
          historyTimeoutRef.current = null;
        }
        console.log('[gateway] skip scroll:', {
          cachedLen: prevLen,
          visibleLen: visLen,
          tailSize,
          pending,
        });
        return;
      }

      // SCROLL: нужен полный sync
      console.log('[gateway] scroll needed:', {
        lastMatches,
        sizesMatch,
        pending,
        prevLen,
        visLen,
        tailSize,
      });

      // Fallback-таймаут: если history:complete не придёт за 90с
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = setTimeout(() => {
        historyTimeoutRef.current = null;
        setIsHistoryLoading(false);
        isLoadingHistoryRef.current = false;
        console.warn(
          '[gateway] history:complete timeout (90s) — forcing isLoading=false'
        );
      }, 180000);

      // prune: false когда содержимое совпадает, но есть pending-файлы
      // (сохраняем хеши, чтобы ключи fileStatuses не разъехались).
      // prune: true — когда содержимое разошлось (regenerate/edit/branch).
      const usePrune = !lastMatches;

      // 5.7.33: передаём флаг сбора веток и здесь.
      // Иначе первичное открытие диалога запускает sync БЕЗ traverse,
      // а Ctrl+Alt+R (нажатый позже) прицепляется к этому же скроллу
      // через backgroundScrollInFlight и traverse тоже не запускает.
            // 5.8.3-snapshot: выбор способа sync по режиму
      const mode = localStorage.getItem('gateway.scrollMode') || 'snapshot';
      console.log(`[gateway] sync mode: ${mode}`);

      try {
        if (mode === 'snapshot') {
          const r = await api.gatewaySnapshotHistory(id);
          if (r?.success) {
            console.log(
              `[gateway] snapshot OK: source=${r.data?.source}`
            );
          } else {
            console.warn(
              `[gateway] snapshot failed: ${r?.error}, falling back`
            );
            // Fallback на traverse если snapshot явно упал
            const collectInactive =
              localStorage.getItem('gateway.collectAllBranches') === '1';
            await api.gatewayScrollHistory(id, {
              prune: usePrune,
              collectInactive,
              speed: localStorage.getItem('gateway.scrollSpeed') || 'normal',
            });
          }
        } else {
          const collectInactive =
            mode === 'deep' ||
            localStorage.getItem('gateway.collectAllBranches') === '1';
          await api.gatewayScrollHistory(id, {
            prune: usePrune,
            collectInactive,
            speed: localStorage.getItem('gateway.scrollSpeed') || 'normal',
          });
        }
      } catch (e) {
        console.warn(
          '[gateway] sync failed:',
          (e as Error).message
        );
        if (selectedConversationRef.current === id) {
          setIsHistoryLoading(false);
          isLoadingHistoryRef.current = false;
          if (historyTimeoutRef.current) {
            clearTimeout(historyTimeoutRef.current);
            historyTimeoutRef.current = null;
          }
        }
        if (!hasCachedData) {
          setError((e as Error).message);
        }
      }
    } catch (e) {
      if (!hasCachedData) setError((e as Error).message);
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setSelectedConversation(null);
    setMessages([]);
    setMessage('');
  };

  // ============================================================
  // Переименование и Закрепление
  // ============================================================
  const handlePinRequest = async (id: string, pin: boolean) => {
    try {
      const result = await api.gatewayPinConversation(id, pin);
      if (result.success) {
        // Перезапрашиваем список, чтобы обновился порядок
        handleRefreshConversations();
      } else {
        setError(result.error || 'Ошибка закрепления');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRenameRequest = (id: string, currentTitle: string) => {
    setRenameTarget({ id, currentTitle });
  };

  const handleRenameConfirm = async (newTitle: string) => {
    if (!renameTarget || !newTitle || newTitle === renameTarget.currentTitle) {
      setRenameTarget(null);
      return;
    }

    try {
      const result = await api.gatewayRenameConversation(renameTarget.id, newTitle);
      if (result.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === renameTarget.id ? { ...c, title: newTitle } : c))
        );
      } else {
        setError(result.error || 'Ошибка переименования');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRenameTarget(null);
    }
  };

  // ============================================================
  // Массовые действия с диалогами (Мульти-выбор)
  // ============================================================
  const handleToggleChatSelectMode = () => {
    if (isChatSelectMode) {
      setIsChatSelectMode(false);
      setSelectedChatIds(new Set());
    } else {
      setIsChatSelectMode(true);
      setSelectedChatIds(new Set());
    }
  };

  const handleToggleChatSelection = (id: string) => {
    const newSelected = new Set(selectedChatIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedChatIds(newSelected);
  };

  const handleBulkPinChats = async () => {
    if (selectedChatIds.size === 0) return;
    setLoading(true);
    const ids = Array.from(selectedChatIds);
    
    for (const id of ids) {
      await api.gatewayPinConversation(id, true).catch(console.error);
    }
    
    setIsChatSelectMode(false);
    setSelectedChatIds(new Set());
    handleRefreshConversations();
    setLoading(false);
  };

  const handleBulkDeleteChats = async () => {
    if (selectedChatIds.size === 0) return;
    if (!window.confirm(`Удалить ${selectedChatIds.size} диалогов из DeepSeek?`)) return;

    setLoading(true);
    const ids = Array.from(selectedChatIds);

    for (const id of ids) {
      await api.gatewayDeleteConversation(id).catch(console.error);
    }

    setIsChatSelectMode(false);
    setSelectedChatIds(new Set());
    handleRefreshConversations();
    setLoading(false);
  };

  // ============================================================
  // Удаление диалога (Шаг 8)
  // ============================================================
  const handleDeleteRequest = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setDeleteTarget({ id, title: conv.title });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(true);
    setError('');

    try {
      const result = await api.gatewayDeleteConversation(id);
      if (!result?.success) {
        setError(result?.error || 'Не удалось удалить диалог');
        setDeleting(false);
        return;
      }

      // 1. Убрать из sidebar
      setConversations((prev) => prev.filter((c) => c.id !== id));

      // 2. Если удалили текущий — сбросить чат
      if (selectedConversation === id) {
        setSelectedConversation(null);
        setMessages([]);
        setMessage('');
        setLiveAssistantHtml('');
        setLiveReasoning('');
      }

      // 3. Закрыть модалку
      setDeleteTarget(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const handleToggleSelectMode = async () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIndices(new Set());
      await api.gatewayCancelSelectionMode().catch(() => {});
    } else {
      setSelectionMode(true);
      await api.gatewayStartSelectionMode().catch(() => {});

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const allIndices = messages.map((_, idx) => idx);
      setSelectedIndices(new Set(allIndices));
      await api.gatewaySelectMessages(allIndices).catch(() => {});
    }
  };

  const handleToggleMessageSelect = async (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
    await api.gatewaySelectMessages(Array.from(newSelected)).catch(() => {});
  };

  const handleSelectAll = async () => {
    if (selectedIndices.size === messages.length && messages.length > 0) {
      setSelectedIndices(new Set());
      await api.gatewaySelectMessages([]).catch(() => {});
    } else {
      const allIndices = messages.map((_, idx) => idx);
      setSelectedIndices(new Set(allIndices));
      await api.gatewaySelectMessages(allIndices).catch(() => {});
    }
  };

  const createLink = async (): Promise<string> => {
    const result = await api.gatewayCreatePublicLink();
    if (!result.success) {
      throw new Error(result.error || 'Ошибка создания ссылки');
    }
    return result.data;
  };

  const handleCreatePublicLink = () => {
    if (!selectedIndices.size) return;
    setShareModalVisible(true);
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error('Ошибка копирования в буфер обмена:', err);
    });
  };

  const handleEditMessage = () => {
    console.warn('Редактирование сообщения пока не реализовано');
  };

  const handleRegenerate = async (conversationId: string, messageIndex: number) => {
    if (!conversationId) {
      setError('Не выбран диалог');
      return;
    }
    try {
      await api.gatewayRegenerateMessage(conversationId, messageIndex);

      // 5.6.1: sync visible-only (без scroll). selectByPwKey обновит
      // контент in-place — новый regenerate-ответ имеет тот же pw_key.
      // UI обновится через bridge history:changed → history:complete.
      // Не трогаем setMessages вручную — иначе потеряем полную историю.
      const title =
        conversationsRef.current.find((c) => c.id === conversationId)?.title ||
        'Диалог';
      await api
        .gatewayGetConversationMessages(conversationId, title, {
          skipBackgroundScroll: true,
        })
        .catch((e: Error) =>
          console.warn('[handleRegenerate] post-regen sync failed:', e.message)
        );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleBranchSwitch = async (
    messageIndex: number,
    direction: 'prev' | 'next'
  ) => {
    if (!selectedConversation) return;
    if (branchSwitchingRef.current) {
      console.log('[branch-switch] already in progress — skip');
      return;
    }
    const msg = messages[messageIndex];
    const pwKey = msg?.pwKey
      ? String(msg.pwKey)
      : (msg?.id && /^\d+$/.test(String(msg.id)) ? String(msg.id) : null);
    if (!pwKey || !/^\d+$/.test(pwKey)) {
      setError('Не удалось переключить ветку: нет числового pwKey');
      return;
    }

    const pwKeyNum = parseInt(pwKey, 10);
    // 5.7.50: user меняет ПАРУ (user+assistant). assistant — только СЕБЯ.
    // Для assistant pwKey+1 — это user следующей реплики, к ветке не относится.
    const targets: number[] = [pwKeyNum];
    if (msg.role === 'user') {
      targets.push(pwKeyNum + 1);
    }
    const oldHashes: string[] = [];
    for (const m of messages) {
      if (typeof m.pwKey !== 'string') continue;
      const k = parseInt(m.pwKey, 10);
      if (isNaN(k)) continue;
      if (targets.includes(k) && m.messageHash) {
        oldHashes.push(m.messageHash);
      }
    }

    branchSwitchingRef.current = true;
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = true;

    try {
      console.log('[branch-switch] invoke', { pwKey, direction, oldHashes });

      const sw = await api.gatewaySwitchBranch(pwKey, direction, {
        branchTotal: msg.branchTotal,
        branchIndex: msg.branchIndex,
        role: msg.role,
      });
      if (!sw?.success) throw new Error(sw?.error || 'switch failed');

      const title =
        conversationsRef.current.find((c) => c.id === selectedConversation)
          ?.title || 'Диалог';
      // Без prune — не трогаем остальные 40+ сообщений
      await api.gatewayGetConversationMessages(
        selectedConversation,
        title,
        { skipBackgroundScroll: true }
      );

      if (oldHashes.length > 0) {
        await api.gatewayDeactivateByHashes(selectedConversation, oldHashes);
      }

      const reloaded = await api.gatewayCacheMessages(selectedConversation);
      if (reloaded.success && reloaded.data && reloaded.data.length > 0) {
        const mapped = reloaded.data.map((m: any) =>
          mapCachedMessage(m, selectedConversation)
        );
        setMessages(mapped);
        latestHistoryRef.current = mapped;
      }
    } catch (e) {
      console.error('[branch-switch] failed:', (e as Error).message);

      // 5.7.47: fallback — привязать UI к реальности PW.
      // Если switchBranch не нашёл pwKey в DOM — DB была stale
      // (ветка собрана traverse-багом). Делаем visible-sync + перечитываем БД.
      try {
        const title =
          conversationsRef.current.find((c) => c.id === selectedConversation)
            ?.title || 'Диалог';
        await api.gatewayGetConversationMessages(
          selectedConversation,
          title,
          { skipBackgroundScroll: true }
        );
        const reloaded = await api.gatewayCacheMessages(selectedConversation);
        if (
          reloaded.success &&
          reloaded.data &&
          reloaded.data.length > 0
        ) {
          const mapped = reloaded.data.map((m: any) =>
            mapCachedMessage(m, selectedConversation)
          );
          setMessages(mapped);
          latestHistoryRef.current = mapped;
          setError(
            'Ветка в БД рассинхронизирована с PW. UI пересинхронизирован. ' +
              'Запусти Ctrl+Alt+R для полного sync.'
          );
          console.log('[branch-switch] fallback resync: UI привязан к PW');
        }
      } catch (e2) {
        console.warn(
          '[branch-switch] fallback resync failed:',
          (e2 as Error).message
        );
        setError((e as Error).message);
      }
    } finally {
      branchSwitchingRef.current = false;
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = false;
    }
  };

  const handleFeedback = async (conversationId: string, messageIndex: number, type: 'like' | 'dislike') => {
    if (!conversationId) {
      setError('Не выбран диалог');
      return;
    }
    try {
      await api.gatewaySendFeedback(conversationId, messageIndex, type);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleShareSingle = async (index: number) => {
    setSelectionMode(true);
    setSelectedIndices(new Set([index]));
    try {
      await api.gatewayStartSelectionMode();
      await api.gatewaySelectMessages([index]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <TopControlPanel
        status={status}
        isLoggedIn={isLoggedIn}
        error={error}
        loading={loading}
        sending={sending}
        onLaunch={handleLaunch}
        onRefreshConversations={handleRefreshConversations}
        onToggleDeepThinking={handleDeepThinkingChange}
        onToggleSearch={handleSearchChange}
        deepThinking={deepThinking}
        search={search}
        isOpen={topPanelOpen}
        onOpen={() => setTopPanelOpen(true)}
        onClose={() => setTopPanelOpen(false)}
        onPanelMouseEnter={() => setPanelHovered(true)}
        onPanelMouseLeave={() => setPanelHovered(false)}
        onOpenCacheManager={() => setCacheManagerOpen(true)}
      />
      <GatewayDeepseekShadowRoot>
        <GatewayShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          onCreateLink={createLink}
          onCreated={() => {
            setSelectionMode(false);
            setSelectedIndices(new Set());
            api.gatewayCancelSelectionMode().catch(() => {});
          }}
        />
        <div className="cb86951c" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="cddfb2ed" />
          <div className="c3ecdb44" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div 
              className="dc04ec1d" 
              style={{ 
                display: 'flex', 
                width: isSidebarCollapsed ? '175px' : '260px', 
                transition: 'width 0.2s ease',
                flexShrink: 0,
                overflow: 'hidden'
              }}
            >
              <GatewaySidebar
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleOpenConversation}
                onRefresh={handleRefreshConversations}
                isLoggedIn={isLoggedIn}
                onNewChat={handleNewChat}
                onRenameRequest={handleRenameRequest}
                onPinRequest={handlePinRequest}
                onDeleteRequest={handleDeleteRequest}
                onMultiSelectRequest={handleToggleChatSelectMode}
                
                isChatSelectMode={isChatSelectMode}
                selectedChatIds={selectedChatIds}
                onToggleChatSelection={handleToggleChatSelection}
                onToggleChatSelectMode={handleToggleChatSelectMode}
                onBulkPinChats={handleBulkPinChats}
                onBulkDeleteChats={handleBulkDeleteChats}

                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onOpenSearch={() => setIsSearchOpen(true)}
              />
            </div>
            <div className="_4cbcd96" />
            <div
              className="_7780f2e"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'row',
                minHeight: 0,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: selectionMode ? 'row' : 'column',
                  minHeight: 0,
                  minWidth: 0,
                  position: 'relative',
                }}
              >
              {messages.length === 0 ? (
                <div
                  className="_765a5cd"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    width: '100%',
                  }}
                >
                  <div
                    className="_660ca72"
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 24px',
                      width: '100%',
                    }}
                  >
                    <GatewayWelcome />
                    <div style={{ width: '100%', maxWidth: '780px', margin: '0 auto' }}>
                      <GatewayInputArea
                        value={message}
                        onChange={setMessage}
                        onSend={handleSend} 
                        disabled={!isLoggedIn}
                        sending={sending}
                        deepThinking={deepThinking}
                        search={search}
                        onToggleDeepThinking={() => handleDeepThinkingChange(!deepThinking)}
                        onToggleSearch={() => handleSearchChange(!search)}
                        contextUsedTokens={contextUsage.used}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                    <div className="_765a5cd" style={{ flexShrink: 0, width: '100%' }}>
                      <GatewayChatHeader
                        title={
                          selectedConversation
                            ? conversations.find(c => c.id === selectedConversation)?.title || 'Диалог'
                            : 'Новый чат'
                        }
                        showTitle={true}
                        onToggleSelectMode={handleToggleSelectMode}
                      />
                    </div>

                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        minHeight: 0,
                        position: 'relative',
                      }}
                    >
                    <div
                      className="ds-virtual-list ds-virtual-list--printable"
                      ref={scrollContainerRef}
                      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                    >
                      <div
                        className="ds-virtual-list-items _6f2c522"
                        style={{
                          paddingTop: '0px',
                          paddingBottom: '120px',   // ← место под кнопки последнего сообщения + input
                          paddingLeft: 'calc((100% - var(--message-list-max-width)) / 2)',
                          paddingRight: 'calc((100% - var(--message-list-max-width)) / 2)',
                          flexShrink: '0',
                          flexGrow: '1',
                          minHeight: '0',
                        }}
                      >
                        <div className="ds-virtual-list-visible-items">
                          {messages.map((msg, idx) => {
                            const isLast = idx === messages.length - 1;
                            // Защита от коллизий: оптимистичные сообщения (id=undefined)
                            // получают idx, реальные из БД — числовой id (pwKey).
                            // Префикс гарантирует уникальность между ними.
                            const key = msg.id
                              ? `id-${msg.id}`
                              : msg.messageHash
                                ? `hash-${msg.messageHash}`
                                : `idx-${idx}`;
                            if (idx >= messages.length - 2) {
                              console.log(
                                `[RENDER] idx=${idx} role=${msg.role} key=${String(key).slice(0, 20)} ` +
                                `text="${(msg.blocks?.[0]?.content || '').slice(0, 20)}"`
                              );
                            }
                            return msg.role === 'user' ? (
                              <GatewayMessageUser
                                key={key}
                                blocks={msg.blocks}
                                messageHash={msg.messageHash ?? null}
                                fileStatuses={fileStatuses}
                                selectMode={selectionMode}
                                isSelected={selectedIndices.has(idx)}
                                onToggleSelect={() => handleToggleMessageSelect(idx)}
                                isLast={isLast}
                                onCopy={handleCopyMessage}
                                onEdit={handleEditMessage}
                                branchTotal={msg.branchTotal}
                                branchIndex={msg.branchIndex}
                                onBranchSwitch={(dir) =>
                                  handleBranchSwitch(idx, dir)
                                }
                                onFileClick={(block, chipIndex, mh) => {
                                  if (!selectedConversation) {
                                    setError('Не выбран диалог');
                                    return;
                                  }
                                  if (!mh) {
                                    setError(
                                      'Сообщение ещё не синхронизировано. Подождите пару секунд.'
                                    );
                                    return;
                                  }
                                  if (block.type !== 'file') return;
                                  setFilePanel({
                                    visible: true,
                                    block,
                                    conversationId: selectedConversation,
                                    messageHash: mh,
                                    pwKey: msg.pwKey ?? null,
                                    chipIndex,
                                  });
                                }}
                              />
                            ) : (
                              <GatewayMessageAssistant
                                key={key}
                                thinking={msg.thinking}
                                blocks={msg.blocks.filter((b) => b.type !== 'file')}
                                fullHtml={msg.fullHtml}
                                selectMode={selectionMode}
                                isSelected={selectedIndices.has(idx)}
                                onToggleSelect={() => handleToggleMessageSelect(idx)}
                                isLast={isLast}
                                onCopy={handleCopyMessage}
                                onRegenerate={() => handleRegenerate(selectedConversation!, idx)}
                                onFeedback={(type) => handleFeedback(selectedConversation!, idx, type)}
                                onShare={() => handleShareSingle(idx)}
                                branchTotal={msg.branchTotal}
                                branchIndex={msg.branchIndex}
                                onBranchSwitch={(dir) =>
                                  handleBranchSwitch(idx, dir)
                                }
                                sources={msg.sources}
                                onSourceClick={(sources) => setSourcesPanel({ isOpen: true, sources })}
                              />
                            );
                          })}
                          {(liveReasoning || liveAssistantHtml) &&
                            !(
                              messages.length > 0 &&
                              messages[messages.length - 1].role === 'assistant'
                            ) && (
                            <>
                              {liveReasoning && <GatewayLiveReasoning text={liveReasoning} />}
                              {liveAssistantHtml && <GatewayLiveAssistant html={liveAssistantHtml} />}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <GatewayMessageNavigation
                      scrollContainerRef={scrollContainerRef}
                      messages={messages}
                      isLoading={isHistoryLoading}
                    />
                    </div>

                    {!selectionMode && (
                      <>
                        <div className="_871cbca">
                          <div className="d72636e2" />
                          <GatewayInputArea
                            value={message}
                            onChange={setMessage}
                            onSend={handleSend}
                            disabled={!isLoggedIn}
                            sending={sending}
                            deepThinking={deepThinking}
                            search={search}
                            onToggleDeepThinking={() => handleDeepThinkingChange(!deepThinking)}
                            onToggleSearch={() => handleSearchChange(!search)}
                            contextUsedTokens={contextUsage.used}
                          />
                        </div>
                        <div className="_0fcaa63" style={{ width: '100%', flexShrink: 0, marginTop: 4 }}>
                          Сгенерировано ИИ, только для справки
                        </div>
                      </>
                    )}

                    {selectionMode && (
                      <div className="_43d222b _117e7c4">
                        <div className="_9f86274">
                          <div
                            className="ds-checkbox-wrapper ds-checkbox-wrapper--l _692accd"
                            style={{
                              color: 'inherit',
                              '--dsl-checkbox-font-size': 'inherit',
                              '--dsl-checkbox-label-gap': '12px',
                            } as React.CSSProperties}
                          >
                            <div className="ds-checkbox-align-wrapper">
                              <div
                                className={`ds-checkbox ds-checkbox--l ${
                                  selectedIndices.size === messages.length && messages.length > 0
                                    ? 'ds-checkbox--active'
                                    : ''
                                } ds-checkbox--none`}
                                tabIndex={0}
                                onClick={handleSelectAll}
                              >
                                {selectedIndices.size === messages.length && messages.length > 0 && (
                                  <CheckIcon size={14} />
                                )}
                              </div>
                            </div>
                            <div className="ds-checkbox-label">Выбрать все</div>
                          </div>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="2"
                            height="15"
                            viewBox="0 0 2 15"
                            fill="none"
                            style={{ color: 'var(--dsw-alias-border-l3)' }}
                          >
                            <path d="M1 0.5V14.5" stroke="currentColor" />
                          </svg>
                          <span className="dcaa34cd">Выбрано {selectedIndices.size} диалогов</span>
                          <div className="fab07e97">
                            <div
                              role="button"
                              className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width _43443f1"
                              tabIndex={0}
                              onClick={handleToggleSelectMode}
                            >
                              <span className="ds-button__content">Отмена</span>
                            </div>
                            <div
                              role="button"
                              className={`ds-button ds-button--primary ds-button--filled ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width ${
                                selectedIndices.size === 0 ? 'ds-button--disabled' : ''
                              }`}
                              tabIndex={0}
                              onClick={handleCreatePublicLink}
                              style={{ pointerEvents: selectedIndices.size === 0 ? 'none' : 'auto' }}
                            >
                              <span className="ds-button__content">Создать публичную ссылку</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectionMode && (
                    <GatewaySelectionPreview
                      messages={messages}
                      selectedIndices={selectedIndices}
                    />
                  )}
                </>
              )}
              </div>

              {filePanel?.visible && (
                <GatewayFilePanel
                  state={filePanel}
                  onClose={() => setFilePanel(null)}
                  onLoaded={(mh, ci) => {
                    setFileStatuses((prev) => {
                      const next = new Map(prev);
                      next.set(`${mh}:${ci}`, 'ok');
                      return next;
                    });
                  }}
                  width={filePanelWidth}
                  onWidthChange={setFilePanelWidth}
                />
              )}

              <GatewaySourcesPanel 
                isOpen={sourcesPanel.isOpen} 
                onClose={() => setSourcesPanel({ isOpen: false, sources: [] })} 
                sources={sourcesPanel.sources} 
              />
            </div>
          </div>
        </div>
        <GatewayConfirmModal
          visible={!!deleteTarget}
          title="Удалить диалог?"
          message={
            deleteTarget && (
              <>
                Диалог <strong>«{deleteTarget.title}»</strong> будет удалён из
                DeepSeek. Это действие нельзя отменить.
              </>
            )
          }
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          danger
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
        <GatewayInputModal
          visible={!!renameTarget}
          title="Переименовать диалог"
          initialValue={renameTarget?.currentTitle || ''}
          confirmLabel="Сохранить"
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenameTarget(null)}
        />
        <GatewayCacheManager
          visible={cacheManagerOpen}
          onClose={() => setCacheManagerOpen(false)}
        />
        <GatewaySearchModal
          visible={isSearchOpen}
          conversations={conversations}
          onClose={() => setIsSearchOpen(false)}
          onSelectResult={(convId) => {
            handleOpenConversation(convId);
            setIsSearchOpen(false);
          }}
        />
        <GatewayDialogLoadToast
          info={dialogLoadToast}
          convTitle={
            dialogLoadToast
              ? conversations.find((c) => c.id === dialogLoadToast.convId)?.title ||
                'Диалог'
              : ''
          }
          onClose={() => setDialogLoadToast(null)}
          onLoadRemaining={async (convId) => {
            try {
              const r = await api.gatewayFileFetchBatch(convId, 30);
              if (!r?.success) {
                setError(r?.error || 'Ошибка batch');
                return;
              }
              const d = r.data;
              if (d?.started) {
                // Пошло — toast обновится через file:batch-complete
                return;
              }

              // started: false — либо нет pending (нужен resync), либо уже идёт
              if (d?.total && d.total > 0) {
                // Уже идёт другой batch
                console.log(`[onLoadRemaining] уже идёт batch (${d.total})`);
                return;
              }

              // pending = 0. Возможные причины:
              // 1) Файлы уже в БД — но toast не знает (нужен resync statsBulk)
              // 2) message_hash = NULL в user-сообщениях → нужен resync из PW
              console.log('[onLoadRemaining] started=false, resync диалога...');

              const conv = conversations.find((c) => c.id === convId);
              const title = conv?.title || 'Диалог';

              // Принудительный resync: откроет диалог в PW, получит hash,
              // обновит БД → следующий batch увидит pending
              const syncRes = await api.gatewayGetConversationMessages(
                convId,
                title
              );
              if (!syncRes?.success) {
                setError(
                  syncRes?.error ||
                    'Не удалось синхронизировать. Откройте диалог в PW вручную.'
                );
                return;
              }

              // Пересчёт statsBulk
              const statsBulk = await api.gatewayFileStatsBulk();
              if (statsBulk.success && statsBulk.data) {
                const s = statsBulk.data[convId];
                if (s) {
                  setDialogLoadToast((prev) =>
                    prev && prev.convId === convId
                      ? {
                          ...prev,
                          filesTotal: s.total,
                          filesLoaded: s.loaded,
                          filesFailed: s.failed,
                        }
                      : prev
                  );
                }

                // Ещё раз batch — если после resync появился pending
                if (s && s.pending > 0) {
                  console.log(
                    '[onLoadRemaining] после resync pending =',
                    s.pending,
                    '— запускаем batch'
                  );
                  const r2 = await api.gatewayFileFetchBatch(convId, 30);
                  if (r2?.success && r2.data?.started) {
                    console.log(
                      `[onLoadRemaining] batch перезапущен (${r2.data.total})`
                    );
                  } else {
                    setError(
                      'Файлы остались недокачанными. Возможно, PW не отдал message_hash.'
                    );
                  }
                } else if (s && s.loaded === s.total && s.total > 0) {
                  console.log('[onLoadRemaining] все файлы уже загружены');
                } else {
                  setError(
                    'Не удалось найти недокачанные файлы. Проверьте, что диалог открыт в PW.'
                  );
                }
              }
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          batchProgress={
            batchToast &&
            dialogLoadToast &&
            batchToast.convId === dialogLoadToast.convId &&
            batchToast.status === 'running'
              ? {
                  current: batchToast.processed,
                  total: batchToast.total,
                  currentName: batchToast.currentName,
                }
              : null
          }
          onCancelTraverse={async () => {
            try {
              await api.gatewayCancelTraverse();
            } catch (e) {
              console.warn(
                '[dialog-load-toast] cancel error:',
                (e as Error).message
              );
            }
          }}
          onForceResync={handleForceResync}
        />
        <GatewayProgressToast
          state={batchToast}
          onCancel={async () => {
            if (batchToast?.convId) {
              await api.gatewayFileFetchCancel(batchToast.convId);
            }
          }}
          onDismiss={() => setBatchToast(null)}
        />
      </GatewayDeepseekShadowRoot>
    </div>
  );
};