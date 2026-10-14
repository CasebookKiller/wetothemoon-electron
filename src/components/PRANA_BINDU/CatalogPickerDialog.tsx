import React, { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { AppDialog } from '@/components/COMMON/AppDialog/AppDialog';
import { AppDialogFooter } from '@/components/COMMON/AppDialog/AppDialogFooter';
import {
  PROGRESSIONS_CATALOG,
  NAMED_EXERCISES,
} from '@/main/services/pranaBindu/mentat/exerciseCatalog';

export interface PickedExercise {
  movementKey: string;
  level?: number;
  label: string;
  isTimeBased: boolean;
}

interface Props {
  visible: boolean;
  onHide: () => void;
  onPick: (items: PickedExercise[]) => void;
}

interface Item {
  key: string;
  label: string;
  level?: number;
  isTimeBased: boolean;
  group: string;
}

export const CatalogPickerDialog: React.FC<Props> = ({
  visible,
  onHide,
  onPick,
}) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];

    // Каноны Wade + Cali + Runner и их уровни
    for (const entry of PROGRESSIONS_CATALOG) {
      for (const lvl of entry.levels) {
        out.push({
          key: `${entry.key}:${lvl.level}`,
          label: `${entry.label} · ${lvl.nameRu ?? lvl.name} W${lvl.level}`,
          level: lvl.level,
          isTimeBased: (lvl.benchmarkLadder?.[0] ?? '').endsWith('s'),
          group: entry.label,
        });
      }
    }

    // Named
    for (const n of NAMED_EXERCISES) {
      out.push({
        key: `named:${n.key}`,
        label: `${n.label}${n.nameRu ? ` · ${n.nameRu}` : ''}`,
        isTimeBased: (n.defaultDuration ?? '').endsWith('s'),
        group: 'Named',
      });
    }

    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 200);
    return items
      .filter((it) => it.label.toLowerCase().includes(q))
      .slice(0, 200);
  }, [items, search]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = () => {
    const picked: PickedExercise[] = [];
    for (const key of selected) {
      const it = items.find((x) => x.key === key);
      if (!it) continue;
      if (key.startsWith('named:')) {
        picked.push({
          movementKey: key.slice(6),
          label: it.label,
          isTimeBased: it.isTimeBased,
        });
      } else {
        const [progKey, lvlStr] = key.split(':');
        picked.push({
          movementKey: progKey,
          level: Number(lvlStr),
          label: it.label,
          isTimeBased: it.isTimeBased,
        });
      }
    }
    onPick(picked);
    setSelected(new Set());
    setSearch('');
    onHide();
  };

  return (
    <AppDialog
      visible={visible}
      onHide={onHide}
      title="Выбрать из каталога"
      titleIcon="pi-book"
      className="pb-create-dialog"
      style={{ width: '560px' }}
      modal
      dismissableMask
      closeOnEscape
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск..."
        className="pb-edge-form__select"
      />
      <div className="pb-catalog-picker__list">
        {filtered.length === 0 && (
          <div className="pb-hint">Ничего не найдено</div>
        )}
        {filtered.map((it) => (
          <label key={it.key} className="pb-catalog-picker__row">
            <input
              type="checkbox"
              checked={selected.has(it.key)}
              onChange={() => toggle(it.key)}
            />
            <span>{it.label}</span>
          </label>
        ))}
      </div>
      <AppDialogFooter>
        <Button
          label="Отмена"
          className="pb-soft p-button-sm"
          onClick={onHide}
        />
        <Button
          label={`Добавить (${selected.size})`}
          icon="pi pi-plus"
          className="pb p-button-sm"
          disabled={selected.size === 0}
          onClick={handleAdd}
        />
      </AppDialogFooter>
    </AppDialog>
  );
};