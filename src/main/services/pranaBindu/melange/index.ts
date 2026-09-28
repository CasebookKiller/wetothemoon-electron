export * from './types';
export { openMelange, getMelange, closeMelange } from './db';
export { applyMigrations, SCHEMA_VERSION } from './migrations';
export { seed } from './seed';

// Репозитории — экспортируем явно, не через repositories/index.ts
export * from './repositories/profileRepo';
export * from './repositories/syncRepo';

export {
  upsertRunFact,
  getRunFactByExternalId,
  listRunFacts,
  countRunFacts,
} from './repositories/runFactsRepo';
export type { RunFactRow, UpsertResult } from './repositories/runFactsRepo';

export {
  upsertRunStreams,
  getRunStreamMeta,
  getRunStreamWithPayload,
  listRunStreams,
  hasRunStreams,
  deleteRunStreams,
} from './repositories/runStreamsRepo';
export type { RunStreamRow, RunStreamWithPayload } from './repositories/runStreamsRepo';