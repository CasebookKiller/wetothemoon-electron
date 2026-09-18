// src/components/SIETCH/FullTextSearchDialog.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';

import type { DialogType } from './Breadcrumb';

interface SearchHit {
  kind: 'entity' | 'relation' | 'observation' | 'source';
  id: number;
  title: string;
  subtitle: string;
  matched_field: string;
  matched_value: string;
}

interface SearchAllResult {
  items: SearchHit[];
  total: number;
  counts: Record<string, number>;
}

export interface FullTextSearchDialogProps {
  visible: boolean;
  onHide: () => void;
  onOpenHit: (type: DialogType, id: number) => void;
}

const SCOPE_OPTIONS = [
  { label: 'Все таблицы', value: 'all' },
  { label: 'Только сущности', value: 'entity' },
  { label: 'Только связи', value: 'relation' },
  { label: 'Только наблюдения', value: 'observation' },
  { label: 'Только источники', value: 'source' },
];

const KIND_ICONS: Record<SearchHit['kind'], string> = {
  entity: 'pi pi-users',
  relation: 'pi pi-share-alt',
  observation: 'pi pi-eye',
  source: 'pi pi-link',
};

function truncate(s: string, max = 80): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export const FullTextSearchDialog: React.FC<FullTextSearchDialogProps> = ({
  visible,
  onHide,
  onOpenHit,
}) => {
  const api = (window as any).electronAPI;

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SearchAllResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setScope('all');
    setError('');
    setResult(null);
    setLoading(false);
    // фокус на input — после открытия диалога
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [visible]);

  const run = async () => {
    const q = query.trim();
    if (!q) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const kinds = scope === 'all' ? undefined : [scope];
      const res = await api.searchAll(q, kinds, 200, 0);
      if (res?.success) {
        setResult({ items: res.items || [], total: res.total || 0, counts: res.counts || {} });
      } else {
        setError(res?.error || 'Ошибка поиска');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') run();
  };

  return (
    <Dialog
      visible={visible}
      style={{ width: '900px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={
        <span className="p-panel-title">
          <i className="pi pi-search-plus mr-2" />
          Полнотекстовый поиск
        </span>
      }
      footer={
        <div className="p-panel-footer flex justify-content-end">
          <Button
            label="Закрыть"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
          />
        </div>
      }
    >
      <div>
        {/* Панель фильтров */}
        <div className="flex flex-wrap align-items-center gap-2 mb-3 audit-log-filters">
          <div style={{ minWidth: '160px' }}>
            <Dropdown
              value={scope}
              options={SCOPE_OPTIONS}
              onChange={(e) => setScope(e.value)}
              placeholder="Область поиска"
              className="w-full"
            />
          </div>

          <div style={{ minWidth: '260px', flex: 1 }}>
            <span className="p-input-icon-left w-full search-input-with-icon">
              <i className="pi pi-search" />
              <InputText
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Слово, ИНН, ФИО, predicate, notes…"
                className="w-full"
              />
            </span>
          </div>

          <Button
            label={loading ? 'Поиск...' : 'Найти'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
            className="osint p-button-sm"
            onClick={run}
            disabled={loading || !query.trim()}
          />
        </div>

        {error && <p className="p-error">{error}</p>}

        {result && (
          <>
            <div className="text-sm text-500 mb-2">
              Найдено: <b>{result.total}</b> записей
              {result.total > 0 && (
                <>
                  {' '}
                  (сущности: {result.counts.entity || 0},
                  {' '}связи: {result.counts.relation || 0},
                  {' '}наблюдения: {result.counts.observation || 0},
                  {' '}источники: {result.counts.source || 0})
                </>
              )}
            </div>

            {result.items.length === 0 ? (
              <p className="text-500">Ничего не найдено</p>
            ) : (
              <div
                className="border-round"
                style={{
                  border: '1px solid var(--tg-theme-secondary-bg-color)',
                  maxHeight: '50vh',
                  overflowY: 'auto',
                }}
              >
                {result.items.map((hit) => (
                  <div
                    key={`${hit.kind}-${hit.id}`}
                    className="flex align-items-center gap-2 p-2 cursor-pointer"
                    style={{ borderBottom: '1px solid var(--tg-theme-secondary-bg-color)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tg-theme-secondary-bg-color)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      onOpenHit(hit.kind, hit.id);
                      onHide();
                    }}
                    title="Открыть подробности"
                  >
                    <i className={KIND_ICONS[hit.kind]} style={{ width: '1.2rem' }} />
                    <span className="text-xs text-500" style={{ minWidth: '3rem' }}>
                      #{hit.id}
                    </span>
                    <span className="font-medium">{truncate(hit.title, 70)}</span>
                    <span className="text-xs text-500 ml-auto" style={{ textAlign: 'right' }}>
                      <i className="pi pi-tag mr-1" />
                      {hit.matched_field}: {truncate(hit.matched_value, 60)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!result && !loading && (
          <p className="text-500 text-sm">
            Введите запрос и нажмите Enter или «Найти». Поиск идёт по:
            value/label/notes сущностей, predicate/evidence_text/notes связей,
            attribute/value/notes наблюдений, url/title/provider/notes источников.
          </p>
        )}
      </div>
    </Dialog>
  );
};