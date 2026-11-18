// src/main/services/gateway/cache/ResourceService.ts
//
// Универсальный реестр ресурсов (файлы, БД, дампы, торренты, ...).
// Отвечает за: saveDiskFile, getContentByKey, listResources,
// setMemoryState, deleteResource, gc.
//
// resource_key = 'file:<abs>' для файлов. Для других kind — свой префикс.

import fsPromises from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import type { DatabaseSync } from 'node:sqlite';
import { getGatewayCache } from './db';
import { GatewayFileService } from './GatewayFileService';

export type ResourceKind =
  | 'file' | 'sqlite_db' | 'dump' | 'folder'
  | 'torrent_corpus' | 'osint_artifact' | 'sietch_index';

export type MemoryState = 'archive' | 'memory' | 'ignored';
export type FileKind = 'text' | 'image' | 'binary';

export interface ResourceListItem {
  resourceKey: string;
  resourceKind: ResourceKind;
  displayName: string;
  metadata: Record<string, any>;
  latestSha256?: string;
  latestSizeBytes?: number;
  lastSentAt?: number;
  lastAccessedAt: number;
  memoryState: MemoryState;
  sendCount: number;
  createdAt: number;
  totalVersionsSizeBytes: number;
  versionsCount: number;
  existsOnDisk?: boolean;
}

export interface SaveDiskFileResult {
  resourceKey: string;
  sha256: string;
  sizeBytes: number;
  wasExisting: boolean;
  contentSaved: 'db' | 'disk';
}

const TEXT_DB_THRESHOLD = 512 * 1024;

export class ResourceService {
  private static instance: ResourceService;

  static getInstance(): ResourceService {
    if (!ResourceService.instance) {
      ResourceService.instance = new ResourceService();
    }
    return ResourceService.instance;
  }

  private get db(): DatabaseSync {
    return getGatewayCache();
  }

  static fileKey(absPath: string): string {
    return `file:${path.resolve(absPath)}`;
  }

  private guessFileKind(absPath: string, mime?: string): FileKind {
    const ext = path.extname(absPath).toLowerCase().slice(1);
    const textExts = new Set([
      'txt','md','markdown','json','json5','jsonld','yaml','yml','toml','ini','conf','log',
      'xml','html','htm','css','scss','sass','less','csv','tsv',
      'js','mjs','cjs','ts','tsx','jsx','py','py3','rb','go','rs','java','kt','kts','swift',
      'c','h','cpp','hpp','cc','hh','cs','php','sh','bash','zsh','fish',
      'sql','graphql','gql','dockerfile','gitignore','env',
    ]);
    const imageExts = new Set(['png','jpg','jpeg','gif','webp','svg','svgz','bmp','ico','tiff','tif','avif','apng']);
    if (textExts.has(ext)) return 'text';
    if (imageExts.has(ext)) return 'image';
    if (mime?.startsWith('text/')) return 'text';
    if (mime?.startsWith('image/')) return 'image';
    return 'binary';
  }

  private guessMime(absPath: string): string {
    const ext = path.extname(absPath).toLowerCase().slice(1);
    const map: Record<string, string> = {
      txt:'text/plain', md:'text/markdown', json:'application/json',
      js:'text/javascript', mjs:'text/javascript', ts:'text/typescript', tsx:'text/typescript',
      jsx:'text/javascript', css:'text/css', html:'text/html', htm:'text/html',
      py:'text/x-python', sql:'text/x-sql', yaml:'text/yaml', yml:'text/yaml',
      toml:'text/toml', sh:'text/x-shellscript',
      png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
      svg:'image/svg+xml', webp:'image/webp', pdf:'application/pdf',
    };
    return map[ext] || 'application/octet-stream';
  }

  /**
   * Сохранить файл с диска: sha, blob (dedup), resources upsert, versions upsert.
   */
  async saveDiskFile(absPath: string, opts?: { mime?: string }): Promise<SaveDiskFileResult> {
    const resolved = path.resolve(absPath);
    if (!fsSync.existsSync(resolved)) {
      throw new Error(`Файл не найден: ${resolved}`);
    }

    const resourceKey = ResourceService.fileKey(resolved);
    const buffer = await fsPromises.readFile(resolved);
    const sizeBytes = buffer.byteLength;
    const fileKind = this.guessFileKind(resolved, opts?.mime);
    const mime = opts?.mime || this.guessMime(resolved);
    const displayName = path.basename(resolved);
    const now = Date.now();

    const isText = fileKind === 'text';
    const inDb = isText && sizeBytes < TEXT_DB_THRESHOLD;
    const content = inDb ? buffer.toString('utf-8') : buffer.toString('base64');

    const fileService = GatewayFileService.getInstance();
    const blob = await fileService.ensureBlob({
      content,
      name: displayName,
      mime,
      fileKind,
      isBase64: !inDb,
    });

    this.db.exec('BEGIN');
    try {
      const existing = this.db
        .prepare('SELECT resource_key FROM resources WHERE resource_key = ?')
        .get(resourceKey) as { resource_key: string } | undefined;

      const metaJson = JSON.stringify({ path: resolved, mime, size: sizeBytes });

      if (existing) {
        this.db.prepare(`
          UPDATE resources
          SET latest_sha256 = ?, latest_size_bytes = ?, last_sent_at = ?,
              last_accessed_at = ?, send_count = send_count + 1,
              metadata_json = ?
          WHERE resource_key = ?
        `).run(blob.sha256, sizeBytes, now, now, metaJson, resourceKey);
      } else {
        this.db.prepare(`
          INSERT INTO resources
            (resource_key, resource_kind, display_name, metadata_json,
             latest_sha256, latest_size_bytes, last_accessed_at, last_sent_at,
             memory_state, send_count, created_at)
          VALUES (?, 'file', ?, ?, ?, ?, ?, ?, 'archive', 1, ?)
        `).run(resourceKey, displayName, metaJson, blob.sha256, sizeBytes, now, now, now);
      }

      const vExisting = this.db
        .prepare('SELECT 1 FROM resource_versions WHERE resource_key = ? AND sha256 = ?')
        .get(resourceKey, blob.sha256);

      if (vExisting) {
        this.db.prepare(
          'UPDATE resource_versions SET last_sent_at = ? WHERE resource_key = ? AND sha256 = ?'
        ).run(now, resourceKey, blob.sha256);
      } else {
        this.db.prepare(`
          INSERT INTO resource_versions (resource_key, sha256, size_bytes, first_seen_at, last_sent_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(resourceKey, blob.sha256, sizeBytes, now, now);
      }

      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }

    console.log(
      `[Resource] saveDiskFile: "${displayName}" sha=${blob.sha256.slice(0, 12)}… ` +
      `size=${sizeBytes} saved=${blob.contentSaved} existing=${blob.wasExisting}`
    );

    return {
      resourceKey,
      sha256: blob.sha256,
      sizeBytes,
      wasExisting: blob.wasExisting,
      contentSaved: blob.contentSaved,
    };
  }

  /**
   * Прочитать контент по resource_key (latest версия).
   */
  async getContentByKey(resourceKey: string): Promise<{
    buffer: Buffer;
    name: string;
    mime?: string;
    sizeBytes: number;
    sha256: string;
  }> {
    const res = this.db
      .prepare('SELECT * FROM resources WHERE resource_key = ?')
      .get(resourceKey) as any;
    if (!res) throw new Error(`Ресурс не найден: ${resourceKey}`);
    if (!res.latest_sha256) throw new Error(`У ресурса нет контента: ${resourceKey}`);

    const blob = this.db
      .prepare('SELECT * FROM file_blobs WHERE sha256 = ?')
      .get(res.latest_sha256) as any;
    if (!blob) throw new Error(`Blob ${res.latest_sha256} не найден`);

    let buffer: Buffer;
    if (blob.content_text !== null) {
      buffer = Buffer.from(blob.content_text, 'utf-8');
    } else if (blob.content_path) {
      buffer = await fsPromises.readFile(blob.content_path);
    } else {
      throw new Error('Blob без содержимого');
    }

    this.db
      .prepare('UPDATE resources SET last_accessed_at = ? WHERE resource_key = ?')
      .run(Date.now(), resourceKey);

    return {
      buffer,
      name: res.display_name,
      mime: blob.mime || undefined,
      sizeBytes: blob.content_size_bytes,
      sha256: blob.sha256,
    };
  }

  /**
   * Список ресурсов для модалки (с подсчётом размера версий и existsOnDisk).
   */
  listResources(opts: {
    kind?: ResourceKind;
    query?: string;
    limit?: number;
    checkExists?: boolean;
  } = {}): ResourceListItem[] {
    const { kind, query, limit = 200, checkExists = true } = opts;

    let sql = `
      SELECT r.*,
        COALESCE((SELECT SUM(size_bytes) FROM resource_versions WHERE resource_key = r.resource_key), 0) AS total_versions_size,
        COALESCE((SELECT COUNT(*) FROM resource_versions WHERE resource_key = r.resource_key), 0) AS versions_count
      FROM resources r
      WHERE 1=1
    `;
    const params: any[] = [];

    if (kind) {
      sql += ' AND r.resource_kind = ?';
      params.push(kind);
    }
    if (query && query.trim()) {
      sql += ' AND (r.display_name LIKE ? OR r.resource_key LIKE ?)';
      const like = `%${query.trim()}%`;
      params.push(like, like);
    }
    sql += ' ORDER BY COALESCE(r.last_sent_at, r.last_accessed_at) DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((r) => {
      const meta = r.metadata_json ? JSON.parse(r.metadata_json) : {};
      let existsOnDisk: boolean | undefined;
      if (checkExists && r.resource_kind === 'file' && meta.path) {
        try { existsOnDisk = fsSync.existsSync(meta.path); } catch { existsOnDisk = false; }
      }
      return {
        resourceKey: r.resource_key,
        resourceKind: r.resource_kind as ResourceKind,
        displayName: r.display_name,
        metadata: meta,
        latestSha256: r.latest_sha256 || undefined,
        latestSizeBytes: r.latest_size_bytes || undefined,
        lastSentAt: r.last_sent_at || undefined,
        lastAccessedAt: r.last_accessed_at,
        memoryState: r.memory_state as MemoryState,
        sendCount: r.send_count,
        createdAt: r.created_at,
        totalVersionsSizeBytes: r.total_versions_size,
        versionsCount: r.versions_count,
        existsOnDisk,
      };
    });
  }

  setMemoryState(resourceKey: string, state: MemoryState): void {
    this.db.prepare(`
      UPDATE resources
      SET memory_state = ?,
          memory_added_at = CASE WHEN ? = 'memory' THEN ? ELSE NULL END
      WHERE resource_key = ?
    `).run(state, state, Date.now(), resourceKey);
  }

  deleteResource(resourceKey: string): void {
    // CASCADE на resource_versions удалит их
    this.db.prepare('DELETE FROM resources WHERE resource_key = ?').run(resourceKey);
  }

  /**
   * GC: чистит старые версии + мёртвые источники.
   */
  async gc(ttlDays: number = 7, autoDeleteDeadDays: number = 90): Promise<{
    deletedVersions: number;
    deletedSources: number;
    freedBytes: number;
  }> {
    const now = Date.now();
    const ttlCutoff = now - ttlDays * 86400 * 1000;
    const deadCutoff = now - autoDeleteDeadDays * 86400 * 1000;

    let deletedVersions = 0;
    let deletedSources = 0;
    let freedBytes = 0;

    this.db.exec('BEGIN');
    try {
      // 1. Предыдущие версии
      const oldVersions = this.db.prepare(`
        SELECT rv.resource_key, rv.sha256, rv.size_bytes
        FROM resource_versions rv
        JOIN resources r ON r.resource_key = rv.resource_key
        WHERE rv.last_sent_at < ?
          AND rv.sha256 != r.latest_sha256
          AND r.memory_state != 'memory'
      `).all(ttlCutoff) as any[];

      for (const v of oldVersions) {
        this.db.prepare(
          'DELETE FROM resource_versions WHERE resource_key = ? AND sha256 = ?'
        ).run(v.resource_key, v.sha256);
        deletedVersions++;
        freedBytes += v.size_bytes || 0;
      }

      // 2. Мёртвые источники (файл исчез + давно не отправлялся)
      const sources = this.db.prepare(`
        SELECT * FROM resources
        WHERE resource_kind = 'file'
          AND memory_state != 'memory'
          AND COALESCE(last_sent_at, last_accessed_at) < ?
      `).all(deadCutoff) as any[];

      for (const r of sources) {
        const meta = r.metadata_json ? JSON.parse(r.metadata_json) : {};
        if (meta.path && !fsSync.existsSync(meta.path)) {
          this.db.prepare('DELETE FROM resources WHERE resource_key = ?').run(r.resource_key);
          deletedSources++;
        }
      }

      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }

    console.log(
      `[Resource] gc: versions=${deletedVersions} sources=${deletedSources} freedBytes=${freedBytes}`
    );
    return { deletedVersions, deletedSources, freedBytes };
  }
}