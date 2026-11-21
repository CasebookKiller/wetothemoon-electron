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

      gatewayResourcesList: (opts?: { query?: string; kind?: string; limit?: number }) =>
        Promise<{ success: boolean; data?: any[]; error?: string }>;
      gatewayResourcesPickFromDisk: () =>
        Promise<{ success: boolean; data?: any[]; error?: string }>;
      gatewayResourcesToggleMemory: (resourceKey: string, state: 'archive' | 'memory' | 'ignored') =>
        Promise<{ success: boolean; error?: string }>;
      gatewayResourcesDelete: (resourceKey: string) =>
        Promise<{ success: boolean; error?: string }>;
      
      gatewayDebugDumpPWState: () => Promise<GatewayIpcResult<Array<{
        pwKey: string;
        role: string;
        text: string;
        branch: string;
      }>>>;
      
      gatewayCleanupGhosts(
        convId?: string
      ): Promise<{ success: boolean; data?: { deleted: number }; error?: string }>;

      gatewaySendMessage: (text: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      gatewaySendMessageWithFiles: (text: string, fileShas: string[]) => Promise<{ success: boolean; data?: any; error?: string }>;
      gatewayResourcesList: (opts?: { query?: string; kind?: string; limit?: number }) =>
        Promise<{ success: boolean; data?: any[]; error?: string }>;
      gatewayResourcesToggleMemory: (resourceKey: string, state: 'archive' | 'memory' | 'ignored') =>
        Promise<{ success: boolean; error?: string }>;
      gatewayResourcesDelete: (resourceKey: string) =>
        Promise<{ success: boolean; error?: string }>;
      gatewayResourcesGc: (ttlDays: number) =>
        Promise<{ success: boolean; data?: any; error?: string }>;

      // ───────── Profiles (multi-account) ─────────
      gatewayApiUsageSummary: (opts?: { sinceMs?: number; profileId?: string }) =>
        Promise<{ success: true; data: { summary: unknown; budget: unknown } } | { success: false; error: string }>;
      gatewaySendMessageApi: (payload: {
        message: string;
        model?: string;
        effort?: 'low' | 'high' | 'max';
        max_tokens?: number;
        useFallback?: boolean;
        continuationMode?: boolean;
        taskTitle?: string;
      }) => Promise<{ success: true; data: unknown } | { success: false; error: string }>;
      gatewayExportContinuation: (payload: { workspaceKeys: string[]; taskTitle?: string }) =>
        Promise<{ success: true; data: { path: string; bytes: number; nodes: string[] } } | { success: false; error: string }>;
      gatewayProfilesList: () =>
        Promise<{
          success: boolean;
          data?: {
            activeId: string;
            profiles: Array<{
              id: string;
              name: string;
              cdpPort: number;
              browserKind?: 'yandex' | 'chrome';
              chromeCdpPort?: number;
              dirName: string;
              createdAt: string;
              lastActiveAt: string | null;
              notes?: string;
              hasSession: boolean;
            }>;
          };
          error?: string;
        }>;
      gatewayProfilesCreate: (opts: { name: string; notes?: string; browserKind?: 'yandex' | 'chrome' }) =>
        Promise<{ success: boolean; data?: any; error?: string }>;
      gatewayProfilesActivate: (id: string, opts?: { launch?: boolean }) =>
        Promise<{ success: boolean; error?: string; data?: { status?: 'logged_in' | 'login_required' } }>;
      gatewayProfilesUpdate: (id: string, patch: { name?: string; notes?: string; browserKind?: 'yandex' | 'chrome' }) =>
        Promise<{ success: boolean; data?: any; error?: string }>;
      gatewayProfilesDelete: (id: string, opts: { deleteFiles?: boolean }) =>
        Promise<{ success: boolean; error?: string }>;

      gatewayExportHandoff(opts?: {
        moduleId?: string;
        workspaceKeys?: string[];
        taskTitle?: string;
        selectedTopics?: string[];
        selectedFiles?: string[];
        fileName?: string;
      }): Promise<{
        success: boolean;
        data?: { path: string; bytes: number; sections: string[]; markdown: string };
        error?: string;
      }>;
      gatewayHandoffListTopics(moduleId: string): Promise<{
        success: boolean;
        data?: { topics: Array<{ name: string; title: string; bytes: number }> };
        error?: string;
      }>;
      gatewayHandoffListIntent(moduleId: string): Promise<{
        success: boolean;
        data?: { files: Array<{ name: string; title: string; bytes: number }> };
        error?: string;
      }>;
      gatewayHandoffGetPreferences(profileId: string): Promise<{
        success: boolean;
        data?: {
          moduleId?: string;
          preset?: string;
          selectedTopics?: string[];
          selectedFiles?: string[];
          includeGit?: boolean;
          includePreflight?: boolean;
          includeSchema?: boolean;
          includeIntent?: boolean;
        } | null;
        error?: string;
      }>;
      gatewayHandoffSavePreferences(profileId: string, prefs: {
        moduleId?: string;
        preset?: string;
        selectedTopics?: string[];
        selectedFiles?: string[];
        includeGit?: boolean;
        includePreflight?: boolean;
        includeSchema?: boolean;
        includeIntent?: boolean;
      }): Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {};