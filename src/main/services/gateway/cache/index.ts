// src/main/services/gateway/cache/index.ts
export {
  openGatewayCache,
  closeGatewayCache,
  getGatewayCache,
  isGatewayCacheOpen,
} from './db';
export { GatewayCacheService } from './GatewayCacheService';
export * from './types';
export { SCHEMA_VERSION, CREATE_SCHEMA_SQL, CREATE_FTS_SQL } from './schema';
export { computeMessageHash } from './hash';
export { GatewayFileService } from './GatewayFileService';
export {
  FileBatchService,
  type BatchState,
  type BatchStatus,
  type BatchStartedPayload,
  type BatchProgressPayload,
  type BatchCompletePayload,
} from './FileBatchService';
export { getGatewayFilesDir } from './db';
export { CREATE_FILES_SQL } from './schema';
export {
  ResourceService,
  type ResourceKind,
  type MemoryState,
  type ResourceListItem,
  type SaveDiskFileResult,
} from './ResourceService';
