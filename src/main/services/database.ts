import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { app } from 'electron';

let db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!db) {
    console.log('Создаём базу данных...');
    const dbPath = path.join(app.getPath('userData'), 'osint_data.db');
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    try {
      initializeSchema(db);
      console.log('Схема инициализирована');
    } catch (e) {
      console.error('Ошибка инициализации схемы:', e);
      throw e;
    }
  }
  return db;
}

function initializeSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS case_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rusprofile_id TEXT UNIQUE,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      normalized_value TEXT NOT NULL,
      label TEXT,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      confidence INTEGER CHECK(confidence BETWEEN 0 AND 100),
      status TEXT NOT NULL DEFAULT 'unverified',
      notes TEXT,
      raw_file_path TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_unique
      ON entities(type, normalized_value);

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      source_type TEXT,
      source_kind TEXT,
      provider TEXT,
      collection_method TEXT,
      authority_basis TEXT,
      reliability INTEGER CHECK(reliability BETWEEN 0 AND 100),
      access_level TEXT,
      retrieved_at TEXT NOT NULL,
      local_path TEXT,
      sha256 TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      predicate TEXT NOT NULL,
      object_id INTEGER NOT NULL,
      source_id INTEGER,
      valid_from TEXT,
      valid_to TEXT,
      evidence_text TEXT,
      confidence INTEGER CHECK(confidence BETWEEN 0 AND 100),
      status TEXT NOT NULL DEFAULT 'unverified',
      notes TEXT,
      raw_file_path TEXT,
      FOREIGN KEY(subject_id) REFERENCES entities(id),
      FOREIGN KEY(object_id) REFERENCES entities(id),
      FOREIGN KEY(source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      attribute TEXT NOT NULL,
      value TEXT NOT NULL,
      source_id INTEGER,
      observed_at TEXT NOT NULL,
      confidence INTEGER CHECK(confidence BETWEEN 0 AND 100),
      notes TEXT,
      raw_file_path TEXT,
      FOREIGN KEY(entity_id) REFERENCES entities(id),
      FOREIGN KEY(source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TEXT NOT NULL,
      changed_by TEXT,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS raw_dumps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_inn TEXT NOT NULL,
      company_id_rusprofile TEXT,
      dump_file_path TEXT NOT NULL,
      size_bytes INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      section_updated_at TEXT,
      collected_sections TEXT  -- JSON-массив названий собранных разделов
    );

    CREATE TABLE IF NOT EXISTS shards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_code TEXT,
      file_path TEXT,
      torrent_info_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      status TEXT DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_entities_inn ON observations(attribute, value);
    CREATE INDEX IF NOT EXISTS idx_relations_subject ON relations(subject_id);
    CREATE INDEX IF NOT EXISTS idx_relations_object ON relations(object_id);
    CREATE INDEX IF NOT EXISTS idx_relations_predicate ON relations(predicate);
    CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_id);
    CREATE INDEX IF NOT EXISTS idx_sources_url ON sources(url);
    CREATE INDEX IF NOT EXISTS idx_raw_dumps_inn ON raw_dumps(company_inn);
    CREATE INDEX IF NOT EXISTS idx_shards_status ON shards(status);
  `);

  // Проверяем наличие колонки collected_sections в raw_dumps
  const rawDumpColumns = db.prepare(`PRAGMA table_info(raw_dumps)`).all() as { name: string }[];
  if (!rawDumpColumns.some(col => col.name === 'collected_sections')) {
    db.exec(`ALTER TABLE raw_dumps ADD COLUMN collected_sections TEXT;`);
  }
  if (!rawDumpColumns.some(col => col.name === 'section_updated_at')) {
    db.exec(`ALTER TABLE raw_dumps ADD COLUMN section_updated_at TEXT;`);
  }

  const caseRow = db.prepare('SELECT id FROM case_info WHERE id = 1').get();
  if (!caseRow) {
    db.prepare(`
      INSERT INTO case_info (id, name, description, status, created_at)
      VALUES (1, ?, ?, ?, ?)
    `).run('OSINT Electron', 'Локальное OSINT-дело', 'active', new Date().toISOString());
  }
}

export function addRawDumpRecord(
  companyInn: string,
  companyIdRusprofile: string | null,
  dumpFilePath: string,
  sizeBytes: number,
  collectedSections: string[],
  sectionUpdatedAt?: Record<string, string>
): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO raw_dumps (company_inn, company_id_rusprofile, dump_file_path, size_bytes, collected_sections, section_updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    companyInn,
    companyIdRusprofile || null,
    dumpFilePath,
    sizeBytes,
    JSON.stringify(collectedSections),
    sectionUpdatedAt ? JSON.stringify(sectionUpdatedAt) : null
  );
  return Number(info.lastInsertRowid);
}

export function findLatestRawDump(companyInn: string, companyIdRusprofile?: string): {
  id: number;
  dump_file_path: string;
  collected_sections: string[] | null;
} | null {
  const db = getDatabase();
  const query = companyIdRusprofile
    ? `SELECT id, dump_file_path, collected_sections FROM raw_dumps
       WHERE company_inn = ? AND company_id_rusprofile = ?
       ORDER BY created_at DESC, id DESC LIMIT 1`
    : `SELECT id, dump_file_path, collected_sections FROM raw_dumps
       WHERE company_inn = ?
       ORDER BY created_at DESC, id DESC LIMIT 1`;
  const params = companyIdRusprofile ? [companyInn, companyIdRusprofile] : [companyInn];
  const row = db.prepare(query).get(...params) as any;
  if (!row) return null;
  return {
    id: row.id,
    dump_file_path: row.dump_file_path,
    collected_sections: row.collected_sections ? JSON.parse(row.collected_sections) : null,
  };
}

export function updateRawDumpSections(
  dumpId: number,
  collectedSections: string[],
  sectionUpdatedAt?: Record<string, string>
): void {
  const db = getDatabase();
  db.prepare(`UPDATE raw_dumps SET collected_sections = ?, section_updated_at = ? WHERE id = ?`)
    .run(
      JSON.stringify(collectedSections),
      sectionUpdatedAt ? JSON.stringify(sectionUpdatedAt) : null,
      dumpId
    );
}

export function getDumpSectionsUpdatedAt(dumpId: number): Record<string, string> | null {
  const db = getDatabase();
  const row = db.prepare('SELECT section_updated_at FROM raw_dumps WHERE id = ?').get(dumpId) as any;
  if (!row || !row.section_updated_at) return null;
  try {
    return JSON.parse(row.section_updated_at);
  } catch {
    return null;
  }
}

export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function upsertEntity(entity: {
  rusprofile_id?: string;
  type: string;
  value: string;
  label?: string;
  confidence?: number;
  status?: string;
  notes?: string;
  raw_file_path?: string;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalized = normalize(entity.value);

  // Сначала ищем существующую запись
  const existing = db.prepare(
    'SELECT id FROM entities WHERE type = ? AND normalized_value = ?'
  ).get(entity.type, normalized) as { id: number } | undefined;

  if (existing) {
    // Обновляем существующую
    db.prepare(`
      UPDATE entities SET
        rusprofile_id = COALESCE(?, rusprofile_id),
        value = ?,
        label = COALESCE(?, label),
        last_seen = ?,
        confidence = COALESCE(?, confidence),
        status = CASE WHEN ? IS NOT NULL THEN ? ELSE status END,
        notes = COALESCE(?, notes),
        raw_file_path = COALESCE(?, raw_file_path)
      WHERE id = ?
    `).run(
      entity.rusprofile_id || null,
      entity.value,
      entity.label || entity.value,
      now,
      entity.confidence ?? 50,
      entity.status || 'unverified',
      entity.status || 'unverified',
      entity.notes || null,
      entity.raw_file_path || null,
      existing.id
    );
    return existing.id;
  } else {
    // Вставляем новую
    const info = db.prepare(`
      INSERT INTO entities (rusprofile_id, type, value, normalized_value, label, first_seen, last_seen, confidence, status, notes, raw_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entity.rusprofile_id || null,
      entity.type,
      entity.value,
      normalized,
      entity.label || entity.value,
      now,
      now,
      entity.confidence ?? 50,
      entity.status || 'unverified',
      entity.notes || null,
      entity.raw_file_path || null
    );
    return Number(info.lastInsertRowid);
  }
}

export function addSource(source: {
  url: string;
  title?: string;
  source_type?: string;
  source_kind?: string;
  provider?: string;
  collection_method?: string;
  authority_basis?: string;
  reliability?: number;
  access_level?: string;
  retrieved_at?: string;
  local_path?: string;
  sha256?: string;
  notes?: string;
}): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO sources (url, title, source_type, source_kind, provider, collection_method,
      authority_basis, reliability, access_level, retrieved_at, local_path, sha256, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    source.url,
    source.title || null,
    source.source_type || null,
    source.source_kind || null,
    source.provider || null,
    source.collection_method || null,
    source.authority_basis || null,
    source.reliability ?? 50,
    source.access_level || 'public',
    source.retrieved_at || new Date().toISOString(),
    source.local_path || null,
    source.sha256 || null,
    source.notes || null
  );

  return Number(info.lastInsertRowid);
}

export function addRelation(relation: {
  subject_id: number;
  predicate: string;
  object_id: number;
  source_id?: number;
  valid_from?: string;
  valid_to?: string;
  evidence_text?: string;
  confidence?: number;
  status?: string;
  notes?: string;
  raw_file_path?: string;
}): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO relations (subject_id, predicate, object_id, source_id, valid_from,
      valid_to, evidence_text, confidence, status, notes, raw_file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    relation.subject_id,
    relation.predicate,
    relation.object_id,
    relation.source_id || null,
    relation.valid_from || null,
    relation.valid_to || null,
    relation.evidence_text || null,
    relation.confidence ?? 50,
    relation.status || 'unverified',
    relation.notes || null,
    relation.raw_file_path || null
  );
}

export function addObservation(observation: {
  entity_id: number;
  attribute: string;
  value: string;
  source_id?: number;
  confidence?: number;
  notes?: string;
  raw_file_path?: string;
}): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO observations (entity_id, attribute, value, source_id, observed_at, confidence, notes, raw_file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    observation.entity_id,
    observation.attribute,
    observation.value,
    observation.source_id || null,
    new Date().toISOString(),
    observation.confidence ?? 50,
    observation.notes || null,
    observation.raw_file_path || null
  );
}

export function auditChange(
  table_name: string,
  record_id: number,
  action: string,
  old_value: string | null,
  new_value: string | null,
  reason: string
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_at, changed_by, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(table_name, record_id, action, old_value, new_value, new Date().toISOString(), 'system', reason);
}

export function hasRawDumpForInn(inn: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM raw_dumps WHERE company_inn = ? LIMIT 1').get(inn);
  return !!row;
}

export interface DumpListItem {
  company_inn: string;
  company_id_rusprofile: string | null;
  entity_type: string | null;
  entity_name: string | null;
  last_update: string;
  dump_count: number;
}

/**
 * Возвращает список уникальных сущностей, для которых есть дампы.
 * Группирует по (company_inn, company_id_rusprofile).
 */
export function listDumps(): DumpListItem[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      rd.company_inn,
      rd.company_id_rusprofile,
      MAX(rd.created_at) AS last_update,
      COUNT(*) AS dump_count,
      (
        SELECT e.type FROM entities e
        WHERE e.rusprofile_id = rd.company_id_rusprofile
           OR EXISTS (
             SELECT 1 FROM observations o
             WHERE o.entity_id = e.id
               AND o.attribute = 'inn'
               AND o.value = rd.company_inn
           )
        LIMIT 1
      ) AS entity_type,
      (
        SELECT e.label FROM entities e
        WHERE e.rusprofile_id = rd.company_id_rusprofile
           OR EXISTS (
             SELECT 1 FROM observations o
             WHERE o.entity_id = e.id
               AND o.attribute = 'inn'
               AND o.value = rd.company_inn
           )
        LIMIT 1
      ) AS entity_name
    FROM raw_dumps rd
    GROUP BY rd.company_inn, rd.company_id_rusprofile
    ORDER BY last_update DESC
  `).all() as unknown as DumpListItem[];
  return rows;
}

/**
 * Удаляет все дампы (записи и файлы) для конкретной сущности.
 * Возвращает количество удалённых записей и список удалённых файлов.
 */
export function deleteDumpsByEntity(
  companyInn: string,
  companyIdRusprofile: string | null
): { deletedRecords: number; deletedFiles: string[]; fileErrors: string[] } {
  const db = getDatabase();

  // 1. Собираем пути к файлам, которые нужно удалить
  const rows = (companyIdRusprofile
    ? db.prepare(`SELECT id, dump_file_path FROM raw_dumps WHERE company_inn = ? AND company_id_rusprofile = ?`).all(companyInn, companyIdRusprofile)
    : db.prepare(`SELECT id, dump_file_path FROM raw_dumps WHERE company_inn = ?`).all(companyInn)
  ) as { id: number; dump_file_path: string }[];

  const deletedFiles: string[] = [];
  const fileErrors: string[] = [];

  // 2. Удаляем файлы (best-effort)
  const fs = require('fs') as typeof import('fs');
  for (const r of rows) {
    try {
      if (r.dump_file_path && fs.existsSync(r.dump_file_path)) {
        fs.unlinkSync(r.dump_file_path);
        deletedFiles.push(r.dump_file_path);
      }
    } catch (e) {
      fileErrors.push(`${r.dump_file_path}: ${(e as Error).message}`);
    }
  }

  // 3. Удаляем записи из БД
  const result = companyIdRusprofile
    ? db.prepare(`DELETE FROM raw_dumps WHERE company_inn = ? AND company_id_rusprofile = ?`).run(companyInn, companyIdRusprofile)
    : db.prepare(`DELETE FROM raw_dumps WHERE company_inn = ?`).run(companyInn);

  return {
    deletedRecords: Number(result.changes ?? 0),
    deletedFiles,
    fileErrors,
  };
}

/**
 * Поиск сущностей по подстроке в value / label / normalized_value.
 * Опционально можно фильтровать по типу.
 */
export function searchEntities(
  query: string,
  type?: string,
  limit = 100,
  offset = 0
): any[] {
  const db = getDatabase();
  const normalizedQuery = `%${query.trim().toLowerCase()}%`;
  const rawQuery = `%${query.trim()}%`;

  if (type && type !== 'all') {
    return db.prepare(`
      SELECT id, type, value, label, confidence, status, first_seen, last_seen, notes
      FROM entities
      WHERE type = ?
        AND (value LIKE ? OR label LIKE ? OR normalized_value LIKE ?)
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?
    `).all(type, rawQuery, rawQuery, normalizedQuery, limit, offset) as unknown as any[];
  }

  return db.prepare(`
    SELECT id, type, value, label, confidence, status, first_seen, last_seen, notes
    FROM entities
    WHERE value LIKE ? OR label LIKE ? OR normalized_value LIKE ?
    ORDER BY last_seen DESC
    LIMIT ? OFFSET ?
  `).all(rawQuery, rawQuery, normalizedQuery, limit, offset) as unknown as any[];
}

/**
 * Возвращает полную информацию о связи, включая subject/object и источник.
 */
export function getRelationDetails(relationId: number): any | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      r.id,
      r.predicate,
      r.confidence,
      r.status,
      r.valid_from,
      r.valid_to,
      r.evidence_text,
      r.notes,
      r.raw_file_path,
      r.subject_id,
      r.object_id,
      r.source_id,
      s.label AS subject_label,
      s.type  AS subject_type,
      s.value AS subject_value,
      o.label AS object_label,
      o.type  AS object_type,
      o.value AS object_value,
      src.url         AS source_url,
      src.title       AS source_title,
      src.source_type AS source_type,
      src.provider    AS source_provider,
      src.access_level AS source_access_level,
      src.retrieved_at AS source_retrieved_at
    FROM relations r
    JOIN entities s ON s.id = r.subject_id
    JOIN entities o ON o.id = r.object_id
    LEFT JOIN sources src ON src.id = r.source_id
    WHERE r.id = ?
  `).get(relationId) as any;

  return row ?? null;
}

/**
 * Помечает запись в указанной таблице как status='false'.
 * Записывает причину в notes (как в Python-скрипте).
 * Логирует изменение в audit_log.
 */
export function markRecordAsFalse(
  table: 'entities' | 'relations' | 'observations',
  recordId: number,
  reason: string
): { success: boolean; error?: string } {
  const db = getDatabase();

  if (!['entities', 'relations', 'observations'].includes(table)) {
    return { success: false, error: `Недопустимая таблица: ${table}` };
  }

  // Получаем старую запись
  const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(recordId);
  if (!old) {
    return { success: false, error: `Запись с id=${recordId} не найдена в таблице ${table}` };
  }

  // Обновляем: status='false', notes=причина
  db.prepare(`UPDATE ${table} SET status = 'false', notes = ? WHERE id = ?`)
    .run(reason, recordId);

  // Аудит
  auditChange(
    table,
    recordId,
    'mark_false',
    JSON.stringify(old),
    `status=false; reason=${reason}`,
    reason
  );

  return { success: true };
}