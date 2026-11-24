// src/main/services/gateway/cache/types.ts

// ---------- Доменные типы (используются в UI и сервисе) ----------

export type MessageRole = 'user' | 'assistant';

export type FileKind = 'text' | 'image' | 'binary';

export interface MessageBlock {
  type: 'text' | 'code' | 'file';
  content: string;       // text/code: содержимое; file: имя файла
  language?: string;     // для type='code'
  size?: string;         // для type='file': "10.5KB"
  mime?: string;         // для type='file': "TXT" / "PNG"
  fileKind?: FileKind;   // для type='file': производное от mime
  thumbUrl?: string;     // для fileKind='image': превью из DOM
  fileId?: string;       // заполним в 5.4b
  branchTotal?: number;
  branchIndex?: number;
}

export interface WebSource {
  url: string;
  title: string;
  snippet?: string;
  siteIcon?: string;
  siteName?: string;
}

export interface CachedMessage {
  id: string;
  conversationId: string;
  sequence: number;
  role: MessageRole;
  contentPlain: string;
  contentHtml?: string;
  thinking?: string;
  sources?: WebSource[];
  blocks: MessageBlock[];
  savedAt: number;
  // NEW (v2):
  messageHash?: string;
  pwKey?: string;
  // NEW (v4): branching
  branchTotal?: number;
  branchIndex?: number;
  // NEW (v5): ветка активна (1) или сохранена для истории (0)
  isActive?: number;
}

export interface CachedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  messageCount: number;
  pinned: boolean;
  archived: boolean;
  // NEW (v2):
  lastSyncedAt?: number;
  pendingEdits?: number;
}

// ---------- Промежуточные типы для входящих сообщений ----------

/**
 * Сообщение, которое приходит из Playwright (до сохранения в БД).
 * ID будет вычислен сервисом.
 */
export interface IncomingMessage {
  id?: string;         // опциональный ID из DOM (data-virtual-list-item-key)
  role: MessageRole;
  contentPlain: string;
  contentHtml?: string;
  thinking?: string;
  // NEW (v7): источники из Web Search
  sources?: WebSource[];
  blocks?: MessageBlock[];
  // NEW (v4): branching
  branchTotal?: number;
  branchIndex?: number;
  // NEW (v5): ветка активна (1) или сохранена для истории (0).
  // Если не указано — 1 (по умолчанию).
  isActive?: number;
}

// ---------- Типы для UI (списки, поиск) ----------

export interface ConversationListItem {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
  lastMessageAt?: number;
  pinned: boolean;
  /** Порядок в сайдбаре GigaChat (0..N). NULL для legacy/новых записей. */
  position?: number | null;
}

export interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: MessageRole;
  snippet: string; // фрагмент из FTS5
  savedAt: number;
}

export interface CacheStats {
  dbPath: string;
  dbSizeBytes: number;
  conversationCount: number;
  messageCount: number;
  lastUpdated?: number;
}

// ---------- Ошибки сервиса ----------

export class GatewayCacheError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'GatewayCacheError';
  }
}


// ---------- Файлы (message_files + file_blobs) ----------

export type FetchStatus = 'pending' | 'ok' | 'failed';

export interface SaveFileInput {
  conversationId: string;
  messageHash: string;
  chipIndex: number;
  name: string;
  mime?: string;          // "TXT" / "PNG"
  sizeDisplay?: string;   // "10.5KB"
  fileKind: FileKind;
  fileId: string;         // UUID из URL DeepSeek
  content: string;        // для text — plain, для binary — base64 (пока не реализовано)
  originUrl?: string;
}

export interface SaveFileResult {
  blobSha256: string;
  contentSaved: 'db' | 'disk';
  wasExisting: boolean;
}

export interface CachedFileContent {
  fileId: string;
  name: string;
  mime?: string;
  sizeDisplay?: string;
  fileKind: FileKind;
  content: string;        // для text — plain, для binary — base64
  fromCache: true;
  fetchedAt?: number;
}

export type FileStatus = 'ok' | 'failed';