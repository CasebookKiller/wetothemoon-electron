// src/pages/NavigatorPage/NavigatorSidebar.tsx

/**
 * NavigatorSidebar — список GigaChat-профилей + история диалогов из gateway.db.
 *
 * Секции:
 *  - «Профили» — фильтр provider === 'gigachat'.
 *  - «Диалоги» — из gateway.db (мгновенно, без браузера), обновление по кнопке.
 *
 * Клик по диалогу → onSelectConversation(convId). Загрузка истории в чат — в NavigatorPage.
 *
 * @module pages/NavigatorPage/NavigatorSidebar
 */

import React, { useCallback, useEffect, useState } from 'react';

interface ProfileRow {
  id: string;
  name: string;
  provider?: 'deepseek' | 'gigachat';
  hasSession: boolean;
  rateLimitedUntil?: number | null;
  bannedAt?: number | null;
}

interface ConversationRow {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
  lastMessageAt?: number;
  pinned: boolean;
}

export interface NavigatorSidebarProps {
  selectedId: string;
  onSelect: (id: string) => void;
  /** Выбранный диалог (для подсветки). */
  selectedConversationId?: string | null;
  /** Колбэк при клике на диалог. */
  onSelectConversation?: (convId: string) => void;
}

const formatLockTime = (ts?: number | null): string => {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const formatDate = (ts: number): string => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  } catch { return ''; }
};

export const NavigatorSidebar: React.FC<NavigatorSidebarProps> = ({
  selectedId, onSelect, selectedConversationId, onSelectConversation,
}) => {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);
  const [syncingConvId, setSyncingConvId] = useState<string | null>(null);

  // Профили
  const refresh = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api?.gatewayProfilesList) { setError('profiles IPC не готов'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const r = await api.gatewayProfilesList();
      if (r?.success && r.data?.profiles) {
        const gg = (r.data.profiles as ProfileRow[]).filter((p) => p.provider === 'gigachat');
        setProfiles(gg);
        if (gg.length > 0 && !gg.some((p) => p.id === selectedId)) {
          onSelect(gg[0].id);
        }
      } else {
        setError(r?.error || 'Не удалось загрузить профили');
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedId, onSelect]);

  // Диалоги
  const refreshConversations = useCallback(async (profileId: string) => {
    const api = (window as any).electronAPI;
    if (!profileId || !api?.navigator?.listConversations) return;
    setLoadingConvs(true);
    try {
      const r = await api.navigator.listConversations(profileId);
      if (r?.success && r.data) setConversations(r.data as ConversationRow[]);
      else setConversations([]);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const syncConversations = useCallback(async (profileId: string) => {
    const api = (window as any).electronAPI;
    if (!profileId || !api?.navigator?.syncConversations) return;
    setLoadingConvs(true);
    try {
      const r = await api.navigator.syncConversations(profileId);
      if (!r?.success) throw new Error(r?.error || 'Ошибка синхронизации');
      await refreshConversations(profileId);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingConvs(false);
    }
  }, [refreshConversations]);

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Перезагрузка диалогов при смене профиля
  useEffect(() => {
    if (selectedId) void refreshConversations(selectedId);
    else setConversations([]);
  }, [selectedId, refreshConversations]);

  const onLaunch = async () => {
    if (!selectedId) return;
    const api = (window as any).electronAPI;
    if (!api?.gatewayLaunchByProfile) { setError('launch IPC не готов'); return; }
    setLaunching(true); setError(null); setLaunchStatus(null);
    try {
      const r = await api.gatewayLaunchByProfile(selectedId);
      if (!r?.success) { setError(r?.error || 'Не удалось запустить'); return; }
      const status = r.data?.status as string | undefined;
      if (status === 'login_required') setLaunchStatus('Требуется вход в GigaChat (SberID)');
      else if (status === 'logged_in') setLaunchStatus('Готово: сессия активна');
      else setLaunchStatus(status ?? 'Запущено');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <aside
      style={{
        width: 280, minWidth: 280, height: '100%',
        borderRight: '1px solid rgba(0,229,255,0.12)',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(0,229,255,0.02)',
      }}
    >
      {/* ── Секция: Профили ── */}
      <div style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid rgba(0,229,255,0.12)' }}>
        GigaChat-профили
      </div>

      <div style={{ maxHeight: 180, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading && <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>Загрузка…</div>}
        {!loading && profiles.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>
            Нет GigaChat-профилей.<br />Создайте в Gateway → Аккаунты.
          </div>
        )}
        {profiles.map((p) => {
          const isSel = p.id === selectedId;
          const isRL = !!(p.rateLimitedUntil && p.rateLimitedUntil > Date.now());
          const isBanned = !!p.bannedAt;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                border: `1px solid ${isSel ? 'rgba(0,229,255,0.5)' : 'transparent'}`,
                background: isSel ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.02)',
                color: isSel ? '#fff' : '#e0e0e0',
                cursor: 'pointer', font: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: isSel ? 600 : 400 }}>{p.name}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  background: 'rgba(16,185,129,0.15)', color: '#10b981',
                }}>GG</span>
              </div>
              <div style={{ fontSize: 10, color: '#888', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!p.hasSession && <span style={{ color: '#f59e0b' }}>⚠ нет сессии</span>}
                {isBanned && <span style={{ color: '#ef4444' }}>⛔ забанен</span>}
                {isRL && <span style={{ color: '#f59e0b' }}>⏸ до {formatLockTime(p.rateLimitedUntil)}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid rgba(0,229,255,0.12)', borderBottom: '1px solid rgba(0,229,255,0.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && (
          <div style={{ fontSize: 11, color: '#ffb0b0', padding: '6px 8px', background: 'rgba(220,60,60,0.1)', borderRadius: 4 }}>
            {error}
          </div>
        )}
        {launchStatus && (
          <div style={{ fontSize: 11, color: '#00e5ff', padding: '6px 8px', background: 'rgba(0,229,255,0.08)', borderRadius: 4 }}>
            {launchStatus}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onLaunch}
            disabled={!selectedId || launching}
            className="pb"
            style={{ flex: 1, fontSize: 12, opacity: (!selectedId || launching) ? 0.5 : 1 }}
          >
            {launching ? 'Запускаю…' : 'Запустить'}
          </button>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="pb-icon"
            title="Обновить профили"
            style={{ opacity: loading ? 0.5 : 1 }}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* ── Секция: Диалоги ── */}
      <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Диалоги {conversations.length > 0 && <span style={{ color: '#888', fontWeight: 400 }}>({conversations.length})</span>}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => selectedId && void syncConversations(selectedId)}
            disabled={!selectedId || loadingConvs}
            className="pb"
            style={{ fontSize: 11, padding: '2px 6px', minHeight: 22, opacity: (!selectedId || loadingConvs) ? 0.5 : 1 }}
            title="Синхронизировать с GigaChat (список диалогов)"
          >
            Sync
          </button>
          <button
            onClick={() => selectedId && void refreshConversations(selectedId)}
            disabled={!selectedId || loadingConvs}
            className="pb-icon"
            title="Обновить (из БД)"
            style={{ fontSize: 12, opacity: (!selectedId || loadingConvs) ? 0.5 : 1 }}
          >
            ⟳
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loadingConvs && <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>Загрузка…</div>}
        {!loadingConvs && conversations.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>
            {selectedId
              ? 'Диалогов нет. Отправьте сообщение — появится здесь.'
              : 'Выберите профиль.'}
          </div>
        )}
        {(() => {
          const renderConv = (c: ConversationRow) => {
            const isSel = c.id === selectedConversationId;
            return (
              <button
                key={c.id}
                onClick={async () => {
                  // 1. Мгновенный отклик: показываем то, что уже есть в БД
                  onSelectConversation?.(c.id);

                  // 2. В фоне синхронизируем с GigaChat. URL backend восстановит из convId.
                  const api = (window as any).electronAPI;
                  if (!api?.navigator?.syncMessages || !selectedId) return;
                  setSyncingConvId(c.id);
                  try {
                    const r = await api.navigator.syncMessages(selectedId, c.id, '');
                    if (r?.success) {
                      await refreshConversations(selectedId);
                      onSelectConversation?.(c.id);
                    } else if (r?.error) {
                      setError(r.error);
                    }
                  } catch (e: any) {
                    setError(e?.message || String(e));
                  } finally {
                    setSyncingConvId(null);
                  }
                }}
                style={{
                  textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                  border: `1px solid ${isSel ? 'rgba(0,229,255,0.5)' : 'transparent'}`,
                  background: isSel ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.02)',
                  color: isSel ? '#fff' : '#d0d0d0',
                  cursor: 'pointer', font: 'inherit',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: isSel ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {syncingConvId === c.id ? '⟳ ' : ''}{c.title || 'Без названия'}
                </div>
                <div style={{ fontSize: 10, color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.messageCount} сообщ.</span>
                  <span>{formatDate(c.lastMessageAt ?? c.updatedAt)}</span>
                </div>
              </button>
            );
          };

          const favorites = conversations.filter((c) => c.pinned);
          const recent = conversations.filter((c) => !c.pinned);

          if (conversations.length === 0) {
            return (
              <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>
                {selectedId
                  ? 'Диалогов нет. Отправьте сообщение или нажмите Sync.'
                  : 'Выберите профиль.'}
              </div>
            );
          }

          return (
            <>
              {favorites.length > 0 && (
                <>
                  <div style={{ padding: '6px 4px 2px', fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Избранные
                  </div>
                  {favorites.map(renderConv)}
                </>
              )}
              {recent.length > 0 && (
                <>
                  <div style={{ padding: '6px 4px 2px', marginTop: favorites.length > 0 ? 6 : 0, fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Недавние чаты
                  </div>
                  {recent.map(renderConv)}
                </>
              )}
            </>
          );
        })()}
      </div>
    </aside>
  );
};

export default NavigatorSidebar;