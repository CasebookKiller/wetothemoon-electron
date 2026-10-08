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

export {
  upsertRecoveryLog,
  listRecoveryLogs,
  getRecoveryLog,
} from './repositories/recoveryRepo';
export type {
  RecoveryLogRow,
  RecoveryLogInput,
} from './repositories/recoveryRepo';

export {
  getSyncSettings,
  getSyncSettingsInternal,
  updateSyncSettings,
  setLastAutoSync,
  setZeppSecrets,
  getSyncSecretsFlags,
  setDodofoToken,
  getDodofoTokenEncrypted,
  hasDodofoToken,
  setFitArchivePath,
  getFitArchivePath,
  setIntervalsCredentials,
  getIntervalsApiKeyEncrypted,
  getIntervalsAthleteId,
  setZeppArchivePath,
  getZeppArchivePath,
} from './repositories/syncRepo';

export {
  upsertPlanEvent,
  listPlanEvents,
  getPlanEventByExternalId,
  linkPlanEventToActivity,
  deletePlanEventsRange,
  updatePlanEventLocally,
  deletePlanEventLocally,
  createPlanEventLocally,
  setLocalKeep,
  deletePlanEventsByIds,
  findStaleIcuEvents,
  deleteGeneratedEvents
} from './repositories/planEventsRepo';
export type { UpsertPlanEventResult } from './repositories/planEventsRepo';
export {
  createWorkoutSession,
  updateWorkoutSession,
  getWorkoutSession,
  listWorkoutSessions,
  listWorkoutSessionsForPlanEvent,
  deleteWorkoutSession,
} from './repositories/workoutSessionsRepo';
export type {
  CreateWorkoutSessionInput,
  UpdateWorkoutSessionPatch,
} from './repositories/workoutSessionsRepo';
export {
  getExerciseProgress,
  listExerciseProgress,
  setExerciseProgress,
  deleteExerciseProgress,
} from './repositories/exerciseProgressRepo';
export type { ExerciseProgress } from './repositories/exerciseProgressRepo';

export {
  listEquivalences,
  listEquivalencesFor,
  listEquivalencesForTarget,
  setEquivalence,
  deleteEquivalence,
} from './repositories/equivalencesRepo';
export type { Equivalence, EquivalenceInput } from './repositories/equivalencesRepo';

