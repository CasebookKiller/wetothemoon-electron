// src/main/services/gateway/cache/GatewayFileService.ts

import fsPromises from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getGatewayCache, getGatewayFilesDir } from './db';
import type {
  SaveFileInput,
  SaveFileResult,
  CachedFileContent,
  FileStatus,
} from './types';

const TEXT_DB_THRESHOLD = 512 * 1024; // 512 KB — порог «текст в БД»

interface BlobRow {
  sha256: string;
  content_text: string | null;
  content_path: string | null;
  content_size_bytes: number;
  file_kind: 'text' | 'image' | 'binary';
  mime: string | null;
  created_at: number;
  ref_count: number;
}

interface MessageFileRow {
  file_id: string;
  conversation_id: string;
  message_hash: string;
  chip_index: number;
  name: string;
  size_display: string | null;
  mime_display: string | null;
  blob_sha256: string;
  fetch_status: 'pending' | 'ok' | 'failed';
  fetch_error: string | null;
  fetched_at: number | null;
  last_accessed_at: number | null;
  origin_url: string | null;
}

export class GatewayFileService {
  private static instance: GatewayFileService;

  static getInstance(): GatewayFileService {
    if (!GatewayFileService.instance) {
      GatewayFileService.instance = new GatewayFileService();
    }
    return GatewayFileService.instance;
  }

  private get db(): DatabaseSync {
    return getGatewayCache();
  }

  /**
   * Абсолютный путь к файлу в gateway_files.
   * Раскладка по первым 2 hex-символам sha256 (анти-inode-limit).
   *   <userData>/gateway_files/ab/abcdef...txt
   */
  private blobPath(sha256: string, ext: string): string {
    const dir = path.join(getGatewayFilesDir(), sha256.slice(0, 2));
    const fname = `${sha256}${ext || ''}`;
    return path.join(dir, fname);
  }

  private async ensureBlobDir(sha256: string): Promise<void> {
    const dir = path.join(getGatewayFilesDir(), sha256.slice(0, 2));
    await fsPromises.mkdir(dir, { recursive: true });
  }

  private guessExt(mime?: string, name?: string): string {
    const lower = (mime || '').toLowerCase();
    const map: Record<string, string> = {
      txt: '.txt',
      md: '.md',
      json: '.json',
      csv: '.csv',
      log: '.log',
      xml: '.xml',
      yaml: '.yaml',
      yml: '.yml',
      js: '.js',
      ts: '.ts',
      py: '.py',
      html: '.html',
      css: '.css',
      sql: '.sql',
      png: '.png',
      jpg: '.jpg',
      jpeg: '.jpeg',
      gif: '.gif',
      webp: '.webp',
      pdf: '.pdf',
      zip: '.zip',
    };
    if (lower && map[lower]) return map[lower];
    // fallback по имени
    if (name) {
      const m = name.match(/\.[a-z0-9]+$/i);
      if (m) return m[0].toLowerCase();
    }
    return '';
  }

  /**
   * Универсальный upsert blob'а в file_blobs (без message_files).
   * Используется ResourceService.saveDiskFile.
   */
  async ensureBlob(input: {
    content: string;
    name: string;
    mime?: string;
    fileKind: 'text' | 'image' | 'binary';
    isBase64: boolean;
  }): Promise<{ sha256: string; contentSaved: 'db' | 'disk'; wasExisting: boolean }> {
    const db = this.db;
    const now = Date.now();

    const buffer = input.isBase64
      ? Buffer.from(input.content, 'base64')
      : Buffer.from(input.content, 'utf-8');
    const sizeBytes = buffer.byteLength;
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const existing = db
      .prepare('SELECT * FROM file_blobs WHERE sha256 = ?')
      .get(sha256) as unknown as BlobRow | undefined;
    if (existing) {
      return {
        sha256,
        contentSaved: existing.content_path ? 'disk' : 'db',
        wasExisting: true,
      };
    }

    let contentSaved: 'db' | 'disk' = 'db';
    if (input.fileKind === 'text' && sizeBytes < TEXT_DB_THRESHOLD) {
      db.prepare(`
        INSERT INTO file_blobs
          (sha256, content_text, content_path, content_size_bytes,
           file_kind, mime, created_at, ref_count)
        VALUES (?, ?, NULL, ?, ?, ?, ?, 0)
      `).run(sha256, input.content, sizeBytes, input.fileKind, input.mime || null, now);
      contentSaved = 'db';
    } else {
      const ext = this.guessExt(input.mime, input.name);
      const filePath = this.blobPath(sha256, ext);
      await this.ensureBlobDir(sha256);
      await fsPromises.writeFile(filePath, buffer);
      db.prepare(`
        INSERT INTO file_blobs
          (sha256, content_text, content_path, content_size_bytes,
           file_kind, mime, created_at, ref_count)
        VALUES (?, NULL, ?, ?, ?, ?, ?, 0)
      `).run(sha256, filePath, sizeBytes, input.fileKind, input.mime || null, now);
      contentSaved = 'disk';
    }

    return { sha256, contentSaved, wasExisting: false };
  }

  /**
   * Сохранить файл: sha256 → file_blobs (dedup) + message_files.
   * Триггер message_files_ai инкрементирует ref_count.
   */
  async saveFile(input: SaveFileInput): Promise<SaveFileResult> {
    const db = this.db;
    const now = Date.now();

    // 1. sha256 контента
    const contentBuffer = Buffer.from(input.content, 'utf-8');
    const sizeBytes = contentBuffer.byteLength;
    const sha256 = createHash('sha256')
      .update(contentBuffer)
      .digest('hex');

    // 2. Есть ли уже message_files запись для этого (file_id, conv, hash, chip)?
    const existingMf = db
      .prepare(`
        SELECT blob_sha256 FROM message_files
        WHERE file_id = ? AND conversation_id = ?
          AND message_hash = ? AND chip_index = ?
      `)
      .get(
        input.fileId,
        input.conversationId,
        input.messageHash,
        input.chipIndex
      ) as unknown as { blob_sha256: string } | undefined;

    if (existingMf) {
      // Обновим статус + fetched_at; контент не трогаем
      db.prepare(`
        UPDATE message_files
        SET fetch_status = 'ok', fetch_error = NULL, fetched_at = ?
        WHERE file_id = ? AND conversation_id = ?
          AND message_hash = ? AND chip_index = ?
      `).run(
        now,
        input.fileId,
        input.conversationId,
        input.messageHash,
        input.chipIndex
      );
      return {
        blobSha256: existingMf.blob_sha256,
        contentSaved:
          existingMf.blob_sha256 === sha256 ? 'db' : 'db', // не важно, уже было
        wasExisting: true,
      };
    }

    // 3. Есть ли уже blob с таким sha256?
    const existingBlob = db
      .prepare('SELECT * FROM file_blobs WHERE sha256 = ?')
      .get(sha256) as unknown as BlobRow | undefined;

    let contentSaved: 'db' | 'disk' = 'db';

    db.exec('BEGIN');
    try {
      if (!existingBlob) {
        // 3a. Новый blob — пишем контент
        if (input.fileKind === 'text' && sizeBytes < TEXT_DB_THRESHOLD) {
          // В БД
          db.prepare(`
            INSERT INTO file_blobs
              (sha256, content_text, content_path, content_size_bytes,
               file_kind, mime, created_at, ref_count)
            VALUES (?, ?, NULL, ?, ?, ?, ?, 0)
          `).run(
            sha256,
            input.content,
            sizeBytes,
            input.fileKind,
            input.mime || null,
            now
          );
          contentSaved = 'db';
        } else {
          // На диск
          const ext = this.guessExt(input.mime, input.name);
          const filePath = this.blobPath(sha256, ext);
          await this.ensureBlobDir(sha256);
          if (input.fileKind === 'text') {
            await fsPromises.writeFile(filePath, input.content, 'utf-8');
          } else {
            // base64 → Buffer
            const buf = Buffer.from(input.content, 'base64');
            await fsPromises.writeFile(filePath, buf);
          }
          db.prepare(`
            INSERT INTO file_blobs
              (sha256, content_text, content_path, content_size_bytes,
               file_kind, mime, created_at, ref_count)
            VALUES (?, NULL, ?, ?, ?, ?, ?, 0)
          `).run(
            sha256,
            filePath,
            sizeBytes,
            input.fileKind,
            input.mime || null,
            now
          );
          contentSaved = 'disk';
        }
      } else {
        // 3b. Blob уже есть (дедуп) — контент на диске/в БД не трогаем
        contentSaved = existingBlob.content_path ? 'disk' : 'db';
      }

      // 4. message_files (триггер ai сделает ref_count + 1)
      db.prepare(`
        INSERT INTO message_files
          (file_id, conversation_id, message_hash, chip_index,
           name, size_display, mime_display, blob_sha256,
           fetch_status, fetched_at, last_accessed_at, origin_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ok', ?, ?, ?)
      `).run(
        input.fileId,
        input.conversationId,
        input.messageHash,
        input.chipIndex,
        input.name,
        input.sizeDisplay || null,
        input.mime || null,
        sha256,
        now,
        now,
        input.originUrl || null
      );

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    console.log(
      `[GatewayFile] save: "${input.name}" sha=${sha256.slice(0, 12)}… saved=${contentSaved}`
    );

    return { blobSha256: sha256, contentSaved, wasExisting: false };
  }

  /**
   * Получить контент из кеша (без fetch).
   * null — если файл ещё не загружался.
   */
  async getContent(
    conversationId: string,
    messageHash: string,
    chipIndex: number
  ): Promise<CachedFileContent | null> {
    const db = this.db;

    const mf = db
      .prepare(`
        SELECT * FROM message_files
        WHERE conversation_id = ? AND message_hash = ? AND chip_index = ?
          AND fetch_status = 'ok'
      `)
      .get(conversationId, messageHash, chipIndex) as unknown as
      | MessageFileRow
      | undefined;
    if (!mf) return null;

    const blob = db
      .prepare('SELECT * FROM file_blobs WHERE sha256 = ?')
      .get(mf.blob_sha256) as unknown as BlobRow | undefined;
    if (!blob) return null;

    let content: string;
    if (blob.content_text !== null) {
      content = blob.content_text;
    } else if (blob.content_path) {
      if (blob.file_kind === 'text') {
        content = await fsPromises.readFile(blob.content_path, 'utf-8');
      } else {
        const buf = await fsPromises.readFile(blob.content_path);
        content = buf.toString('base64');
      }
    } else {
      // нет ни текста, ни файла — битый blob
      return null;
    }

    // last_accessed_at — для LRU-очистки в будущем
    try {
      db.prepare(
        'UPDATE message_files SET last_accessed_at = ? WHERE conversation_id = ? AND message_hash = ? AND chip_index = ?'
      ).run(Date.now(), conversationId, messageHash, chipIndex);
    } catch {
      /* ignore */
    }

    return {
      fileId: mf.file_id,
      name: mf.name,
      mime: mf.mime_display || undefined,
      sizeDisplay: mf.size_display || undefined,
      fileKind: blob.file_kind,
      content,
      fromCache: true,
      fetchedAt: mf.fetched_at || undefined,
    };
  }

  /**
   * Статус одного файла.
   */
  getStatus(
    conversationId: string,
    messageHash: string,
    chipIndex: number
  ): FileStatus | null {
    const row = this.db
      .prepare(`
        SELECT fetch_status FROM message_files
        WHERE conversation_id = ? AND message_hash = ? AND chip_index = ?
      `)
      .get(conversationId, messageHash, chipIndex) as
      | { fetch_status: 'pending' | 'ok' | 'failed' }
      | undefined;
    if (!row) return null;
    if (row.fetch_status === 'ok') return 'ok';
    if (row.fetch_status === 'failed') return 'failed';
    return null; // pending — считаем «не загружено»
  }

  /**
   * Статусы для группы (для accent border).
   * Ключи: `${messageHash}:${chipIndex}`.
   */
  getStatusesBulk(
    conversationId: string,
    items: Array<{ messageHash: string; chipIndex: number }>
  ): Map<string, FileStatus> {
    const result = new Map<string, FileStatus>();
    if (items.length === 0) return result;

    const stmt = this.db.prepare(`
      SELECT fetch_status FROM message_files
      WHERE conversation_id = ? AND message_hash = ? AND chip_index = ?
    `);
    for (const it of items) {
      const row = stmt.get(
        conversationId,
        it.messageHash,
        it.chipIndex
      ) as { fetch_status: 'pending' | 'ok' | 'failed' } | undefined;
      if (!row) continue;
      if (row.fetch_status === 'ok') {
        result.set(`${it.messageHash}:${it.chipIndex}`, 'ok');
      } else if (row.fetch_status === 'failed') {
        result.set(`${it.messageHash}:${it.chipIndex}`, 'failed');
      }
    }
    return result;
  }

  /**
   * Отметить файл как failed (когда fetch упал).
   * Используется UI: если fetchFileContent бросил ошибку — записываем.
   */
  markFailed(
    conversationId: string,
    messageHash: string,
    chipIndex: number,
    errorMessage: string,
    fileId?: string
  ): void {
    const db = this.db;
    const now = Date.now();
    // sha256 пустой blob'а — не пишем, используем специальный маркер
    // (пустая строка не подойдёт из-за FK, поэтому INSERT только если файл уже был
    // или используем UPSERT для message_files без blob'а).

    // Проверяем, есть ли уже запись
    const existing = db
      .prepare(`
        SELECT 1 FROM message_files
        WHERE conversation_id = ? AND message_hash = ? AND chip_index = ?
      `)
      .get(conversationId, messageHash, chipIndex);

    if (existing) {
      db.prepare(`
        UPDATE message_files
        SET fetch_status = 'failed', fetch_error = ?, fetched_at = ?
        WHERE conversation_id = ? AND message_hash = ? AND chip_index = ?
      `).run(errorMessage.slice(0, 500), now, conversationId, messageHash, chipIndex);
      return;
    }

    // Нет записи — создать нельзя без blob (FK). Пропускаем: клик снова попробует fetch.
    console.warn(
      '[GatewayFile] markFailed: нет записи (blob отсутствует) — пропускаем',
      { conversationId, messageHash, chipIndex }
    );
  }

  /**
   * Bulk stats: сколько всего файлов, загружено, pending, failed.
   * Один SQL по всем диалогам (для UI Cache Manager).
   *
   * Логика:
   *  - total  = все file-блоки user-сообщений диалога
   *  - loaded = message_files.fetch_status='ok'
   *  - failed = message_files.fetch_status='failed'
   *  - pending = total - loaded - failed
   */
  getStatsBulk(): Record<
    string,
    { total: number; loaded: number; pending: number; failed: number }
  > {
    const db = this.db;

    // 1. Все сообщения с file-блоками — считаем total per conv
    const msgRows = db
      .prepare(`
        SELECT conversation_id, blocks_json
        FROM messages
        WHERE role = 'user' AND blocks_json IS NOT NULL
      `)
      .all() as Array<{ conversation_id: string; blocks_json: string }>;

    const totalByConv = new Map<string, number>();
    for (const row of msgRows) {
      let blocks: any[] = [];
      try {
        blocks = JSON.parse(row.blocks_json);
      } catch {
        continue;
      }
      if (!Array.isArray(blocks)) continue;
      const fileCount = blocks.filter((b) => b?.type === 'file').length;
      if (fileCount === 0) continue;
      totalByConv.set(
        row.conversation_id,
        (totalByConv.get(row.conversation_id) || 0) + fileCount
      );
    }

    // 2. Загруженные и failed — только привязанные к актуальным messages.
    //    JOIN отсекает orphaned message_files после prune.
    const mfRows = db
      .prepare(`
        SELECT mf.conversation_id, mf.fetch_status, COUNT(*) AS c
        FROM message_files mf
        JOIN messages m
          ON m.message_hash = mf.message_hash
         AND m.conversation_id = mf.conversation_id
        GROUP BY mf.conversation_id, mf.fetch_status
      `)
      .all() as Array<{
      conversation_id: string;
      fetch_status: 'ok' | 'failed' | 'pending';
      c: number;
    }>;

    const loadedByConv = new Map<string, number>();
    const failedByConv = new Map<string, number>();
    for (const row of mfRows) {
      if (row.fetch_status === 'ok') {
        loadedByConv.set(
          row.conversation_id,
          (loadedByConv.get(row.conversation_id) || 0) + row.c
        );
      } else if (row.fetch_status === 'failed') {
        failedByConv.set(
          row.conversation_id,
          (failedByConv.get(row.conversation_id) || 0) + row.c
        );
      }
    }

    // 3. Собираем результат
    const result: Record<
      string,
      { total: number; loaded: number; pending: number; failed: number }
    > = {};
    for (const [convId, total] of totalByConv) {
      const loaded = loadedByConv.get(convId) || 0;
      const failed = failedByConv.get(convId) || 0;
      const pending = Math.max(0, total - loaded - failed);
      result[convId] = { total, loaded, pending, failed };
    }
    return result;
  }

    /**
   * Список файлов диалога, которых ещё нет в кеше (fetch_status != 'ok').
   * Источник: messages.blocks_json (все file-блоки user-сообщений) минус
   * уже загруженные message_files.
   *
   * Порядок: sequence ASC (сверху вниз по истории), потом chip_index ASC.
   */
  listPendingFiles(
    convId: string,
    limit: number
  ): Array<{
    messageHash: string;
    pwKey: string | null;
    chipIndex: number;
    name: string;
    mime?: string;
    size?: string;
    fileKind: 'text' | 'image' | 'binary';
  }> {
    const db = this.db;

    // 1. Все user-сообщения с file-блоками
    const rows = db
      .prepare(`
        SELECT message_hash, pw_key, blocks_json
        FROM messages
        WHERE conversation_id = ? AND role = 'user'
          AND blocks_json IS NOT NULL
        ORDER BY sequence ASC
      `)
      .all(convId) as Array<{
      message_hash: string | null;
      pw_key: string | null;
      blocks_json: string;
    }>;

    // 2. Уже загруженные: Set<`${messageHash}:${chipIndex}`>
    const loaded = db
      .prepare(`
        SELECT message_hash, chip_index
        FROM message_files
        WHERE conversation_id = ? AND fetch_status = 'ok'
      `)
      .all(convId) as Array<{ message_hash: string; chip_index: number }>;
    const loadedSet = new Set(
      loaded.map((r) => `${r.message_hash}:${r.chip_index}`)
    );

    // 3. Собираем pending
    const pending: Array<{
      messageHash: string;
      pwKey: string | null;
      chipIndex: number;
      name: string;
      mime?: string;
      size?: string;
      fileKind: 'text' | 'image' | 'binary';
    }> = [];

    for (const row of rows) {
      if (!row.message_hash) continue; // legacy без hash — пропустить
      let blocks: any[] = [];
      try {
        blocks = JSON.parse(row.blocks_json);
      } catch {
        continue;
      }
      if (!Array.isArray(blocks)) continue;

      let chipIdx = 0;
      for (const b of blocks) {
        if (b?.type !== 'file') continue;
        const key = `${row.message_hash}:${chipIdx}`;
        if (!loadedSet.has(key)) {
          pending.push({
            messageHash: row.message_hash,
            pwKey: row.pw_key,
            chipIndex: chipIdx,
            name: String(b.content || ''),
            mime: b.mime,
            size: b.size,
            fileKind: b.fileKind || 'text',
          });
        }
        chipIdx++;
      }
    }

    return pending.slice(0, limit);
  }

  /**
   * Удаляет orphaned message_files (message_hash отсутствует в messages).
   * Триггер message_files_ad уменьшит ref_count в file_blobs.
   * Не трогает message_files с pending/failed — их можно «спасти»
   * при следующем syncConversation (если hash вернётся).
   */
  cleanupOrphans(): number {
    const db = this.db;
    const r = db.prepare(`
      DELETE FROM message_files
      WHERE fetch_status = 'ok'
        AND NOT EXISTS (
          SELECT 1 FROM messages m
          WHERE m.message_hash = message_files.message_hash
            AND m.conversation_id = message_files.conversation_id
        )
    `).run();
    const changes = Number(r.changes);  // ← bigint → number
    if (changes > 0) {
      console.log(`[GatewayFile] cleanupOrphans: удалено ${changes}`);
    }
    return changes;
  }

  /**
   * GC: удаляет blob'ы с ref_count <= 0 старше N часов.
   * Возвращает { deletedBlobs, deletedFiles }.
   */
  async gc(olderThanHours = 24): Promise<{ deletedBlobs: number; deletedFiles: number }> {
    const db = this.db;
    const cutoff = Date.now() - olderThanHours * 3600 * 1000;

    const blobs = db
      .prepare(`
        SELECT * FROM file_blobs
        WHERE ref_count <= 0
          AND created_at < ?
          AND sha256 NOT IN (
            SELECT latest_sha256 FROM resources WHERE latest_sha256 IS NOT NULL
            UNION
            SELECT sha256 FROM resource_versions
          )
      `)
      .all(cutoff) as unknown as BlobRow[];

    let deletedFiles = 0;
    db.exec('BEGIN');
    try {
      for (const b of blobs) {
        if (b.content_path) {
          try {
            await fsPromises.unlink(b.content_path);
            deletedFiles++;
          } catch {
            /* файла уже нет — ок */
          }
        }
        db.prepare('DELETE FROM file_blobs WHERE sha256 = ?').run(b.sha256);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    if (blobs.length > 0) {
      console.log(
        `[GatewayFile] gc: удалено blob'ов ${blobs.length}, файлов ${deletedFiles}`
      );
    }
    return { deletedBlobs: blobs.length, deletedFiles };
  }
}