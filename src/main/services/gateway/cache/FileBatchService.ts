// src/main/services/gateway/cache/FileBatchService.ts
//
// Фоновая последовательная загрузка недокачанных файлов диалога.
// Max 30 файлов за batch, порядок sequence ASC, отмена после текущего PoW.

import { EventEmitter } from 'events';
import { GatewayFileService } from './GatewayFileService';
import { DeepSeekService } from '../deepseekService';

const MAX_BATCH_SIZE = 30;
const PAUSE_BETWEEN_FILES_MS = 300;

export type BatchStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface BatchState {
  convId: string;
  total: number;
  processed: number;
  ok: number;
  failed: number;
  currentName?: string;
  currentChipIndex?: number;
  status: BatchStatus;
  cancelled: boolean;
  startedAt: number;
  finishedAt?: number;
  lastError?: string;
}

export interface BatchStartedPayload {
  convId: string;
  total: number;
  skipped: number;
}

export interface BatchProgressPayload {
  convId: string;
  current: number; // 1-based
  total: number;
  ok: number;
  failed: number;
  name: string;
  status: 'ok' | 'failed';
  error?: string;
  /** Для accent border в UI */
  messageHash: string;
  chipIndex: number;
}

export interface BatchCompletePayload {
  convId: string;
  processed: number;
  total: number;
  ok: number;
  failed: number;
  status: BatchStatus;
}

export class FileBatchService {
  private static instance: FileBatchService;
  private batches = new Map<string, BatchState>();
  private emitter = new EventEmitter();

  static getInstance(): FileBatchService {
    if (!FileBatchService.instance) {
      FileBatchService.instance = new FileBatchService();
    }
    return FileBatchService.instance;
  }

  /** Подписчик: gatewayHandlers (проброс в GW через bridge) */
  getEmitter(): EventEmitter {
    return this.emitter;
  }

  getBatchState(convId: string): BatchState | null {
    return this.batches.get(convId) ?? null;
  }

  /**
   * Запуск batch-загрузки. Не блокирует — возвращает сразу.
   * count ограничивается max 30.
   * skip: если в диалоге меньше count pending — загрузим сколько есть.
   */
  async startBatch(
    convId: string,
    count: number
  ): Promise<{ started: boolean; total: number; skipped: number }> {
    // Уже идёт — не запускаем второй
    const existing = this.batches.get(convId);
    if (existing && existing.status === 'running') {
      return {
        started: false,
        total: existing.total,
        skipped: existing.total - existing.processed,
      };
    }

    const limit = Math.max(1, Math.min(count, MAX_BATCH_SIZE));
    const fileService = GatewayFileService.getInstance();
    const pending = fileService.listPendingFiles(convId, limit);

    if (pending.length === 0) {
      console.log(`[FileBatch] ${convId}: нет недокачанных файлов`);
      return { started: false, total: 0, skipped: 0 };
    }

    const batch: BatchState = {
      convId,
      total: pending.length,
      processed: 0,
      ok: 0,
      failed: 0,
      status: 'running',
      cancelled: false,
      startedAt: Date.now(),
    };
    this.batches.set(convId, batch);

    console.log(
      `[FileBatch] старт: ${convId}, ${pending.length} файлов (запрошено ${count}, лимит ${limit})`
    );
    this.emitter.emit('batch-started', {
      convId,
      total: pending.length,
      skipped: 0,
    } as BatchStartedPayload);

    // Фоном — не ждём
    void this.runBatch(batch, pending);

    return { started: true, total: pending.length, skipped: 0 };
  }

  /**
   * Отмена: текущий PoW доедет, следующий не начнётся.
   */
  cancelBatch(convId: string): boolean {
    const batch = this.batches.get(convId);
    if (!batch || batch.status !== 'running') return false;
    batch.cancelled = true;
    console.log(`[FileBatch] ${convId}: запрошена отмена`);
    return true;
  }

  /**
   * PW был закрыт руками — прерываем все активные batch.
   */
  onPwDisconnected(): void {
    for (const batch of this.batches.values()) {
      if (batch.status === 'running') {
        batch.cancelled = true;
        batch.status = 'failed';
        batch.lastError = 'PW closed';
        batch.finishedAt = Date.now();
        console.log(
          `[FileBatch] ${batch.convId}: прервано (PW closed), processed=${batch.processed}/${batch.total}`
        );
        this.emitter.emit('batch-complete', {
          convId: batch.convId,
          processed: batch.processed,
          total: batch.total,
          ok: batch.ok,
          failed: batch.failed,
          status: 'failed',
        } as BatchCompletePayload);
      }
    }
  }

  // ── Приватная логика ──

  private async runBatch(
    batch: BatchState,
    pending: Array<{
      messageHash: string;
      pwKey: string | null;
      chipIndex: number;
      name: string;
      mime?: string;
      size?: string;
      fileKind: 'text' | 'image' | 'binary';
    }>
  ): Promise<void> {
    const deepseek = DeepSeekService.getInstance();
    const fileService = GatewayFileService.getInstance();

    for (let i = 0; i < pending.length; i++) {
      // Проверка отмены (batch.cancelled мог стать true через cancelBatch или onPwDisconnected)
      if (batch.cancelled) {
        batch.status = batch.lastError === 'PW closed' ? 'failed' : 'cancelled';
        batch.finishedAt = Date.now();
        console.log(
          `[FileBatch] ${batch.convId}: ${batch.status}, processed=${batch.processed}/${batch.total}`
        );
        // batch-complete уже эмитнут в onPwDisconnected для failed-случая
        if (batch.status === 'cancelled') {
          this.emitter.emit('batch-complete', {
            convId: batch.convId,
            processed: batch.processed,
            total: batch.total,
            ok: batch.ok,
            failed: batch.failed,
            status: 'cancelled',
          } as BatchCompletePayload);
        }
        return;
      }

      const item = pending[i];
      batch.currentName = item.name;
      batch.currentChipIndex = item.chipIndex;

      try {
        const fetched = await deepseek.fetchFileContent(
          batch.convId,
          item.pwKey,
          item.name,
          item.chipIndex
        );

        if (!fetched) {
          throw new Error('empty result');
        }

        await fileService.saveFile({
          conversationId: batch.convId,
          messageHash: item.messageHash,
          chipIndex: item.chipIndex,
          name: fetched.name || item.name,
          mime: item.mime,
          sizeDisplay: item.size,
          fileKind: item.fileKind,
          fileId: fetched.fileId,
          content: fetched.content,
        });

        batch.ok++;
        this.emitter.emit('batch-progress', {
          convId: batch.convId,
          current: i + 1,
          total: batch.total,
          ok: batch.ok,
          failed: batch.failed,
          name: item.name,
          status: 'ok',
          messageHash: item.messageHash,
          chipIndex: item.chipIndex,
        } as BatchProgressPayload);
        console.log(
          `[FileBatch] ${batch.convId}: ${i + 1}/${batch.total} OK "${item.name}"`
        );
      } catch (e) {
        batch.failed++;
        const errMsg = (e as Error).message || 'unknown';
        this.emitter.emit('batch-progress', {
          convId: batch.convId,
          current: i + 1,
          total: batch.total,
          ok: batch.ok,
          failed: batch.failed,
          name: item.name,
          status: 'failed',
          error: errMsg,
          messageHash: item.messageHash,
          chipIndex: item.chipIndex,
        } as BatchProgressPayload);
        console.log(
          `[FileBatch] ${batch.convId}: ${i + 1}/${batch.total} FAIL "${item.name}": ${errMsg}`
        );
        // Не прерываем batch из-за одного провала — идём дальше
      }

      batch.processed = i + 1;
      batch.currentName = undefined;
      batch.currentChipIndex = undefined;

      // Пауза между файлами (PW-виртуалка успевает прийти в себя)
      if (i < pending.length - 1) {
        await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_FILES_MS));
      }
    }

    // Успешное завершение всех
    if (!batch.cancelled) {
      batch.status = 'completed';
      batch.finishedAt = Date.now();
      this.emitter.emit('batch-complete', {
        convId: batch.convId,
        processed: batch.processed,
        total: batch.total,
        ok: batch.ok,
        failed: batch.failed,
        status: 'completed',
      } as BatchCompletePayload);
      console.log(
        `[FileBatch] ${batch.convId}: completed, ok=${batch.ok}, failed=${batch.failed}`
      );
    }
  }
}