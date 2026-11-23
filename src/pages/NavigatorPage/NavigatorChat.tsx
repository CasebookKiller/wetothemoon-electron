// src/pages/NavigatorPage/NavigatorChat.tsx

/**
 * NavigatorChat — чат со стримингом ответа от LLM-инструмента.
 *
 * Архитектура подписки:
 *  - onChunk ставится ОДИН раз при монтировании и снимается при unmount.
 *  - Профиль читается через ref — не нужно пересоздавать подписку.
 *  - handleChunk через ref — не устаревает при ре-рендерах.
 *  - safety-таймер: если 'done' не пришёл за 135с — снимаем busy, показываем ошибку.
 *
 * Контракт чанков (providers/types.ts + gigachat/adapter.ts):
 *  - { type:'text', text, reset?, format? }
 *      format: 'text' | 'markdown' | 'html' (default: 'text')
 *      - html     → dangerouslySetInnerHTML (GigaChat отдаёт готовый DOM)
 *      - markdown → renderMarkdown() из Gateway (Prism/KaTeX уже настроены)
 *      - text     → <span> с pre-wrap
 *  - { type:'done' }                  → финализировать
 *  - { type:'error', text }           → показать ошибку
 *  - прочие (reasoning/usage/...)     → игнор (forward-compat)
 *
 * @module pages/NavigatorPage/NavigatorChat
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '@/components/GATEWAY/utils/markdownRenderer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Формат `text`. default: 'text'. Для GigaChat — 'html'. */
  format?: 'text' | 'markdown' | 'html';
  streaming?: boolean;
}

export interface NavigatorChatProps {
  profileId: string | null;
  profileName?: string;
  /** ID выбранного диалога из БД — для загрузки истории. */
  conversationId?: string | null;
}

let msgSeq = 0;
const nextId = () => `m${++msgSeq}`;

const SAFETY_TIMEOUT_MS = 135_000;

export const NavigatorChat: React.FC<NavigatorChatProps> = ({ profileId, profileName, conversationId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const profileIdRef = useRef<string | null>(profileId);
  const safetyTimerRef = useRef<number | null>(null);

  // profileIdRef — актуальный профиль для колбэка подписки без пересоздания.
  useEffect(() => { profileIdRef.current = profileId; }, [profileId]);

  const clearSafety = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  // Автоскролл к низу при новых сообщениях/чанках.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Сброс чата при смене профиля.
  useEffect(() => {
    setMessages([]); setError(null); setBusy(false); clearSafety();
  }, [profileId, clearSafety]);

  // Загрузка истории диалога из gateway.db.
  useEffect(() => {
    if (!conversationId) return;
    const api = (window as any).electronAPI;
    if (!api?.navigator?.getMessages) return;
    let cancelled = false;
    setBusy(true); setError(null);
    api.navigator.getMessages(conversationId).then((r: any) => {
      if (cancelled) return;
      if (r?.success && r.data) {
        const loaded: ChatMessage[] = r.data.map((m: any) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          format: m.format as ChatMessage['format'],
        }));
        setMessages(loaded);
      } else if (r?.error) {
        setError(r.error);
      }
    }).catch((e: any) => {
      if (!cancelled) setError(e?.message || String(e));
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => { cancelled = true; };
  }, [conversationId]);

  const finalizeAssistant = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant' && last.streaming) {
        const { streaming, ...rest } = last;
        return [...prev.slice(0, -1), rest];
      }
      return prev;
    });
  }, []);

  const handleChunk = useCallback((chunk: any) => {
    if (chunk?.type === 'text' && typeof chunk.text === 'string') {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const fmt = (chunk.format as ChatMessage['format']) ?? 'text';
        if (last && last.role === 'assistant' && last.streaming) {
          // Для 'html' каждый чанк уже reset (адаптер так отдаёт) — просто заменяем.
          // Для 'text'/'markdown' — конкатенация, если не reset.
          const text = chunk.reset ? chunk.text : last.text + chunk.text;
          return [...prev.slice(0, -1), { ...last, text, format: fmt }];
        }
        return [...prev, {
          id: nextId(), role: 'assistant',
          text: chunk.text, format: fmt, streaming: true,
        }];
      });
      return;
    }
    if (chunk?.type === 'done') {
      finalizeAssistant();
      setBusy(false);
      clearSafety();
      return;
    }
    if (chunk?.type === 'error') {
      const text = typeof chunk.text === 'string' ? chunk.text : 'неизвестная ошибка';
      finalizeAssistant();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text: `⚠ Ошибка: ${text}` },
      ]);
      setBusy(false);
      setError(text);
      clearSafety();
    }
    // reasoning / usage / прочее — игнорируем (forward-compat)
  }, [finalizeAssistant, clearSafety]);

  // Ref на актуальный handleChunk — подписка ставится один раз.
  const handleChunkRef = useRef(handleChunk);
  useEffect(() => { handleChunkRef.current = handleChunk; }, [handleChunk]);

  // Единственная подписка на чанки — на всё время жизни компонента.
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.navigator?.onChunk) return;
    const unsub = api.navigator.onChunk((payload: { profileId: string; chunk: any }) => {
      if (!profileIdRef.current || payload?.profileId !== profileIdRef.current) return;
      handleChunkRef.current(payload.chunk);
    });
    return () => { unsub?.(); };
  }, []);

  // Cleanup safety-таймера при unmount.
  useEffect(() => () => clearSafety(), [clearSafety]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !profileId || busy) return;

    const api = (window as any).electronAPI;
    if (!api?.navigator?.send) { setError('navigator IPC не готов'); return; }

    setInput(''); setError(null); setBusy(true);
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);

    clearSafety();
    safetyTimerRef.current = window.setTimeout(() => {
      setBusy(false);
      finalizeAssistant();
      setError('Ответ не получен за 135 сек (timeout). Попробуйте ещё раз.');
    }, SAFETY_TIMEOUT_MS);

    try {
      const r = await api.navigator.send(profileId, text);
      if (!r?.success) {
        clearSafety();
        setBusy(false);
        finalizeAssistant();
        setError(r?.error || 'Не удалось отправить');
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', text: `⚠ ${r?.error || 'Не удалось отправить'}` },
        ]);
      }
    } catch (e: any) {
      clearSafety();
      setBusy(false);
      finalizeAssistant();
      setError(e?.message || String(e));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  };

  return (
    <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid rgba(0,229,255,0.12)',
        fontSize: 13, color: '#e0e0e0', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{profileName ?? (profileId ? 'Выбранный профиль' : 'Не выбран профиль')}</span>
        {busy && <span style={{ fontSize: 11, color: '#00e5ff' }}>● стрим идёт…</span>}
      </div>

      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#666', fontSize: 13 }}>
            {profileId
              ? 'Напишите сообщение — ответ придёт стримом.'
              : 'Выберите GigaChat-профиль слева.'}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '8px 12px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(0,229,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${m.role === 'user' ? 'rgba(0,229,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: '#eaeaea', fontSize: 13, wordBreak: 'break-word',
            }}
          >
            {m.role === 'user' ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
            ) : m.format === 'html' ? (
              <div
                className="navigator-markdown"
                dangerouslySetInnerHTML={{ __html: m.text }}
              />
            ) : m.format === 'markdown' ? (
              <div
                className="navigator-markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
              />
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
            )}
            {m.streaming && m.role === 'assistant' && (
              <span style={{ color: '#00e5ff' }}> ▌</span>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          margin: '0 16px 8px', padding: '6px 10px', fontSize: 11, color: '#ffb0b0',
          background: 'rgba(220,60,60,0.1)', borderRadius: 6,
        }}>
          {error}
        </div>
      )}

      <div style={{ padding: 12, borderTop: '1px solid rgba(0,229,255,0.12)', display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={profileId ? 'Сообщение… (Enter — отправить, Shift+Enter — новая строка)' : 'Сначала выберите профиль'}
          disabled={!profileId || busy}
          rows={2}
          style={{
            flex: 1, resize: 'vertical', minHeight: 44, maxHeight: 180,
            padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
            background: 'rgba(255,255,255,0.04)', color: '#f5f5f5',
            border: '1px solid rgba(0,229,255,0.15)', borderRadius: 8, outline: 'none',
          }}
        />
        <button
          onClick={() => void onSend()}
          disabled={!profileId || busy || !input.trim()}
          className="pb"
          style={{
            alignSelf: 'flex-end', minWidth: 90,
            opacity: (!profileId || busy || !input.trim()) ? 0.5 : 1,
          }}
        >
          {busy ? 'Ждём…' : 'Отправить'}
        </button>
      </div>
    </section>
  );
};

export default NavigatorChat;