// src/components/PRANA_BINDU/HOOKS/useEquivalencesMap.ts
//
// Загружает все записи из таблицы equivalences один раз
// и предоставляет быстрый lookup по (target, targetKey, targetLevel).
//
// Используется в DayDrawer и WadeProgramsPanel для показа
// «≈ Thenics Push Up (Beginner)» рядом с нашим движением.

import { useEffect, useState } from 'react';
import {
  findThenicsByKey,
  type ThenicsEntry,
} from '@/main/services/pranaBindu/mentat/thenicsCatalog';

export interface EquivalenceItem {
  id: number;
  source: string;
  sourceKey: string;
  sourceLevel: string | null;
  target: string;
  targetKey: string;
  targetLevel: string | null;
  confidence: string;
  note: string | null;
}

export interface EquivalenceHint {
  /** Отформатированная строка для показа: «Push Up (Beginner)». */
  label: string;
  /** Полное имя источника (для tooltip'а). */
  fullLabel: string;
  source: string;
  sourceKey: string;
  sourceLevel: string | null;
  entry: ThenicsEntry | null;
}

function buildHint(e: EquivalenceItem): EquivalenceHint {
  // Пока единственный source — Thenics. Для остальных — fallback.
  const entry =
    e.source === 'thenics' ? findThenicsByKey(e.sourceKey) ?? null : null;

  const name = entry?.name ?? e.sourceKey;
  const lvl = e.sourceLevel ? ` (${e.sourceLevel})` : '';
  const label = `${name}${lvl}`;

  return {
    label,
    fullLabel: `${e.source}: ${label}`,
    source: e.source,
    sourceKey: e.sourceKey,
    sourceLevel: e.sourceLevel,
    entry,
  };
}

export function useEquivalencesMap() {
  const [items, setItems] = useState<EquivalenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = (window as any).electronAPI;
        const res = await api?.pb?.listEquivalences?.();
        if (!cancelled && res?.success) {
          setItems(res.items ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Индекс: `${target}:${targetKey}:${targetLevel}` → EquivalenceHint[]
  const index = new Map<string, EquivalenceHint[]>();
  for (const e of items) {
    const k = `${e.target}:${e.targetKey}:${e.targetLevel ?? ''}`;
    const arr = index.get(k) ?? [];
    arr.push(buildHint(e));
    index.set(k, arr);
  }

  /**
   * Найти подсказки для нашего упражнения.
   * @param target — 'wade' | 'cali' | ...
   * @param targetKey — 'pushup' | 'dips' | ...
   * @param targetLevel — 5 (число) или '5'
   */
  const lookupByTarget = (
    target: string,
    targetKey: string,
    targetLevel: number | string | null | undefined
  ): EquivalenceHint[] => {
    if (targetLevel == null) return [];
    const k = `${target}:${targetKey}:${String(targetLevel)}`;
    return index.get(k) ?? [];
  };

  return { items, lookupByTarget, loading };
}