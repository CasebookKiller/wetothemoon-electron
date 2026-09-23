import { getDatabase } from './connection';

export type KadDumpKind = 'cases_by_inn' | 'card';

export interface KadDumpRow {
  id: number;
  kind: KadDumpKind;
  key: string;
  shard: string | null;
  dump_file_path: string;
  size_bytes: number | null;
  payload_meta: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

/**
 * Возвращает запись о дампе по (kind, key) или null.
 * Основной вход в кеш: сначала читаем эту запись, потом — файл.
 */
export function getKadDump(kind: KadDumpKind, key: string): KadDumpRow | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, kind, key, shard, dump_file_path, size_bytes, payload_meta,
           created_at, updated_at, last_accessed_at
    FROM kad_dumps
    WHERE kind = ? AND key = ?
    LIMIT 1
  `).get(kind, key) as KadDumpRow | undefined;
  return row ?? null;
}

/**
 * Upsert дампа. Если запись с таким (kind, key) есть — обновляем
 * updated_at, path, size, shard, payload_meta. Если нет — создаём.
 */
export function upsertKadDump(input: {
  kind: KadDumpKind;
  key: string;
  shard?: string | null;
  dumpFilePath: string;
  sizeBytes: number;
  payloadMeta?: string | null;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = db.prepare(
    'SELECT id FROM kad_dumps WHERE kind = ? AND key = ?'
  ).get(input.kind, input.key) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE kad_dumps
      SET shard = COALESCE(?, shard),
          dump_file_path = ?,
          size_bytes = ?,
          payload_meta = ?,
          updated_at = ?,
          last_accessed_at = ?
      WHERE id = ?
    `).run(
      input.shard ?? null,
      input.dumpFilePath,
      input.sizeBytes,
      input.payloadMeta ?? null,
      now,
      now,
      existing.id
    );
    return existing.id;
  }

  const info = db.prepare(`
    INSERT INTO kad_dumps
      (kind, key, shard, dump_file_path, size_bytes, payload_meta,
       created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.kind,
    input.key,
    input.shard ?? null,
    input.dumpFilePath,
    input.sizeBytes,
    input.payloadMeta ?? null,
    now,
    now,
    now
  );
  return Number(info.lastInsertRowid);
}

/**
 * Обновляет только last_accessed_at — «я сейчас прочитал кеш».
 * updated_at не трогаем: критерий «сегодня» для решения
 * «идти в сеть или нет» остаётся прежним.
 */
export function touchKadDump(id: number): void {
  const db = getDatabase();
  db.prepare('UPDATE kad_dumps SET last_accessed_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id);
}

/**
 * Полный список дампов для UI-панели (в будущем).
 */
export function listKadDumps(): KadDumpRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, kind, key, shard, dump_file_path, size_bytes, payload_meta,
           created_at, updated_at, last_accessed_at
    FROM kad_dumps
    ORDER BY updated_at DESC
  `).all() as unknown as KadDumpRow[];
}

/**
 * Дампы одного шарда — для будущей P2P-упаковки торрентов.
 * Пример: все карточки за 2026 год → kind='card', shard='2026'.
 */
export function listKadDumpsByShard(
  kind: KadDumpKind,
  shard: string
): KadDumpRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, kind, key, shard, dump_file_path, size_bytes, payload_meta,
           created_at, updated_at, last_accessed_at
    FROM kad_dumps
    WHERE kind = ? AND shard = ?
    ORDER BY key ASC
  `).all(kind, shard) as unknown as KadDumpRow[];
}

/**
 * Быстрый счётчик по шарду (без выгрузки строк).
 */
export function countKadDumpsByShard(
  kind: KadDumpKind,
  shard: string
): number {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM kad_dumps WHERE kind = ? AND shard = ?
  `).get(kind, shard) as { c: number } | undefined;
  return row?.c ?? 0;
}

/**
 * Статус кеша карточек для списка UUID — для UI-бейджа «из кеша»
 * в KadArbitrCasesDialog.
 *
 * Возвращает: { [caseUuid]: ISO updated_at }.
 * Пустой объект, если ничего не найдено — UI трактует как «нет кеша».
 */
export function getKadCardsCacheStatus(
  caseUuids: string[]
): Record<string, string> {
  if (!caseUuids || caseUuids.length === 0) return {};
  const db = getDatabase();
  const placeholders = caseUuids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT key, updated_at FROM kad_dumps
    WHERE kind = 'card' AND key IN (${placeholders})
  `).all(...caseUuids) as Array<{ key: string; updated_at: string }>;

  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.updated_at;
  return result;
}

/**
 * Удаление записи о дампе и её файла.
 */
export function deleteKadDump(kind: KadDumpKind, key: string): {
  deletedRecords: number;
  deletedFile: string | null;
} {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT id, dump_file_path FROM kad_dumps WHERE kind = ? AND key = ?'
  ).get(kind, key) as { id: number; dump_file_path: string } | undefined;

  if (!row) return { deletedRecords: 0, deletedFile: null };

  db.prepare('DELETE FROM kad_dumps WHERE id = ?').run(row.id);
  return { deletedRecords: 1, deletedFile: row.dump_file_path };
}