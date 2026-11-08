// src/components/GATEWAY/GatewaySearchModal/GatewaySearchModal.tsx

import React, { useEffect, useRef, useState } from 'react';
import { SearchIcon, CloseIcon, ChatBubbleIcon } from '../GatewayIcons/GatewayIcons';

interface SearchResultItem {
  type: 'conversation' | 'message';
  conversationId: string;
  conversationTitle: string;
  snippet?: string;
  matchedAt?: number;
}

interface GatewaySearchModalProps {
  visible: boolean;
  conversations: { id: string; title: string; group?: string }[];
  onClose: () => void;
  onSelectResult: (convId: string) => void;
}

function formatShortDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightTitle(text: string, query: string) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query.trim())})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase()
      ? <mark key={i} className="gateway-search-modal__hl">{part}</mark>
      : <span key={i}>{part}</span>
  );
}

function highlightSnippet(snippet: string) {
  const parts = snippet.split(/(<<[^>]*>>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<<') && part.endsWith('>>')) {
      return <mark key={i} className="gateway-search-modal__hl">{part.slice(2, -2)}</mark>;
    }
    return <span key={i}>{part}</span>;
  });
}

export const GatewaySearchModal: React.FC<GatewaySearchModalProps> = ({
  visible,
  conversations,
  onClose,
  onSelectResult,
}) => {
  const api = (window as any).electronAPI;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        // 1. Title matches (из текущего списка conversations)
        const titleMatches: SearchResultItem[] = conversations
          .filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
          .map((c) => ({
            type: 'conversation',
            conversationId: c.id,
            conversationTitle: c.title,
          }));

        // 2. Content matches (из FTS5 в БД)
        const contentRes = await api.gatewayCacheSearch(q, 50).catch(() => ({ success: false }));
        const contentMatches: SearchResultItem[] = (contentRes.success && contentRes.data ? contentRes.data : []).map(
          (r: any) => ({
            type: 'message',
            conversationId: r.conversationId,
            conversationTitle: r.conversationTitle,
            snippet: r.snippet,
            matchedAt: r.savedAt,
          })
        );

        setResults([...titleMatches, ...contentMatches]);
      } catch (e) {
        console.error('[search]', e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, visible, conversations]);

  // Esc
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="ds-modal gateway-search-modal"
      aria-modal="true"
      role="dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ds-modal-focus-lock gateway-search-modal__focus-lock" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-content ds-elevated gateway-search-modal__content" role="dialog">
          {/* Поле ввода */}
          <div className="gateway-search-modal__input-wrapper">
            <div className="gateway-search-modal__input-icon">
              <SearchIcon size={16} />
            </div>
            <input
              ref={inputRef}
              type="text"
              role="searchbox"
              className="gateway-search-modal__input"
              placeholder="Поиск по чатам и сообщениям..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="gateway-search-modal__divider" />
            <button
              type="button"
              className="gateway-search-modal__close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          {/* Результаты */}
          <div className="gateway-search-modal__results">
            {loading && (
              <div className="gateway-search-modal__empty">Поиск...</div>
            )}
            {!loading && query.trim() && results.length === 0 && (
              <div className="gateway-search-modal__empty">Ничего не найдено</div>
            )}
            {!loading && results.map((r, idx) => (
              <div
                key={`${r.conversationId}-${r.type}-${idx}`}
                className={`gateway-search-modal__item${r.type === 'conversation' ? ' gateway-search-modal__item--conversation' : ''}`}
                role="option"
                onClick={() => {
                  onSelectResult(r.conversationId);
                  onClose();
                }}
              >
                <div className="gateway-search-modal__item-icon">
                  <ChatBubbleIcon size={20} />
                </div>
                <div className="gateway-search-modal__item-body">
                  <div className="gateway-search-modal__item-header">
                    <div className="gateway-search-modal__item-title">
                      {highlightTitle(r.conversationTitle, query)}
                    </div>
                    {r.matchedAt && (
                      <div className="gateway-search-modal__item-date">
                        {formatShortDate(r.matchedAt)}
                      </div>
                    )}
                  </div>
                  {r.snippet && (
                    <div className="gateway-search-modal__item-snippet">
                      {highlightSnippet(r.snippet)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatewaySearchModal;