// src/components/PRANA_BINDU/DeleteGeneratedDialog.tsx
//
// Массовое удаление сгенерированных / ручных локальных событий плана.
// События из intervals.icu не показываются — их удаляют по одному
// через DeletePlanEventDialog.
//
// Фильтры:
//   · период
//   · категория программы (Wade / Runner / Cali / Prehab)
//   · источник (сгенерированные / ручные локальные)

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Checkbox } from 'primereact/checkbox';
import { Calendar } from 'primereact/calendar';
import { Message } from 'primereact/message';

type Origin = 'generated' | 'manual-local';
type CategoryFilter = 'wade' | 'runner' | 'cali' | 'prehab';

interface PlanEventForDelete {
  id: number;
  date: string;
  name: string;
  sport: string | null;
  externalId: string;
  origin: 'generated' | 'manual-local' | 'icu' | 'other';
  generatorCategory: string | null;
  generatorProgramKey: string | null;
}

interface Props {
  visible: boolean;
  defaultFrom: Date;
  defaultTo: Date;
  onHide: () => void;
  onAfterDelete: () => void;
}

const CATEGORIES: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'wade', label: 'Wade' },
  { key: 'runner', label: 'Runner' },
  { key: 'cali', label: 'Cali' },
  { key: 'prehab', label: 'Prehab' },
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DeleteGeneratedDialog: React.FC<Props> = ({
  visible,
  defaultFrom,
  defaultTo,
  onHide,
  onAfterDelete,
}) => {
  const api = (window as any).electronAPI;

  const [from, setFrom] = useState<Date>(defaultFrom);
  const [to, setTo] = useState<Date>(defaultTo);
  const [categories, setCategories] = useState<Set<CategoryFilter>>(new Set());
  const [origins, setOrigins] = useState<Set<Origin>>(
    new Set(['generated'])
  );

  const [items, setItems] = useState<PlanEventForDelete[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);

  // Сброс при открытии
  useEffect(() => {
    if (visible) {
      setFrom(defaultFrom);
      setTo(defaultTo);
      setCategories(new Set());
      setOrigins(new Set(['generated']));
      setError('');
      setInfo('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Загрузка списка
  useEffect(() => {
    if (!visible) return;
    setInfo('');
    if (origins.size === 0) {
      setItems([]);
      setChecked(new Set());
      return;
    }
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await api.pb.listPlanEventsForDelete({
          from: toIso(from),
          to: toIso(to),
          categories:
            categories.size > 0 ? Array.from(categories) : undefined,
          origins: Array.from(origins),
        });
        if (!alive) return;
        if (res?.success) {
          const list: PlanEventForDelete[] = res.items ?? [];
          // Сортировка по дате
          list.sort((a, b) => a.date.localeCompare(b.date));
          setItems(list);
          setChecked(new Set(list.map((i) => i.id)));
        } else {
          setError(res?.error ?? 'Не удалось загрузить список');
          setItems([]);
          setChecked(new Set());
        }
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message);
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, from, to, categories, origins, refreshKey]);

  const toggleCategory = (c: CategoryFilter) => {
    setInfo('');
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const handleFromChange = (d: Date) => {
    setInfo('');
    setFrom(d);
  };
  const handleToChange = (d: Date) => {
    setInfo('');
    setTo(d);
  };

  const toggleOrigin = (o: Origin) => {
    setInfo('');
    setOrigins((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });
  };

  const toggle = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkAll = () => {
    setChecked(new Set(items.map((i) => i.id)));
  };
  const uncheckAll = () => setChecked(new Set());

  const toDeleteCount = checked.size;
  const totalCount = items.length;

  const handleDelete = async () => {
    if (toDeleteCount === 0) return;
    setDeleting(true);
    setError('');
    setInfo('');
    try {
      const ids = Array.from(checked);
      const res = await api.pb.planEventsDeleteBulk(ids);
      if (res?.success) {
        setInfo(`Удалено: ${res.deleted}. Список обновлён.`);
        setError('');
        setRefreshKey((k) => k + 1);
        onAfterDelete();
      } else {
        setError(res?.error ?? 'Ошибка удаления');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const summaryText = useMemo(() => {
    if (loading) return 'Загрузка…';
    if (totalCount === 0) return 'Нет событий по заданным фильтрам';
    return `Найдено: ${totalCount} · выбрано: ${toDeleteCount}`;
  }, [loading, totalCount, toDeleteCount]);

  return (
    <Dialog
      visible={visible}
      onHide={deleting ? () => {} : onHide}
      header="Удалить события плана"
      style={{ width: '640px' }}
      modal
      className="pb-debug-dialog pb-mass-delete-dialog"
    >
      <div className="pb-debug__body">
        <div className="pb-mass-delete-dialog__hint pb-hint">
          События из intervals.icu через этот диалог не удаляются — их
          открывайте по одному. Здесь — только локальные: сгенерированные
          программами или созданные вручную.
        </div>

        {/* Период */}
        <div className="pb-mass-delete-dialog__row">
          <span className="pb-mass-delete-dialog__label">Период:</span>
          <Calendar
            value={from}
            onChange={(e) => handleFromChange(e.value as Date)}
            dateFormat="dd.mm.yy"
            showIcon
            className="pb-cal"
            maxDate={to}
          />
          <span className="pb-hint">—</span>
          <Calendar
            value={to}
            onChange={(e) => handleToChange(e.value as Date)}
            dateFormat="dd.mm.yy"
            showIcon
            className="pb-cal"
            minDate={from}
          />
        </div>

        {/* Категории */}
        <div className="pb-mass-delete-dialog__row">
          <span className="pb-mass-delete-dialog__label">Категория:</span>
          <div className="pb-mass-delete-dialog__chips">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`pb-catalog__chip ${
                  categories.has(c.key) ? 'is-on' : ''
                }`}
                onClick={() => toggleCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
            {categories.size > 0 && (
              <button
                type="button"
                className="pb-catalog__chip"
                onClick={() => setCategories(new Set())}
                title="Сбросить фильтр категории (все)"
              >
                × все
              </button>
            )}
          </div>
        </div>

        {/* Источники */}
        <div className="pb-mass-delete-dialog__row">
          <span className="pb-mass-delete-dialog__label">Источник:</span>
          <div className="pb-mass-delete-dialog__chips">
            <label className="pb-mass-delete-dialog__check">
              <Checkbox
                checked={origins.has('generated')}
                onChange={() => toggleOrigin('generated')}
                disabled={deleting}
              />
              <span>Сгенерированные</span>
            </label>
            <label className="pb-mass-delete-dialog__check">
              <Checkbox
                checked={origins.has('manual-local')}
                onChange={() => toggleOrigin('manual-local')}
                disabled={deleting}
              />
              <span>Ручные локальные</span>
            </label>
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="pb-mass-delete-dialog__row pb-mass-delete-dialog__row--compact">
          <span className="pb-mass-delete-dialog__label">{summaryText}</span>
          <div className="pb-mass-delete-dialog__chips">
            <Button
              label="Выбрать все"
              className="pb-soft p-button-sm"
              onClick={checkAll}
              disabled={loading || totalCount === 0 || deleting}
            />
            <Button
              label="Снять все"
              className="pb-soft p-button-sm"
              onClick={uncheckAll}
              disabled={loading || toDeleteCount === 0 || deleting}
            />
          </div>
        </div>

        {/* Список */}
        <div className="pb-mass-delete-dialog__list">
          {loading && <div className="pb-drawer__hint">Загрузка…</div>}
          {!loading && items.length === 0 && (
            <div className="pb-drawer__empty">
              Нет событий по заданным фильтрам
            </div>
          )}
          {!loading &&
            items.map((it) => {
              const isChecked = checked.has(it.id);
              return (
                <label
                  key={it.id}
                  className={`pb-mass-delete-dialog__item ${
                    isChecked ? 'is-checked' : ''
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onChange={() => toggle(it.id)}
                    disabled={deleting}
                  />
                  <span className="pb-mass-delete-dialog__date">
                    {it.date}
                  </span>
                  <span className="pb-mass-delete-dialog__name">
                    {it.name}
                  </span>
                  {it.generatorCategory && (
                    <span className="pb-source-badge pb-source-badge--manual">
                      {it.generatorCategory}
                    </span>
                  )}
                  {it.origin === 'manual-local' && (
                    <span className="pb-source-badge pb-source-badge--fit">
                      вручную
                    </span>
                  )}
                </label>
              );
            })}
        </div>

        {error && (
          <Message severity="error" text={error} className="w-full" />
        )}
        {info && (
          <Message severity="success" text={info} className="w-full" />
        )}

        <div className="flex gap-2 justify-content-end mt-3">
          <Button
            label="Отмена"
            icon="pi pi-times"
            className="pb-soft p-button-sm"
            onClick={onHide}
            disabled={deleting}
          />
          <Button
            label={
              deleting
                ? 'Удаление…'
                : `Удалить ${toDeleteCount > 0 ? toDeleteCount : ''}`
            }
            icon={deleting ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
            className="pb-destructive p-button-sm"
            onClick={handleDelete}
            disabled={deleting || toDeleteCount === 0}
          />
        </div>
      </div>
    </Dialog>
  );
};