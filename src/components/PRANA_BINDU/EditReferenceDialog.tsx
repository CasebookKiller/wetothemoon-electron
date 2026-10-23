// src/components/PRANA_BINDU/EditReferenceDialog.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';

interface RefItem {
  id: number;
  name: string;
  category: string | null;
  tags: string[];
}

interface Props {
  visible: boolean;
  refItem: RefItem | null;
  referenceTracks: Array<{ category: string | null }>;
  onHide: () => void;
  onSaved: () => void;
}

export const EditReferenceDialog: React.FC<Props> = ({
  visible,
  refItem,
  referenceTracks,
  onHide,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && refItem) {
      setName(refItem.name);
      setCategory(refItem.category);
      setTags(refItem.tags.join(', '));
      setStatus('idle');
      setError('');
    }
  }, [visible, refItem]);

  const refCategoryOptions = useMemo(() => {
    const base = ['loop', 'stairs', 'connector', 'segment', 'landmark'];
    const existing = new Set(
      referenceTracks
        .map((r) => r.category)
        .filter((c): c is string => c != null && c !== ''),
    );
    return Array.from(new Set([...base, ...Array.from(existing)]));
  }, [referenceTracks]);

  const handleSave = async () => {
    if (!refItem || !name.trim()) return;
    setStatus('saving');
    setError('');
    try {
      const api = (window as any).electronAPI;
      const tagsArr = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const res = await api.pb.referenceTrackUpdate(refItem.id, {
        name: name.trim(),
        category: category?.trim() || null,
        tags: tagsArr,
      });
      if (res?.success) {
        setStatus('saved');
        setTimeout(() => {
          onSaved();
          onHide();
        }, 700);
      } else {
        setError(res?.error || 'Не удалось сохранить');
        setStatus('error');
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  };

  return (
    <Dialog
      visible={visible}
      onHide={() => {
        if (status !== 'saving') onHide();
      }}
      header="Редактировать эталон"
      style={{ width: '460px' }}
      modal
      className="pb-templates-dialog pb-settings-dialog"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Имя
          </label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
            placeholder="Верхний круг по пруду"
            disabled={status === 'saving' || status === 'saved'}
          />
        </div>

        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Категория
          </label>
          <InputText
            value={category ?? ''}
            onChange={(e) =>
              setCategory(e.target.value === '' ? null : e.target.value)
            }
            className="w-full"
            placeholder="loop / stairs / … или своя"
            disabled={status === 'saving' || status === 'saved'}
          />
          {refCategoryOptions.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.25rem',
                flexWrap: 'wrap',
                marginTop: '0.4rem',
              }}
            >
              {refCategoryOptions.map((c) => {
                const isActive = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`pb-catalog__chip ${isActive ? 'is-on' : ''}`}
                    onClick={() => setCategory(isActive ? null : c)}
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.45rem',
                      cursor: 'pointer',
                    }}
                    disabled={status === 'saving' || status === 'saved'}
                    title={
                      isActive
                        ? `Снять категорию «${c}»`
                        : `Установить категорию «${c}»`
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
          <small className="pb-hint" style={{ fontSize: '0.72rem', marginTop: '0.3rem', display: 'block' }}>
            Клик по чипу — быстрое назначение. Введи своё — запомнится в списке.
          </small>
        </div>

        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Теги (через запятую)
          </label>
          <InputText
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full"
            placeholder="pond, north, upper"
            disabled={status === 'saving' || status === 'saved'}
          />
          <small className="pb-hint" style={{ fontSize: '0.72rem' }}>
            Для фильтрации: «pond, north» — все эталоны у пруда на севере.
          </small>
        </div>

        {status === 'saved' && (
          <div style={{ color: 'var(--tg-success)', fontSize: '0.85rem' }}>
            <i className="pi pi-check-circle" /> Сохранено
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--tg-destructive)', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
        <Button
          label="Отмена"
          className="pb-soft p-button-sm"
          onClick={onHide}
          disabled={status === 'saving' || status === 'saved'}
        />
        <Button
          label={status === 'saving' ? 'Сохранение…' : 'Сохранить'}
          icon={status === 'saving' ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
          className="pb p-button-sm"
          onClick={handleSave}
          disabled={!name.trim() || status === 'saving' || status === 'saved'}
          loading={status === 'saving'}
        />
      </div>
    </Dialog>
  );
};