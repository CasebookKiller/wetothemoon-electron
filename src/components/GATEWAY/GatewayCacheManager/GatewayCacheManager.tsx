// src/components/GATEWAY/GatewayCacheManager/GatewayCacheManager.tsx

import React, { useEffect, useState } from 'react';
import { CloseIcon, TrashIcon, DatabaseIcon } from '../GatewayIcons/GatewayIcons';
import { GatewayConfirmModal } from '../GatewayConfirmModal/GatewayConfirmModal';
import { GatewayDiagnosticModal } from './GatewayDiagnosticModal';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';

interface GatewayCacheManagerProps {
  visible: boolean;
  onClose: () => void;
}

interface CacheStats {
  dbPath: string;
  dbSizeBytes: number;
  conversationCount: number;
  messageCount: number;
  lastUpdated?: number;
}

interface CacheConversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
  lastMessageAt?: number;
  pinned: boolean;
}

type Tab = 'overview' | 'conversations' | 'actions';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const GatewayCacheManager: React.FC<GatewayCacheManagerProps> = ({
  visible,
  onClose,
}) => {
  const api = (window as any).electronAPI;
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [conversations, setConversations] = useState<CacheConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [fileStats, setFileStats] = useState<
    Record<string, { total: number; loaded: number; pending: number; failed: number }>
  >({});
  const [batchingConvId, setBatchingConvId] = useState<string | null>(null);
  
  // 5.8.x: диагностика веток (read-only)
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagReport, setDiagReport] = useState<any | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  const runDiagnostic = async (convId: string, convTitle?: string) => {
    setDiagOpen(true);
    setDiagLoading(true);
    setDiagError(null);
    setDiagReport(null);
    try {
      const r = await api.gatewayDiagnoseBranches(convId, convTitle);
      if (!r.success) throw new Error(r.error || 'diagnostics failed');
      setDiagReport(r.data);
    } catch (e) {
      setDiagError((e as Error).message);
    } finally {
      setDiagLoading(false);
    }
  };
  
  // 5.7.24: сбор всех веток (true = медленно, false = только активная)
  const [collectAllBranches, setCollectAllBranches] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gateway.collectAllBranches') === '1';
    } catch {
      return false;
    }
  });
  
  // 5.8.3: скорость скроллинга
  const [scrollSpeed, setScrollSpeed] = useState<'fast' | 'normal' | 'slow'>(() => {
    try {
      const v = localStorage.getItem('gateway.scrollSpeed');
      if (v === 'fast' || v === 'normal' || v === 'slow') return v;
    } catch {}
    return 'normal';
  });
  
  const [scrollMode, setScrollMode] = useState<'snapshot' | 'normal' | 'deep'>(() => {
    try {
      const v = localStorage.getItem('gateway.scrollMode');
      if (v === 'snapshot' || v === 'normal' || v === 'deep') return v;
    } catch {}
    return 'snapshot';
  });
  
  const handleScrollSpeedChange = (v: 'fast' | 'normal' | 'slow') => {
    setScrollSpeed(v);
    try { localStorage.setItem('gateway.scrollSpeed', v); } catch {}
  };

  const handleToggleCollectBranches = (v: boolean) => {
    setCollectAllBranches(v);
    try {
      localStorage.setItem('gateway.collectAllBranches', v ? '1' : '0');
    } catch {}
  };

  // Автозагрузка файлов
  const [autoFetchCount, setAutoFetchCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem('gateway.autoFetchFileCount');
      if (v === null) return 0;
      const n = parseInt(v, 10);
      if (n === 0 || n === 3 || n === 5 || n === 10) return n;
    } catch {
      /* ignore */
    }
    return 0;
  });

  // TTL для старых версий файлов (7/14/30/90)
  const [ttlDays, setTtlDays] = useState<number>(() => {
    try {
      const v = localStorage.getItem('gateway.fileTTLDays');
      if (v) {
        const n = parseInt(v, 10);
        if ([7, 14, 30, 90].includes(n)) return n;
      }
    } catch {}
    return 7;
  });

  const handleAutoFetchChange = (v: number) => {
    setAutoFetchCount(v);
    try {
      localStorage.setItem('gateway.autoFetchFileCount', String(v));
    } catch {
      /* ignore */
    }
  };

  const refreshStats = async () => {
    try {
      const result = await api.gatewayCacheStats();
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || 'Ошибка загрузки статистики');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const refreshConversations = async () => {
    try {
      const result = await api.gatewayCacheList();
      if (result.success) {
        setConversations(result.data || []);
      } else {
        setError(result.error || 'Ошибка загрузки диалогов');
      }

      // Параллельно — bulk-статистика файлов (для бейджей)
      try {
        const statsRes = await api.gatewayFileStatsBulk();
        if (statsRes.success) {
          setFileStats(statsRes.data || {});
        }
      } catch (e) {
        console.warn('[cache-manager] file-stats-bulk failed:', e);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setError('');
    setInfo('');
    setLoading(true);
    Promise.all([refreshStats(), refreshConversations()]).finally(() =>
      setLoading(false)
    );
  }, [visible]);

  // Esc
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmClear && !confirmDeleteId) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, confirmClear, confirmDeleteId, onClose]);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const result = await api.gatewayCacheClear();
      if (result.success) {
        setInfo('Кэш очищен');
        setConfirmClear(false);
        await Promise.all([refreshStats(), refreshConversations()]);
      } else {
        setError(result.error || 'Ошибка очистки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  const handleExportMd = async (id: string) => {
    setExportingId(id);
    setError('');
    setInfo('');
    try {
      const result = await api.gatewayCacheExportMd(id);
      if (result.success) {
        setInfo(`Экспортировано: ${result.data}`);
      } else {
        setError(result.error || 'Ошибка экспорта');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportingId(null);
    }
  };

  const handleDeleteFromCache = async (id: string) => {
    setConfirmDeleteId(null);
    try {
      const result = await api.gatewayCacheDelete(id);
      if (result.success) {
        setInfo('Диалог удалён из кэша');
        await Promise.all([refreshStats(), refreshConversations()]);
      } else {
        setError(result.error || 'Ошибка удаления из кэша');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="ds-modal ds-fade-in-zoom-in-enter ds-fade-in-zoom-in-active gateway-cache-modal"
        aria-modal="true"
        role="dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget && !clearing) onClose();
        }}
      >
        <div
          className="ds-modal-focus-lock gateway-cache-modal__focus-lock"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            tabIndex={-1}
            className="ds-modal-content ds-elevated ds-modal-content--dialog gateway-cache-modal__content"
          >
            <div className="ds-modal-content__header-wrapper">
              <div className="ds-modal-content__title">
                <span className="gateway-cache-modal__title-icon">
                  <DatabaseIcon size={16} />
                </span>
                Управление кэшем
              </div>
              <div
                role="button"
                className="ds-modal-content__close"
                onClick={() => !clearing && onClose()}
                tabIndex={0}
              >
                <CloseIcon size={14} />
              </div>
            </div>

            {/* Tabs */}
            <div className="gateway-cache-modal__tabs">
              <button
                type="button"
                className={`gateway-cache-modal__tab${tab === 'overview' ? ' gateway-cache-modal__tab--active' : ''}`}
                onClick={() => setTab('overview')}
              >
                Обзор
              </button>
              <button
                type="button"
                className={`gateway-cache-modal__tab${tab === 'conversations' ? ' gateway-cache-modal__tab--active' : ''}`}
                onClick={() => setTab('conversations')}
              >
                Диалоги {conversations.length > 0 && `(${conversations.length})`}
              </button>
              <button
                type="button"
                className={`gateway-cache-modal__tab${tab === 'actions' ? ' gateway-cache-modal__tab--active' : ''}`}
                onClick={() => setTab('actions')}
              >
                Действия
              </button>
            </div>

            {/* Errors / Info */}
            {error && <div className="gateway-cache-modal__banner gateway-cache-modal__banner--error">{error}</div>}
            {info && <div className="gateway-cache-modal__banner gateway-cache-modal__banner--info">{info}</div>}

            <div className="ds-modal-content__main gateway-cache-modal__main">
              {loading && <div className="gateway-cache-modal__loading">Загрузка…</div>}

              {/* ---- Overview ---- */}
              {!loading && tab === 'overview' && (
                <div className="gateway-cache-overview">
                  {stats ? (
                    <>
                      <div className="gateway-cache-overview__row">
                        <span className="gateway-cache-overview__label">Путь БД:</span>
                        <span className="gateway-cache-overview__value gateway-cache-overview__value--mono">
                          {stats.dbPath || '—'}
                        </span>
                      </div>
                      <div className="gateway-cache-overview__row">
                        <span className="gateway-cache-overview__label">Размер БД:</span>
                        <span className="gateway-cache-overview__value">
                          {formatBytes(stats.dbSizeBytes)}
                        </span>
                      </div>
                      <div className="gateway-cache-overview__row">
                        <span className="gateway-cache-overview__label">Диалогов:</span>
                        <span className="gateway-cache-overview__value">
                          {stats.conversationCount}
                        </span>
                      </div>
                      <div className="gateway-cache-overview__row">
                        <span className="gateway-cache-overview__label">Сообщений:</span>
                        <span className="gateway-cache-overview__value">
                          {stats.messageCount}
                        </span>
                      </div>
                      <div className="gateway-cache-overview__row">
                        <span className="gateway-cache-overview__label">Последнее обновление:</span>
                        <span className="gateway-cache-overview__value">
                          {formatDate(stats.lastUpdated)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="gateway-cache-modal__empty">Нет данных</div>
                  )}
                </div>
              )}

              {/* ---- Conversations ---- */}
              {!loading && tab === 'conversations' && (
                <div className="gateway-cache-conversations">
                  {conversations.length === 0 ? (
                    <div className="gateway-cache-modal__empty">
                      Кэш пуст. Откройте любой диалог в DeepSeek — он сохранится автоматически.
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const fs = fileStats[conv.id];
                      const hasFiles = !!fs && fs.total > 0;
                      const pending = fs?.pending ?? 0;
                      const loaded = fs?.loaded ?? 0;
                      const total = fs?.total ?? 0;
                      const allLoaded = hasFiles && pending === 0 && fs.failed === 0;
                      const isBatching = batchingConvId === conv.id;
                      return (
                        <div key={conv.id} className="gateway-cache-conversations__row">
                          <div className="gateway-cache-conversations__info">
                            <div className="gateway-cache-conversations__title" title={conv.title}>
                              {conv.title}
                            </div>
                            <div className="gateway-cache-conversations__meta">
                              {conv.messageCount} сообщ.
                              {hasFiles && (
                                <>
                                  {' · '}
                                  <span
                                    className={
                                      allLoaded
                                        ? 'gateway-cache-conversations__files-ok'
                                        : 'gateway-cache-conversations__files-pending'
                                    }
                                  >
                                    файлы: {loaded}/{total}
                                    {fs.failed > 0 && ` (${fs.failed} с ошибкой)`}
                                  </span>
                                </>
                              )}
                              {' · '}
                              {formatDate(conv.updatedAt)}
                            </div>
                          </div>
                          <div className="gateway-cache-conversations__actions">
                            {hasFiles && pending > 0 && (
                              <div
                                role="button"
                                className="ds-button ds-button--primary ds-button--filled ds-button--capsule ds-button--m gateway-cache-conversations__btn"
                                onClick={async () => {
                                  if (!conv.id || isBatching) return;
                                  setBatchingConvId(conv.id);
                                  try {
                                    const r = await api.gatewayFileFetchBatch(
                                      conv.id,
                                      30
                                    );
                                    if (!r.success) {
                                      setError(r.error || 'Ошибка batch');
                                    } else if (r.data?.started === false) {
                                      setInfo(
                                        r.data.total === 0
                                          ? 'Нет недокачанных файлов'
                                          : `Уже загружается (${r.data.total})`
                                      );
                                    } else {
                                      setInfo(
                                        `Загрузка запущена (${r.data?.total ?? pending})`
                                      );
                                    }
                                  } catch (e) {
                                    setError((e as Error).message);
                                  } finally {
                                    setTimeout(() => setBatchingConvId(null), 500);
                                  }
                                }}
                                style={{ pointerEvents: isBatching ? 'none' : 'auto', opacity: isBatching ? 0.6 : 1 }}
                                title={`Загрузить все недокачанные файлы (${pending})`}
                              >
                                {isBatching 
                                  ? <><AppIcon name="download" set="material" spin /> …</>
                                  : <><AppIcon name="download" set="material" /> Загрузить ({pending})</>
                                }
                              </div>
                            )}
                            {hasFiles && allLoaded && (
                              <div className="gateway-cache-conversations__all-loaded">
                                <AppIcon name="check" set="material" color="success" /> все файлы
                              </div>
                            )}
                            <div
                              role="button"
                              className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m gateway-cache-conversations__btn"
                              onClick={() => runDiagnostic(conv.id, conv.title)}
                              title="Диагностика веток (read-only)"
                            >
                              <AppIcon name="search" set="material" /> Диагностика
                            </div>
                            <div
                              role="button"
                              className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m gateway-cache-conversations__btn"
                              onClick={() => handleExportMd(conv.id)}
                              style={{ pointerEvents: exportingId === conv.id ? 'none' : 'auto' }}
                            >
                              {exportingId === conv.id ? 'Экспорт…' : 'Экспорт MD'}
                            </div>
                            <div
                              role="button"
                              className="ds-button ds-button--error ds-button--filled ds-button--capsule ds-button--m gateway-cache-conversations__btn"
                              onClick={() => setConfirmDeleteId(conv.id)}
                            >
                              <TrashIcon size={12} />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ---- Actions ---- */}
              {!loading && tab === 'actions' && (
                <div className="gateway-cache-actions">
                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Очистить весь кэш</div>
                    <div className="gateway-cache-actions__desc">
                      Удалит все диалоги и сообщения из локальной БД. В DeepSeek ничего не изменится. Необратимо.
                    </div>
                    <div
                      role="button"
                      className="ds-button ds-button--error ds-button--filled ds-button--capsule ds-button--m"
                      onClick={() => setConfirmClear(true)}
                    >
                      <span className="ds-button__content">Очистить всё</span>
                    </div>
                  </div>

                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Обновить статистику</div>
                    <div className="gateway-cache-actions__desc">
                      Перечитать размер БД, количество диалогов и сообщений.
                    </div>
                    <div
                      role="button"
                      className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m"
                      onClick={async () => {
                        setLoading(true);
                        await Promise.all([refreshStats(), refreshConversations()]);
                        setLoading(false);
                      }}
                    >
                      <span className="ds-button__content">Обновить</span>
                    </div>
                  </div>

                  {/* 5.8.3: cleanup orphaned файлов */}
                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Очистить orphaned файлы</div>
                    <div className="gateway-cache-actions__desc">
                      Удаляет записи о файлах, у которых больше нет соответствующего
                      сообщения в БД (могли остаться после prune или сбоев sync).
                      Сами файлы на диске не трогаются — их удалит GC при следующей
                      проверке.
                    </div>
                    <div
                      role="button"
                      className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m"
                      onClick={async () => {
                        try {
                          const r = await api.gatewayFileCleanupOrphans();
                          if (r.success) {
                            setInfo(`Очищено orphaned файлов: ${r.data}`);
                            await Promise.all([refreshStats(), refreshConversations()]);
                          } else {
                            setError(r.error || 'Ошибка очистки');
                          }
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <span className="ds-button__content">Очистить</span>
                    </div>
                  </div>

                  {/* cleanup ghost записей */}
                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Удалить ghost-записи</div>
                    <div className="gateway-cache-actions__desc">
                      Удаляет «призраков» — неактивные сообщения, у которых нет активной версии.
                      Это очищает БД от мусора после сбоев синхронизации веток.
                    </div>
                    <div
                      role="button"
                      className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m"
                      onClick={async () => {
                        try {
                          const r = await api.gatewayCleanupGhosts();
                          if (r.success) {
                            setInfo(`Удалено ghost-записей: ${r.data?.deleted || 0}`);
                            await Promise.all([refreshStats(), refreshConversations()]);
                          } else {
                            setError(r.error || 'Ошибка очистки');
                          }
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <span className="ds-button__content">Очистить призраков</span>
                    </div>
                  </div>

                  {/* 5.7.24: Сбор веток */}
                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Режим синхронизации</div>
                    <div className="gateway-cache-actions__desc">
                      Snapshot — из локального кэша IndexedDB за ~1с (fallback на traverse).
                      Обычный — visible + gaps. Глубокий — полный traverse веток.
                    </div>
                    <div className="gateway-cache-actions__radio-group">
                      {(
                        [
                          { v: 'snapshot', label: 'Snapshot (быстро)' },
                          { v: 'normal', label: 'Обычный' },
                          { v: 'deep', label: 'Глубокий' },
                        ] as Array<{ v: 'snapshot' | 'normal' | 'deep'; label: string }>
                      ).map(({ v, label }) => (
                        <div
                          key={v}
                          role="button"
                          tabIndex={0}
                          className={`gateway-cache-actions__radio${
                            scrollMode === v ? ' gateway-cache-actions__radio--active' : ''
                          }`}
                          onClick={() => {
                            setScrollMode(v);
                            try { localStorage.setItem('gateway.scrollMode', v); } catch {}
                          }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5.8.3: Скорость скроллинга */}
                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Скорость скроллинга</div>
                    <div className="gateway-cache-actions__desc">
                      Как быстро PW прокручивается при синхронизации.
                      Быстро — риск пропустить длинные сообщения.
                      Медленно — надёжнее, но долго.
                    </div>
                    <div className="gateway-cache-actions__radio-group">
                      {[
                        { v: 'fast', label: 'Быстро' },
                        { v: 'normal', label: 'Средне' },
                        { v: 'slow', label: 'Медленно' },
                      ].map(({ v, label }) => (
                        <div
                          key={v}
                          role="button"
                          tabIndex={0}
                          className={`gateway-cache-actions__radio${
                            scrollSpeed === v ? ' gateway-cache-actions__radio--active' : ''
                          }`}
                          onClick={() => handleScrollSpeedChange(v as any)}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Автозагрузка файлов</div>
                    <div className="gateway-cache-actions__desc">
                      При открытии диалога в фоне загружать указанное число
                      ещё не скачанных файлов. PoW-цикл занимает 20–30с на файл,
                      но не блокирует UI. Уже скачанные файлы пропускаются.
                    </div>
                    <div className="gateway-cache-actions__radio-group">
                      {[0, 3, 5, 10].map((n) => (
                        <div
                          key={n}
                          role="button"
                          tabIndex={0}
                          className={`gateway-cache-actions__radio${
                            autoFetchCount === n
                              ? ' gateway-cache-actions__radio--active'
                              : ''
                          }`}
                          onClick={() => handleAutoFetchChange(n)}
                        >
                          {n === 0
                            ? 'Не загружать'
                            : `${n} файл${n === 3 ? 'а' : 'ов'}`}
                        </div>
                      ))}
                    </div>
                    <div className="gateway-cache-actions__hint">
                      Сейчас:{' '}
                      {autoFetchCount === 0
                        ? 'не загружать'
                        : `${autoFetchCount} файлов при открытии диалога`}
                    </div>
                  </div>

                  {/* ── TTL для версий файлов ── */}
                  <div className="gateway-cache-actions__card">
                    <div className="gateway-cache-actions__title">Срок хранения версий файлов</div>
                    <div className="gateway-cache-actions__desc">
                      Старые версии файлов из архива, которые не отправлялись дольше указанного срока, будут удалены. Последняя (актуальная) версия каждого файла сохраняется навсегда.
                    </div>
                    <div className="gateway-cache-actions__radio-group">
                      {[7, 14, 30, 90].map((n) => (
                        <div
                          key={n}
                          role="button"
                          tabIndex={0}
                          className={`gateway-cache-actions__radio${ttlDays === n ? ' gateway-cache-actions__radio--active' : ''}`}
                          onClick={() => {
                            setTtlDays(n);
                            try { localStorage.setItem('gateway.fileTTLDays', String(n)); } catch {}
                          }}
                        >
                          {n} дней
                        </div>
                      ))}
                    </div>
                    <div className="gateway-cache-actions__hint" style={{ marginTop: 12 }}>
                      <div
                        role="button"
                        className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m"
                        onClick={async () => {
                          try {
                            const r = await api.gatewayResourcesGc(ttlDays);
                            if (r.success) {
                              setInfo(`Очистка завершена. Удалено версий: ${r.data.deletedVersions}, источников: ${r.data.deletedSources}`);
                              await Promise.all([refreshStats(), refreshConversations()]);
                            } else {
                              setError(r.error || 'Ошибка очистки');
                            }
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <span className="ds-button__content">Очистить сейчас</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm: очистить всё */}
      <GatewayConfirmModal
        visible={confirmClear}
        title="Очистить весь кэш?"
        message="Все диалоги и сообщения будут удалены из локальной БД. В DeepSeek они останутся."
        confirmLabel="Очистить"
        cancelLabel="Отмена"
        danger
        loading={clearing}
        onConfirm={handleClearAll}
        onCancel={() => !clearing && setConfirmClear(false)}
      />

      {/* Confirm: удалить один диалог из БД */}
      <GatewayConfirmModal
        visible={!!confirmDeleteId}
        title="Удалить из кэша?"
        message="Диалог останется в DeepSeek, но локальная копия будет удалена."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        onConfirm={() => confirmDeleteId && handleDeleteFromCache(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <GatewayDiagnosticModal
        visible={diagOpen}
        loading={diagLoading}
        report={diagReport}
        error={diagError}
        onClose={() => setDiagOpen(false)}
      />
    </>
  );
};

export default GatewayCacheManager;