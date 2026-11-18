// src/main/services/gateway/contextService.ts
//
// Синхронизация context.manifest.json + .md-файлов → gateway.db (v9).
// После первого sync становится источником правды для contextBuilder и
// buildContinuationSystemPrompt (интерфейс не меняется — подменяется источник).
//
// Что НЕ делает:
//   - не удаляет узлы, которых больше нет в манифесте (безопасность:
//     история версий и tasks.context_key остаются живыми)
//   - не запускает watcher (это отдельный модуль, следующий шаг)
//   - не работает с git SHA (тоже следующий шаг — recordVersion примет его
//     параметром, когда появится)

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getGatewayCache } from './cache/db';

// ─── Типы ─────────────────────────────────────────────────────────────

export interface ContextNode {
  id: string;              // = key (стабильный строковый ключ)
  parentId: string | null;
  key: string;
  kind: string;
  title: string;
  contentMd: string;
  contentHash: string;
  version: number;
  gitSha: string | null;
  gitBranch: string | null;
  sourceFile: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ContextVersion {
  id: number;
  nodeId: string;
  version: number;
  contentMd: string;
  contentHash: string;
  changeSummary: string | null;
  gitSha: string | null;
  createdAt: number;
}

export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  versionsAdded: number;
  skipped: Array<{ key: string; reason: string }>;
  durationMs: number;
}

interface ManifestNode {
  key: string;
  kind: string;
  title: string;
  parent: string | null;
  file: string | null;
  summaryFile?: string | null;
}

interface Manifest {
  version: 1;
  root: string;
  nodes: ManifestNode[];
}

// ─── Хелперы ──────────────────────────────────────────────────────────

/** Полный sha256 hex. Для content_hash коллизии не критичны, но полный — чище. */
function hashContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readFileSafe(abs: string): string | null {
  try { return fs.readFileSync(abs, 'utf8'); } catch { return null; }
}

function rowToNode(row: any): ContextNode {
  return {
    id: row.id,
    parentId: row.parent_id ?? null,
    key: row.key,
    kind: row.kind,
    title: row.title,
    contentMd: row.content_md ?? '',
    contentHash: row.content_hash ?? '',
    version: row.version ?? 1,
    gitSha: row.git_sha ?? null,
    gitBranch: row.git_branch ?? null,
    sourceFile: row.source_file ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToVersion(row: any): ContextVersion {
  return {
    id: row.id,
    nodeId: row.node_id,
    version: row.version,
    contentMd: row.content_md,
    contentHash: row.content_hash,
    changeSummary: row.change_summary ?? null,
    gitSha: row.git_sha ?? null,
    createdAt: row.created_at,
  };
}

// ─── Синхронизация manifest → БД ──────────────────────────────────────

export function syncManifestToDb(manifestPath: string): SyncResult {
  const started = Date.now();
  const result: SyncResult = {
    created: 0, updated: 0, unchanged: 0, versionsAdded: 0,
    skipped: [], durationMs: 0,
  };

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest не найден: ${manifestPath}`);
  }
  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.nodes)) {
    throw new Error('manifest.nodes должен быть массивом');
  }

  // Сортировка parents-first: чем меньше '/' в key, тем выше узел.
  // FK parent_id → context_nodes(id) требует, чтобы родитель уже был в БД.
  const nodes = [...manifest.nodes].sort(
    (a, b) => a.key.split('/').length - b.key.split('/').length
  );

  const db = getGatewayCache();

  db.exec('BEGIN');
  try {
    for (const node of nodes) {
      // 1. Прочитать содержимое файла: summaryFile имеет приоритет для content_md
      //    (именно summary попадает в промпт). Полный file — в source_file, для
      //    read_context_node tool (будущий). Если summaryFile нет — читаем file.
      let contentMd = '';
      let sourceFile: string | null = null;
      const effectiveFile = (node as any).summaryFile || node.file;
      if (effectiveFile) {
        const abs = path.isAbsolute(effectiveFile)
          ? effectiveFile
          : path.join(manifest.root, effectiveFile);
        const txt = readFileSafe(abs);
        if (txt !== null) {
          contentMd = txt;
          sourceFile = node.file; // в source_file — полный путь (для tool)
        } else {
          result.skipped.push({ key: node.key, reason: `file missing: ${effectiveFile}` });
          sourceFile = node.file;
        }
      }
      const contentHash = contentMd ? hashContent(contentMd) : '';

      // 2. Проверить, есть ли узел
      const existing = db.prepare(
        `SELECT id, content_hash, version FROM context_nodes WHERE key = ?`
      ).get(node.key) as { id: string; content_hash: string; version: number } | undefined;

      const now = Date.now();

      if (!existing) {
        // ─── INSERT ───
        db.prepare(`
          INSERT INTO context_nodes
            (id, parent_id, key, kind, title, content_md, content_hash, version,
             git_sha, git_branch, source_file, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, ?, ?)
        `).run(
          node.key,               // id = key
          node.parent,            // parent_id = key родителя (null у корня)
          node.key,
          node.kind,
          node.title,
          contentMd,
          contentHash,
          sourceFile,
          now,
          now
        );

        // Первая версия
        db.prepare(`
          INSERT INTO context_versions
            (node_id, version, content_md, content_hash, change_summary, git_sha, created_at)
          VALUES (?, 1, ?, ?, ?, NULL, ?)
        `).run(
          node.key,
          contentMd,
          contentHash,
          'initial sync from manifest',
          now
        );

        result.created += 1;
        result.versionsAdded += 1;
      } else if (existing.content_hash !== contentHash) {
        // ─── UPDATE + новая версия ───
        const newVersion = existing.version + 1;
        db.prepare(`
          UPDATE context_nodes
             SET parent_id = ?, kind = ?, title = ?, content_md = ?, content_hash = ?,
                 version = ?, source_file = ?, updated_at = ?
           WHERE id = ?
        `).run(
          node.parent,
          node.kind,
          node.title,
          contentMd,
          contentHash,
          newVersion,
          sourceFile,
          now,
          node.key
        );

        db.prepare(`
          INSERT INTO context_versions
            (node_id, version, content_md, content_hash, change_summary, git_sha, created_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?)
        `).run(
          node.key,
          newVersion,
          contentMd,
          contentHash,
          'changed (content_hash differs)',
          now
        );

        result.updated += 1;
        result.versionsAdded += 1;
      } else {
        // ─── UNCHANGED (но обновим title/parent, вдруг переименовали) ───
        db.prepare(`
          UPDATE context_nodes
             SET parent_id = ?, kind = ?, title = ?, source_file = ?, updated_at = ?
           WHERE id = ?
        `).run(
          node.parent,
          node.kind,
          node.title,
          sourceFile,
          now,
          node.key
        );
        result.unchanged += 1;
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }

  result.durationMs = Date.now() - started;
  return result;
}

// ─── Чтение ───────────────────────────────────────────────────────────

export function getNode(key: string): ContextNode | null {
  const db = getGatewayCache();
  const row = db.prepare(`SELECT * FROM context_nodes WHERE key = ?`).get(key);
  return row ? rowToNode(row) : null;
}

export function getChildren(key: string): ContextNode[] {
  const db = getGatewayCache();
  const rows = db.prepare(`SELECT * FROM context_nodes WHERE parent_id = ? ORDER BY key`).all(key) as any[];
  return rows.map(rowToNode);
}

/**
 * Цепочка от корня до каждого из activeKeys (включительно), объединённая и
 * дедуплицированная, отсортированная по глубине key. Используется contextBuilder'ом
 * вместо чтения манифеста с диска.
 *
 * Порядок гарантирует cache-hit у DeepSeek (стабильный префикс).
 */
export function getChain(activeKeys: string[]): ContextNode[] {
  const db = getGatewayCache();
  const stmt = db.prepare(`SELECT * FROM context_nodes WHERE key = ?`);

  const seen = new Set<string>();
  const merged: ContextNode[] = [];

  for (const activeKey of activeKeys) {
    // Собираем цепочку ОТ КОРНЯ: unshift → [global, project, ..., activeKey]
    const oneChain: ContextNode[] = [];
    let key: string | null = activeKey;
    while (key) {
      const row: any = stmt.get(key);
      if (!row) break;
      const node = rowToNode(row);
      oneChain.unshift(node);
      key = node.parentId;
    }

    // Мержим, дедуп по key. Сохраняем порядок из oneChain (global первый).
    for (const node of oneChain) {
      if (seen.has(node.key)) continue;
      seen.add(node.key);
      merged.push(node);
    }
  }

  // Стабильная сортировка по глубине: сохраняет порядок вставки внутри группы.
  // После unshift global/project/submodule всегда идут в правильном порядке.
  merged.sort((a, b) => a.key.split('/').length - b.key.split('/').length);
  return merged;
}

// ─── Версии ───────────────────────────────────────────────────────────

export function listVersions(nodeId: string, limit = 20): ContextVersion[] {
  const db = getGatewayCache();
  const rows = db.prepare(`
    SELECT * FROM context_versions
    WHERE node_id = ?
    ORDER BY version DESC
    LIMIT ?
  `).all(nodeId, limit) as any[];
  return rows.map(rowToVersion);
}

export function getVersion(nodeId: string, version: number): ContextVersion | null {
  const db = getGatewayCache();
  const row = db.prepare(
    `SELECT * FROM context_versions WHERE node_id = ? AND version = ?`
  ).get(nodeId, version);
  return row ? rowToVersion(row) : null;
}

/**
 * Ручная запись версии (для watcher и агентских правок в будущем).
 * Инкрементирует version, пишет в context_versions.
 * НЕ вызывает syncManifestToDb — вызывающий сам решает, когда.
 */
export function recordVersion(
  nodeId: string,
  content: string,
  changeSummary?: string,
  gitSha?: string | null,
): ContextVersion {
  const db = getGatewayCache();
  const existing = db.prepare(
    `SELECT version FROM context_nodes WHERE id = ?`
  ).get(nodeId) as { version: number } | undefined;
  if (!existing) throw new Error(`узел не найден: ${nodeId}`);

  const newVersion = existing.version + 1;
  const contentHash = content ? hashContent(content) : '';
  const now = Date.now();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE context_nodes
         SET content_md = ?, content_hash = ?, version = ?, updated_at = ?
       WHERE id = ?
    `).run(content, contentHash, newVersion, now, nodeId);

    db.prepare(`
      INSERT INTO context_versions
        (node_id, version, content_md, content_hash, change_summary, git_sha, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      nodeId, newVersion, content, contentHash,
      changeSummary ?? null, gitSha ?? null, now
    );

    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }

  return {
    id: 0,
    nodeId,
    version: newVersion,
    contentMd: content,
    contentHash,
    changeSummary: changeSummary ?? null,
    gitSha: gitSha ?? null,
    createdAt: now,
  };
}
