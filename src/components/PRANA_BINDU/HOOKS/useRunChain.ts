// src/components/PRANA_BINDU/HOOKS/useRunChain.ts
//
// Авто-вывод цепочки для одной пробежки.
// Загружает эталоны и latlng пробежки, прогоняет computeDeviationFast
// для каждого атома, сортирует used-атомы по длине (primary = самый длинный).
//
// Не создаёт никаких сущностей в БД, работает только в рендерере.
// Используется в RunFactView и RunStreamsDrawer.

import { useEffect, useState } from 'react';
import {
  buildRefIndex,
  computeDeviationFast,
  classifyCoverage,
  type CoverageClass,
} from '../UTILS/coverageIndex';
import { getSavedCoverageThresholds } from '../UTILS/coverageThresholds';

export interface ChainAtom {
  refId: number;
  name: string;
  lengthM: number;
  kind: 'loop' | 'linear' | 'stadium' | null;
  category: string | null;
  coveragePct: number;
  repeats: number;
  cls: CoverageClass;
  score: number;
}

export interface UseRunChainResult {
  loading: boolean;
  chain: ChainAtom[];
  primary: ChainAtom | null;
  alsoUsed: ChainAtom[];
  error: string | null;
}

const EMPTY: UseRunChainResult = {
  loading: false,
  chain: [],
  primary: null,
  alsoUsed: [],
  error: null,
};

export function useRunChain(runFactId: number | null): UseRunChainResult {
  const [state, setState] = useState<UseRunChainResult>(EMPTY);

  useEffect(() => {
    if (!runFactId) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const api = (window as any).electronAPI;
        if (!api?.pb?.runLatlngBatch || !api?.pb?.referenceTrackList) {
          throw new Error('API не доступен');
        }

        const [refsRes, latlngRes] = await Promise.all([
          api.pb.referenceTrackList(),
          api.pb.runLatlngBatch([runFactId], { samples: 1000 }),
        ]);

        if (cancelled) return;

        const refs: Array<{
          id: number;
          name: string;
          coords: [number, number][];
          lengthM: number;
          kind: 'loop' | 'linear' | 'stadium' | null;
          category: string | null;
        }> = refsRes?.success ? refsRes.items ?? [] : [];

        const runData = latlngRes?.success
          ? latlngRes.data?.[runFactId]
          : null;

        if (!runData || !runData.latlng || runData.latlng.length < 10) {
          setState(EMPTY);
          return;
        }

        const thresholds = getSavedCoverageThresholds();
        const chain: ChainAtom[] = [];

        for (const ref of refs) {
          if (!ref.coords || ref.coords.length < 2) continue;
          const idx = buildRefIndex(ref.coords);
          const dev = computeDeviationFast(
            runData.latlng,
            idx,
            thresholds.coverageRadiusM,
            thresholds.onRefRadiusM,
            thresholds.checkpointCount ?? 6,
          );
          if (!dev) continue;

          const clsRes = classifyCoverage(
            {
              coveragePct: dev.coveragePct,
              medianM: dev.medianM,
              metersOnRef: dev.metersOnRef,
              atomLenM: ref.lengthM,
              atomKind: ref.kind,
              repeats: dev.repeats,
            },
            thresholds,
          );
          if (clsRes.cls === 'unused') continue;

          chain.push({
            refId: ref.id,
            name: ref.name,
            lengthM: ref.lengthM,
            kind: ref.kind,
            category: ref.category,
            coveragePct: dev.coveragePct,
            repeats: clsRes.repeats,
            cls: clsRes.cls,
            score: clsRes.score,
          });
        }

        // Сортировка: used первыми, затем по длине убывающей.
        chain.sort((a, b) => {
          if (a.cls === 'used' && b.cls !== 'used') return -1;
          if (a.cls !== 'used' && b.cls === 'used') return 1;
          return b.lengthM - a.lengthM;
        });

        const primary = chain.find((c) => c.cls === 'used') ?? null;
        const alsoUsed = primary
          ? chain.filter((c) => c.cls === 'used' && c.refId !== primary.refId)
          : [];

        setState({ loading: false, chain, primary, alsoUsed, error: null });
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            chain: [],
            primary: null,
            alsoUsed: [],
            error: (e as Error).message,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runFactId]);

  return state;
}