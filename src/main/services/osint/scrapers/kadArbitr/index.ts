// src/main/services/osint/scrapers/kadArbitr/index.ts

// Реэкспорт публичного API модуля kad.arbitr.
// Старая заглушка ./kadArbitr.ts удалена, весь код теперь здесь.

export { ensureKadSession, isKadAuthorized, clearKadSession } from './login';
export { scrapeJudgesDirectory, getJudgesDirectoryStats } from './judges';
export { searchCases } from './search';

export type {
  JudgesDirectoryOptions,
  JudgesProgressInfo,
  JudgeSuggestion,
  JudgeSuggestResponse,
  KadArbitrCase,
  KadArbitrData,
  KadArbitrCaseType,
  KadArbitrCounterparty,
  KadArbitrSearchOptions,
  KadArbitrSearchPayload,
} from './types';