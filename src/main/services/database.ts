import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { app } from 'electron';

let db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'osint_data.db');
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initializeSchema(db);
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
      FOREIGN KEY(source_id) REFERENCES sources(id),
      UNIQUE(subject_id, object_id, predicate, COALESCE(evidence_text, ''))
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
      created_at TEXT DEFAULT (datetime('now'))
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

  const caseRow = db.prepare('SELECT id FROM case_info WHERE id = 1').get();
  if (!caseRow) {
    db.prepare(`
      INSERT INTO case_info (id, name, description, status, created_at)
      VALUES (1, ?, ?, ?, ?)
    `).run('OSINT Electron', 'Локальное OSINT-дело', 'active', new Date().toISOString());
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

  const stmt = db.prepare(`
    INSERT INTO entities (rusprofile_id, type, value, normalized_value, label, first_seen, last_seen, confidence, status, notes, raw_file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(type, normalized_value) DO UPDATE SET
      rusprofile_id = COALESCE(excluded.rusprofile_id, entities.rusprofile_id),
      value = excluded.value,
      label = COALESCE(excluded.label, entities.label),
      last_seen = excluded.last_seen,
      confidence = COALESCE(excluded.confidence, entities.confidence),
      status = CASE WHEN excluded.status IS NOT NULL THEN excluded.status ELSE entities.status END,
      notes = COALESCE(excluded.notes, entities.notes),
      raw_file_path = COALESCE(excluded.raw_file_path, entities.raw_file_path)
  `);

  const info = stmt.run(
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