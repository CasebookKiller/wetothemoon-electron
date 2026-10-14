// src/main/services/pranaBindu/mentat/graph/seeds/thenicsEquivalencesSeed.ts
//
// Статический seed эквивалентностей Thenics ↔ наши каталоги.
// DB-overrides (таблица `equivalences`, Melange v21) подмешиваются
// при сборке графа — здесь только проверенные вручную записи.

import type { CatalogId, DifficultyBand } from '../ontology';

export interface ThenicsEquivalenceSeed {
  source: { catalog: 'thenics'; key: string; band: DifficultyBand };
  target: {
    catalog: Exclude<CatalogId, 'thenics'>;
    key: string;
    level?: number;
    band?: DifficultyBand;
  };
  confidence: 'manual' | 'auto' | 'suggested';
  note?: string;
}

export const THENICS_EQUIVALENCES_SEED: ThenicsEquivalenceSeed[] = [
  {
    source: { catalog: 'thenics', key: 'push-up', band: 1 },
    target: { catalog: 'wade', key: 'pushup', level: 5 },
    confidence: 'manual',
    note:
      'Thenics Beginner Push Up = Wade level 5 (Full Push-ups). ' +
      'Калибровочный сдвиг: их Beginner — наша середина.',
  },
];