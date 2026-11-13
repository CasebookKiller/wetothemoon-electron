// src/types/gateway.d.ts
//
// Типы Gateway Cache + типы IPC-результатов.
// Расширяет window.electronAPI через declaration merging (не переопределяет).

export interface GatewayCacheMessage {
  id: string;
  conversationId: string;
  sequence: number;
  role: 'user' | 'assistant';
  contentPlain: string;
  contentHtml?: string;
  thinking?: string;
  blocks: { type: 'text' | 'code'; content: string; language?: string }[];
  savedAt: number;
  // 5.7: branching
  messageHash?: string;
  pwKey?: string;
  branchTotal?: number;
  branchIndex?: number;
}

export interface GatewayCacheConversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
  lastMessageAt?: number;
  pinned: boolean;
}

export interface GatewayCacheSearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: 'user' | 'assistant';
  snippet: string;
  savedAt: number;
}

export interface GatewayCacheStats {
  dbPath: string;
  dbSizeBytes: number;
  conversationCount: number;
  messageCount: number;
  lastUpdated?: number;
}

export type GatewayIpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface GatewayDeleteResult {
  success: boolean;
  deletedFromOriginal: boolean;
  deletedFromCache: boolean;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: {
      // Gateway: действия с диалогами
      gatewayRenameConversation: (id: string, newTitle: string) => Promise<GatewayIpcResult<void>>;
      gatewayPinConversation: (id: string, pin: boolean) => Promise<GatewayIpcResult<void>>;
      gatewayDeleteConversation: (id: string) => Promise<GatewayDeleteResult>;
      // 5.6: запуск scroll+sync для открытого диалога
      // opts.prune = false — сохранить существующие message_hash
      // (нужно когда DB актуальна, но есть pending файлы)
      gatewayScrollHistory: (
        convId: string,
        opts?: { prune?: boolean }
      ) => Promise<GatewayIpcResult<void>>;
      gatewaySnapshotHistory(
        convId?: string
      ): Promise<{
        success: boolean;
        data?: { source: 'indexeddb' | 'traverse' };
        error?: string;
      }>;
      gatewaySwitchBranch(
        messageKey: string,
        direction: 'prev' | 'next',
        opts?: {
          branchTotal?: number;
          branchIndex?: number;
          role?: 'user' | 'assistant';
        }
      ): Promise<{ success: boolean; error?: string }>;
      gatewayDeactivateByHashes: (
        convId: string,
        hashes: string[]
      ) => Promise<GatewayIpcResult<{ deactivated: number }>>;
      gatewayCancelTraverse(): Promise<{ success: boolean; error?: string }>;
      gatewayGetConversationMessages: (
        convId?: string,
        title?: string,
        opts?: { skipBackgroundScroll?: boolean, prune?: boolean }
      ) => Promise<
        GatewayIpcResult<
          Array<{
            id?: string;
            role: 'user' | 'assistant';
            thinking?: string;
            blocks: Array<{
              type: 'text' | 'code' | 'file';
              content: string;
              language?: string;
              size?: string;
              mime?: string;
              fileKind?: 'text' | 'image' | 'binary';
              thumbUrl?: string;
              fileId?: string;
            }>;
            fullHtml?: string;
          }>
        >
      >;

      // Gateway Cache
      gatewayDebugMessagesAll: (convId: string) => Promise<
        GatewayIpcResult<
          Array<{
            id: string;
            pw_key: string | null;
            sequence: number;
            role: string;
            branch_total: number | null;
            branch_index: number | null;
            is_active: number;
            message_hash: string | null;
            preview: string;
          }>
        >
      >;
      gatewayCacheList: () => Promise<GatewayIpcResult<GatewayCacheConversation[]>>;
      gatewayCacheMessages: (
        convId: string
      ) => Promise<GatewayIpcResult<GatewayCacheMessage[]>>;
      gatewayCacheSearch: (
        query: string,
        limit?: number
      ) => Promise<GatewayIpcResult<GatewayCacheSearchResult[]>>;
      gatewayCacheSave: (
        convId: string,
        title: string,
        messages: any[]
      ) => Promise<
        GatewayIpcResult<{ inserted: number; updated: number; total: number }>
      >;
      gatewayCacheExportMd: (convId: string) => Promise<GatewayIpcResult<string>>;
      gatewayCacheStats: () => Promise<GatewayIpcResult<GatewayCacheStats>>;
      gatewayCacheDelete: (convId: string) => Promise<GatewayIpcResult<void>>;
      gatewayCacheClear: () => Promise<GatewayIpcResult<void>>;
      gatewayReconFileChip: (
        convId?: string,
        chipIndex?: number
      ) => Promise<
        GatewayIpcResult<{
          jsonPath: string;
          htmlPaths: string[];
          summary: any;
        }>
      >;
      gatewayReconBranches: (
        convId?: string
      ) => Promise<
        GatewayIpcResult<{
          jsonPath: string;
          summary: any;
        }>
      >;
      gatewayDiagnoseBranches(
        convId: string,
        convTitle?: string
      ): Promise<{
        success: boolean;
        data?: import('../main/services/gateway/diagnostics').DiagnosticReport;
        error?: string;
      }>;
      gatewayFileFetch: (
        convId: string,
        pwKeyOrNull: string | null,
        chipName: string,
        chipIndex: number
      ) => Promise<
        GatewayIpcResult<{
          name: string;
          content: string;
          fileId: string;
        }>
      >;
      gatewayFileSave: (input: {
        conversationId: string;
        messageHash: string;
        chipIndex: number;
        name: string;
        mime?: string;
        sizeDisplay?: string;
        fileKind: 'text' | 'image' | 'binary';
        fileId: string;
        content: string;
        originUrl?: string;
      }) => Promise<
        GatewayIpcResult<{
          blobSha256: string;
          contentSaved: 'db' | 'disk';
          wasExisting: boolean;
        }>
      >;

      gatewayFileContent: (
        convId: string,
        messageHash: string,
        chipIndex: number
      ) => Promise<
        GatewayIpcResult<{
          fileId: string;
          name: string;
          mime?: string;
          sizeDisplay?: string;
          fileKind: 'text' | 'image' | 'binary';
          content: string;
          fromCache: true;
          fetchedAt?: number;
        } | null>
      >;

      gatewayFileStatsBulk: () => Promise<
        GatewayIpcResult<
          Record<
            string,
            { total: number; loaded: number; pending: number; failed: number }
          >
        >
      >;

      gatewayFileMarkFailed: (
        convId: string,
        messageHash: string,
        chipIndex: number,
        errorMessage: string,
        fileId?: string
      ) => Promise<GatewayIpcResult<void>>;


      gatewayFileCleanupOrphans: () => Promise<GatewayIpcResult<number>>;

      gatewayFileFetchBatch: (
        convId: string,
        count: number
      ) => Promise<
        GatewayIpcResult<{
          started: boolean;
          total: number;
          skipped: number;
        }>
      >;

      gatewayFileFetchCancel: (
        convId: string
      ) => Promise<GatewayIpcResult<{ cancelled: boolean }>>;

      gatewayFileBatchState: (
        convId: string
      ) => Promise<
        GatewayIpcResult<{
          convId: string;
          total: number;
          processed: number;
          ok: number;
          failed: number;
          currentName?: string;
          currentChipIndex?: number;
          status: 'running' | 'completed' | 'cancelled' | 'failed';
          cancelled: boolean;
          startedAt: number;
          finishedAt?: number;
          lastError?: string;
        } | null>
      >;
      
      gatewayDebugDumpPWState: () => Promise<GatewayIpcResult<Array<{
        pwKey: string;
        role: string;
        text: string;
        branch: string;
      }>>>;
      
    };
  }
}

export {};