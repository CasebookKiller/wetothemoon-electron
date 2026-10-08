// src/components/PRANA_BINDU/RunsPanel/types.ts

import type { RunFactLite } from '../RunStreamsDrawer';
import type { RunFilters } from './RunFiltersPanel';
import type { GroupedRunFact } from '../UTILS/groupRunFacts';

export type RunsViewMode = 'flat' | 'grouped';

export interface RunsPanelProps {
  items: GroupedRunFact[];
  loading: boolean;
  error: string;
  /** Сколько групп после фильтров (для заголовка). */
  filteredCount: number;
  /** Сколько групп всего (до фильтров). */
  totalCount: number;
  /** Сколько run_facts до группировки. Для приписки «N записей». */
  rawCount: number;
  // Фильтры — state живёт в родителе, сюда передаётся как пропсы.
  filters: RunFilters;
  onFiltersChange: (f: RunFilters) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  // Клик по строке → открыть drawer.
  onOpenFact: (fact: RunFactLite) => void;
}

export interface RunsTableProps {
  items: GroupedRunFact[];
  loading: boolean;
  onOpenFact: (fact: RunFactLite) => void;
}