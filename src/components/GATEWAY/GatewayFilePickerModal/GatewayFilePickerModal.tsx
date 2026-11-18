// src/components/GATEWAY/GatewayFilePickerModal/GatewayFilePickerModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { IconClose, IconFile } from '../GatewayIcons/GatewayIcons';
import { AppIcon } from '@/components/COMMON/AppIcon/AppIcon';

export interface GatewayAttachedFile {
  kind: 'archive' | 'disk';
  resourceKey?: string;   // для archive
  path?: string;          // для disk (не используется после Patч 1, но оставляем)
  name: string;
  mime: string;
  size: number;
}

interface ResourceItem {
  resourceKey: string;
  resourceKind: string;
  displayName: string;
  latestSha256?: string;
  latestSizeBytes?: number;
  lastSentAt?: number;
  lastAccessedAt: number;
  memoryState: 'archive' | 'memory' | 'ignored';
  sendCount: number;
  totalVersionsSizeBytes: number;
  versionsCount: number;
  existsOnDisk?: boolean;
  metadata: { path?: string; mime?: string; size?: number };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (files: GatewayAttachedFile[]) => void;
}

const formatSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatAgo = (ts?: number): string => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  if (d < 7) return `${d} дн. назад`;
  if (d < 30) return `${Math.floor(d / 7)} нед. назад`;
  return `${Math.floor(d / 30)} мес. назад`;
};

export const GatewayFilePickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [files, setFiles] = useState<ResourceItem[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await (window as any).electronAPI.gatewayResourcesList({
        kind: 'file',
        limit: 500,
      });
      if (res?.success && Array.isArray(res.data)) {
        setFiles(res.data);
      } else {
        setFiles([]);
        if (res?.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void reload();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelected(new Set());
      setSearch('');
      setError(null);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f =>
      f.displayName.toLowerCase().includes(q) ||
      (f.metadata.path || '').toLowerCase().includes(q)
    );
  }, [files, search]);

  const toggleSelect = (resourceKey: string) => {
    const next = new Set(selected);
    next.has(resourceKey) ? next.delete(resourceKey) : next.add(resourceKey);
    setSelected(next);
  };

  const handlePickFromDisk = async () => {
    setPicking(true);
    setError(null);
    try {
      const res: any = await (window as any).electronAPI.gatewayResourcesPickFromDisk();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        const keys = res.data.map((d: any) => d.resourceKey);
        // Перечитать список — новые ресурсы уже в БД
        await reload();
        // Автовыделение новых
        setSelected(prev => {
          const next = new Set(prev);
          keys.forEach((k: string) => next.add(k));
          return next;
        });
      } else if (res?.error) {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setPicking(false);
    }
  };

  const toggleMemory = async (resourceKey: string, current: 'archive' | 'memory' | 'ignored') => {
    const next = current === 'memory' ? 'archive' : 'memory';
    try {
      const res: any = await (window as any).electronAPI.gatewayResourcesToggleMemory(resourceKey, next);
      if (res?.success) {
        setFiles(prev => prev.map(f =>
          f.resourceKey === resourceKey ? { ...f, memoryState: next } : f
        ));
      }
    } catch (e) {
      console.warn('toggle-memory failed:', e);
    }
  };

  const handleDelete = async (resourceKey: string) => {
    if (!window.confirm('Удалить файл из архива? Привязки к сообщениям сохранятся.')) return;
    try {
      const res: any = await (window as any).electronAPI.gatewayResourcesDelete(resourceKey);
      if (res?.success) {
        setFiles(prev => prev.filter(f => f.resourceKey !== resourceKey));
        setSelected(prev => {
          const next = new Set(prev);
          next.delete(resourceKey);
          return next;
        });
      } else if (res?.error) {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const handleConfirm = () => {
    const picked = files.filter(f => selected.has(f.resourceKey));
    const mapped: GatewayAttachedFile[] = picked.map(f => ({
      kind: 'archive',
      resourceKey: f.resourceKey,
      name: f.displayName,
      mime: f.metadata.mime || 'application/octet-stream',
      size: f.latestSizeBytes || 0,
    }));
    onSelect(mapped);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 680,
          maxHeight: '85vh',
          background: '#1a1a1a',
          borderRadius: 12,
          border: '1px solid #333',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#e0e0e0',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
            Выбор файлов из архива
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
            }}
            title="Закрыть"
          >
            <IconClose />
          </button>
        </div>

        {/* Search + Load from disk */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Поиск по имени или пути..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #444',
              background: '#1e1e1e',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handlePickFromDisk}
            disabled={picking}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #4d6bfe',
              background: 'rgba(77, 107, 254, 0.15)',
              color: '#a5b4fc',
              fontSize: 13,
              fontWeight: 500,
              cursor: picking ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: picking ? 0.5 : 1,
            }}
            title="Выбрать файл(ы) с диска"
          >
            {picking ? (
              '...'
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AppIcon name="folder_open" set="material" size="md" />
                С диска
              </span>
            )}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            margin: '0 20px 8px',
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(220, 60, 60, 0.15)',
            border: '1px solid #a04040',
            color: '#ffb0b0',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Загрузка...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
              {files.length === 0
                ? 'В архиве пока нет файлов. Нажмите «С диска» или отправьте файл в DeepSeek через GW.'
                : 'Ничего не найдено'}
            </div>
          )}
          {!loading && filtered.map(f => {
            const isSel = selected.has(f.resourceKey);
            const isMemory = f.memoryState === 'memory';
            const isMissing = f.existsOnDisk === false;
            return (
              <div
                key={f.resourceKey}
                onClick={() => toggleSelect(f.resourceKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: 8,
                  background: isSel ? 'rgba(77, 107, 254, 0.15)' : '#252525',
                  border: `1px solid ${isSel ? '#4d6bfe' : '#333'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  readOnly
                  style={{ width: 16, height: 16, accentColor: '#4d6bfe', cursor: 'pointer' }}
                />
                <IconFile style={{ width: 24, height: 24, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 500,
                    color: isMissing ? '#ff9090' : '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: 14,
                  }}>
                    {f.displayName}
                    {isMissing && ' ⚠ файл не найден'}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {f.metadata.path && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280, whiteSpace: 'nowrap' }}>
                        {f.metadata.path}
                      </span>
                    )}
                    <span>v{f.sendCount}</span>
                    {f.lastSentAt && <span>{formatAgo(f.lastSentAt)}</span>}
                    <span>{formatSize(f.latestSizeBytes || 0)}</span>
                    {f.versionsCount > 1 && (
                      <span style={{ color: '#a5b4fc' }}>
                        всего версий: {formatSize(f.totalVersionsSizeBytes)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMemory(f.resourceKey, f.memoryState); }}
                  title={isMemory ? 'Убрать из долговременной памяти' : 'Добавить в долговременную память'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <AppIcon
                    name="psychology"
                    set="material"
                    size="lg"
                    color={isMemory ? 'success' : 'muted'}
                    filled={isMemory}
                  />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(f.resourceKey); }}
                  title="Удалить из архива"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <AppIcon name="delete" set="material" size="lg" color="muted" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#181818',
        }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            TTL версий: 7 дней (настройка в CacheManager — скоро)
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: '1px solid #444',
                background: 'transparent',
                color: '#ccc',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: selected.size === 0 ? '#2a3a7a' : '#4d6bfe',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              Прикрепить ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};