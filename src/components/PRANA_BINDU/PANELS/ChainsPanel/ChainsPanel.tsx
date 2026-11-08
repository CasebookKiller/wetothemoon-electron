// src/components/PRANA_BINDU/PANELS/ChainsPanel/ChainsPanel.tsx
//
// Левая панель вкладки «Цепочки»: список сохранённых цепочек с кнопками
// «Применить к текущему треку» / «Редактировать» / «Удалить».
// Сама форма создания/редактирования — в ChainEditorDialog (отдельно).

import React from 'react';
import { Button } from 'primereact/button';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';

export interface ChainLite {
  id: number;
  name: string;
  ordered: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  chains: ChainLite[];
  loading: boolean;
  activeChainId: number | null;
  onApply: (chainId: number) => void;
  onEdit: (chainId: number) => void;
  onDelete: (chainId: number) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

export const ChainsPanel: React.FC<Props> = ({
  chains,
  loading,
  activeChainId,
  onApply,
  onEdit,
  onDelete,
  onCreate,
  onRefresh,
}) => {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
      {/* Заголовок + кнопки */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <span className="pb-hint" style={{ fontSize: '0.75rem', flex: 1 }}>
          {chains.length === 0
            ? 'Нет сохранённых цепочек'
            : `Всего: ${chains.length}`}
        </span>
        <Button
          label="Создать"
          icon="pi pi-plus"
          className="pb-soft p-button-sm"
          onClick={onCreate}
        />
        <Button
          icon="pi pi-refresh"
          text
          className="pb-soft p-button-sm"
          style={{ padding: '0.1rem', width: '1.8rem', height: '1.8rem' }}
          onClick={onRefresh}
          disabled={loading}
          tooltip="Обновить"
          tooltipOptions={{ position: 'bottom' }}
        />
      </div>

      {loading && (
        <div className="pb-hint" style={{ textAlign: 'center', padding: '0.5rem' }}>
          <AppIcon name="spinner" spin color="accent" /> Загрузка…
        </div>
      )}

      {!loading && chains.length === 0 && (
        <div
          className="pb-hint"
          style={{
            padding: '0.75rem',
            fontSize: '0.75rem',
            textAlign: 'center',
            border: '1px dashed var(--surface-border)',
            borderRadius: 6,
          }}
        >
          Создайте первую цепочку: кнопка «Создать» → выберите слоты (атомы
          или кластеры) → сохраните. Цепочка — это явная последовательность
          слотов (подход / круг / возврат), см. 18b_ATOM_CHAINS.md.
        </div>
      )}

      {!loading &&
        chains.map((c) => {
          const isActive = activeChainId === c.id;
          return (
            <div
              key={c.id}
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 6,
                marginBottom: '0.3rem',
                background: isActive ? 'rgba(212, 163, 115, 0.25)' : 'transparent',
                border: isActive
                  ? '2px solid var(--pb-accent)'
                  : '1px solid var(--surface-border)',
                boxShadow: isActive ? '0 0 12px rgba(212, 163, 115, 0.4)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <i
                  className="pi pi-sitemap"
                  style={{ color: 'var(--pb-accent)', fontSize: '0.85rem' }}
                />
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={c.name}
                >
                  {c.name}
                </span>
                {c.ordered && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      padding: '0.05rem 0.3rem',
                      borderRadius: 3,
                      background: 'rgba(106, 178, 242, 0.15)',
                      color: '#6ab2f2',
                      flexShrink: 0,
                    }}
                    title="Порядок слотов важен"
                  >
                    order
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginTop: '0.3rem',
                }}
              >
                <Button
                  icon={isActive ? 'pi pi-check' : 'pi pi-play'}
                  text
                  className="pb-drawer__name-edit"
                  style={{ width: '1.8rem', height: '1.8rem', padding: 0 }}
                  onClick={() => onApply(c.id)}
                  tooltip={isActive ? 'Активна' : 'Применить к текущему треку'}
                  tooltipOptions={{ position: 'left' }}
                />
                <Button
                  icon="pi pi-pencil"
                  text
                  className="pb-drawer__name-edit"
                  style={{ width: '1.8rem', height: '1.8rem', padding: 0 }}
                  onClick={() => onEdit(c.id)}
                  tooltip="Редактировать"
                  tooltipOptions={{ position: 'left' }}
                />
                <Button
                  icon="pi pi-trash"
                  text
                  className="pb-drawer__name-edit"
                  style={{ width: '1.8rem', height: '1.8rem', padding: 0 }}
                  onClick={() => onDelete(c.id)}
                  tooltip="Удалить"
                  tooltipOptions={{ position: 'left' }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
};