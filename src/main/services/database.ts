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
      status TEXT NOT NULL DEFAULT 'unverified',
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

  // Разовая миграция: схлопываем self-loops и дубли relations.
  try {
    const relDupRow = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM relations WHERE subject_id = object_id) AS self_loops,
        (SELECT COUNT(*) - COUNT(DISTINCT subject_id || '|' || predicate || '|' || object_id)
         FROM relations) AS extra
    `).get() as { self_loops: number; extra: number } | undefined;

    const selfLoops = relDupRow?.self_loops ?? 0;
    const relExtra = relDupRow?.extra ?? 0;

    if (selfLoops > 0) {
      db.exec(`DELETE FROM relations WHERE subject_id = object_id;`);
      console.log(`[db] Миграция relations: удалено ${selfLoops} self-loops`);
    }
    if (relExtra > 0) {
      db.exec(`
        DELETE FROM relations
        WHERE id NOT IN (
          SELECT MAX(id) FROM relations GROUP BY subject_id, predicate, object_id
        );
      `);
      console.log(`[db] Миграция relations: схлопнуто ${relExtra} дубликатов`);
    }
  } catch (e) {
    console.warn(
      '[db] Не удалось схлопнуть self-loops/дубликаты relations:',
      (e as Error).message
    );
  }

  // ← ИЗМЕНЕНО: defense-in-depth против дубликатов связей
  // Уникальный индекс на триплет (subject_id, predicate, object_id).
  // На существующих БД с дубликатами индекс НЕ создастся — тогда в лог
  // упадёт warning, и это сигнал прогнать чистку:
  //   DELETE FROM relations WHERE id NOT IN
  //     (SELECT MAX(id) FROM relations GROUP BY subject_id, predicate, object_id);
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_relations_triple
        ON relations(subject_id, predicate, object_id);
    `);
  } catch (e) {
    console.warn(
      '[db] Не удалось создать ux_relations_triple — в relations, вероятно, есть дубликаты. ' +
      'Чистка: DELETE FROM relations WHERE id NOT IN ' +
      '(SELECT MAX(id) FROM relations GROUP BY subject_id, predicate, object_id);',
      (e as Error).message
    );
  }

  // ← Разовая миграция: схлопываем дубли observations, накопленные
  // до введения UNIQUE-индекса. Порядок важен: DELETE идёт ДО
  // CREATE UNIQUE INDEX, иначе индекс не создастся на «грязной» БД.
  try {
    const dupRow = db.prepare(`
      SELECT COUNT(*) - COUNT(DISTINCT entity_id || '|' || attribute || '|' || value) AS extra
      FROM observations
    `).get() as { extra: number } | undefined;
    const extra = dupRow?.extra ?? 0;
    if (extra > 0) {
      db.exec(`
        DELETE FROM observations
        WHERE id NOT IN (
          SELECT MAX(id) FROM observations GROUP BY entity_id, attribute, value
        );
      `);
      console.log(`[db] Миграция observations: схлопнуто ${extra} дубликатов`);
    }
  } catch (e) {
    console.warn(
      '[db] Не удалось схлопнуть дубликаты observations:',
      (e as Error).message
    );
  }

  // defense-in-depth: одно (entity_id, attribute, value) = одна строка.
  // На этом этапе дубли уже удалены выше, индекс создастся всегда.
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_observations_triple
        ON observations(entity_id, attribute, value);
    `);
  } catch (e) {
    console.warn(
      '[db] Не удалось создать ux_observations_triple: ' + (e as Error).message
    );
  }

  // Миграция: добавляем поле origin во все таблицы с данными
  const tablesWithOrigin = ['entities', 'relations', 'observations', 'sources'];
  for (const table of tablesWithOrigin) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === 'origin')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN origin TEXT NOT NULL DEFAULT 'scraper';`);
      console.log(`Добавлена колонка origin в ${table}`);
    }
  }

  // Миграция: добавляем status в observations для старых БД.
  // В CREATE TABLE status уже есть, но существующие таблицы
  // IF NOT EXISTS не трогает — а markRecordAsFalse использует
  // эту колонку, из-за чего пометка наблюдения как ложного
  // падала с «no such column: status».
  const obsCols = db.prepare(`PRAGMA table_info(observations)`).all() as { name: string }[];
  if (!obsCols.some((c) => c.name === 'status')) {
    db.exec(`ALTER TABLE observations ADD COLUMN status TEXT NOT NULL DEFAULT 'unverified';`);
    console.log('Добавлена колонка status в observations');
  }

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

/**
 * Создаёт сущность вручную (origin='manual').
 * Возвращает id или ошибку (в частности, если такая сущность уже есть).
 */
export function createEntity(patch: {
  type: string;
  value: string;
  label?: string | null;
  confidence?: number | null;
  status?: string | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalized = normalize(patch.value);

  try {
    const info = db.prepare(`
      INSERT INTO entities
        (type, value, normalized_value, label, first_seen, last_seen,
         confidence, status, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.type,
      patch.value,
      normalized,
      patch.label || patch.value,
      now,
      now,
      patch.confidence ?? 50,
      patch.status || 'unverified',
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'entities',
      id,
      'create',
      null,
      `type=${patch.type}; value=${patch.value}; origin=manual`,
      'Ручное создание сущности через UI'
    );

    return { success: true, id };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return {
        success: false,
        error: 'Сущность с таким типом и значением уже существует',
      };
    }
    return { success: false, error: msg };
  }
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
  origin?: 'scraper' | 'manual' | 'import';
  overwriteManual?: boolean;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalized = normalize(entity.value);
  const origin = entity.origin || 'scraper';

  const existing = db.prepare(
    'SELECT id, origin FROM entities WHERE type = ? AND normalized_value = ?'
  ).get(entity.type, normalized) as { id: number; origin: string } | undefined;

  if (existing) {
    if (existing.origin === 'manual' && !entity.overwriteManual) {
      console.log(`[upsertEntity] Пропущена ручная сущность #${existing.id} (${entity.value})`);
      return existing.id;
    }

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
  }

  const info = db.prepare(`
    INSERT INTO entities
      (rusprofile_id, type, value, normalized_value, label, first_seen, last_seen,
       confidence, status, notes, raw_file_path, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    entity.raw_file_path || null,
    origin
  );
  return Number(info.lastInsertRowid);
}

export function updateEntity(
  entityId: number,
  patch: {
    type?: string;
    value?: string;
    label?: string | null;
    confidence?: number | null;
    status?: string | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as any;
  if (!old) {
    return { success: false, error: `Сущность #${entityId} не найдена` };
  }

  const type = patch.type ?? old.type;
  const value = patch.value ?? old.value;
  const label = patch.label !== undefined ? patch.label : old.label;
  const confidence = patch.confidence !== undefined ? patch.confidence : old.confidence;
  const status = patch.status !== undefined ? patch.status : old.status;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const normalized = normalize(value);
  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE entities
      SET type = ?,
          value = ?,
          normalized_value = ?,
          label = ?,
          last_seen = ?,
          confidence = ?,
          status = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(
      type,
      value,
      normalized,
      label,
      new Date().toISOString(),
      confidence,
      status,
      notes,
      newOrigin,
      entityId
    );
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'entities',
    entityId,
    'update',
    JSON.stringify(old),
    `type=${type}; value=${value}; status=${status}; confidence=${confidence}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование сущности через UI'
  );

  return { success: true };
}


/**
 * Создаёт источник вручную (origin='manual').
 */
export function createSource(patch: {
  url: string;
  title?: string | null;
  source_type?: string | null;
  source_kind?: string | null;
  provider?: string | null;
  collection_method?: string | null;
  authority_basis?: string | null;
  reliability?: number | null;
  access_level?: string | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();

  if (!patch.url?.trim()) {
    return { success: false, error: 'Укажите URL или локальный путь' };
  }

  try {
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO sources
        (url, title, source_type, source_kind, provider,
         collection_method, authority_basis, reliability,
         access_level, retrieved_at, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.url.trim(),
      patch.title || null,
      patch.source_type || null,
      patch.source_kind || null,
      patch.provider || null,
      patch.collection_method || null,
      patch.authority_basis || null,
      patch.reliability ?? 50,
      patch.access_level || 'public',
      now,
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'sources',
      id,
      'create',
      null,
      `url=${patch.url}; origin=manual`,
      'Ручное создание источника через UI'
    );

    return { success: true, id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
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

/**
 * Создаёт связь вручную (origin='manual').
 */
/**
 * Создаёт связь вручную (origin='manual').
 */
export function createRelation(patch: {
  subject_id: number;
  predicate: string;
  object_id: number;
  source_id?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  evidence_text?: string | null;
  confidence?: number | null;
  status?: string | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();

  if (!patch.subject_id || !patch.object_id) {
    return { success: false, error: 'Не выбраны участники связи' };
  }
  if (patch.subject_id === patch.object_id) {
    return { success: false, error: 'Исходная и целевая сущности не могут совпадать' };
  }
  if (!patch.predicate?.trim()) {
    return { success: false, error: 'Укажите тип связи (predicate)' };
  }

  try {
    const info = db.prepare(`
      INSERT INTO relations
        (subject_id, predicate, object_id, source_id,
         valid_from, valid_to, evidence_text,
         confidence, status, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.subject_id,
      patch.predicate.trim(),
      patch.object_id,
      patch.source_id || null,
      patch.valid_from || null,
      patch.valid_to || null,
      patch.evidence_text || null,
      patch.confidence ?? 50,
      patch.status || 'unverified',
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'relations',
      id,
      'create',
      null,
      `subject=${patch.subject_id}; predicate=${patch.predicate}; object=${patch.object_id}; origin=manual`,
      'Ручное создание связи через UI'
    );

    return { success: true, id };
  } catch (e) {
    // ← ИЗМЕНЕНО: распознаём UNIQUE-конфликт (сработает ux_relations_triple)
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return {
        success: false,
        error: 'Такая связь уже существует (subject + predicate + object)',
      };
    }
    return { success: false, error: msg };
  }
}

/**
 * Возвращает плоский список сущностей для dropdown'ов:
 * [{ id, type, label, value }]
 */
export function listEntitiesForDropdown(): Array<{
  id: number;
  type: string;
  label: string;
}> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, type, COALESCE(label, value) AS label
    FROM entities
    ORDER BY label COLLATE NOCASE ASC
  `).all() as Array<{ id: number; type: string; label: string }>;
  return rows;
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
}): { inserted: boolean; id?: number } {
  const db = getDatabase();

  // 1. Не создавать self-loop
  if (relation.subject_id === relation.object_id) {
    console.warn(
      `[addRelation] Пропущена самосвязь: entity #${relation.subject_id} --${relation.predicate}--> сама себя`
    );
    return { inserted: false };
  }

  // ← ИЗМЕНЕНО: guard на пустой predicate
  if (!relation.predicate?.trim()) {
    console.warn('[addRelation] Пустой predicate — запись пропущена');
    return { inserted: false };
  }

  // 2. Проверить дубликат
  const existing = db.prepare(`
    SELECT id FROM relations
    WHERE subject_id = ?
      AND predicate = ?
      AND object_id = ?
    LIMIT 1
  `).get(relation.subject_id, relation.predicate, relation.object_id) as { id: number } | undefined;

  if (existing) {
    // Обновить confidence/source, если они не заданы у существующей
    db.prepare(`
      UPDATE relations
      SET source_id = COALESCE(source_id, ?),
          evidence_text = COALESCE(evidence_text, ?),
          confidence = CASE WHEN confidence IS NULL THEN ? ELSE confidence END,
          raw_file_path = COALESCE(raw_file_path, ?)
      WHERE id = ?
    `).run(
      relation.source_id || null,
      relation.evidence_text || null,
      relation.confidence ?? 50,
      relation.raw_file_path || null,
      existing.id
    );
    return { inserted: false, id: existing.id };
  }

  // 3. Вставить новую
  // ← ИЗМЕНЕНО: оборачиваем в try/catch и обрабатываем UNIQUE-конфликт
  // (теоретическое TOCTOU-окно между SELECT и INSERT; node:sqlite
  //  синхронный, но подстраховаться не вредно — плюс общий UNIQUE-индекс).
  try {
    const info = db.prepare(`
      INSERT INTO relations
        (subject_id, predicate, object_id, source_id, valid_from, valid_to,
         evidence_text, confidence, status, notes, raw_file_path)
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

    return { inserted: true, id: Number(info.lastInsertRowid) };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      // Кто-то успел вставить между SELECT и INSERT — вернём существующий id
      const again = db.prepare(`
        SELECT id FROM relations
        WHERE subject_id = ? AND predicate = ? AND object_id = ?
        LIMIT 1
      `).get(relation.subject_id, relation.predicate, relation.object_id) as
        | { id: number }
        | undefined;
      if (again) return { inserted: false, id: again.id };
    }
    throw e;
  }
}

/**
 * Создаёт наблюдение вручную (origin='manual').
 */
export function createObservation(patch: {
  entity_id: number;
  attribute: string;
  value: string;
  source_id?: number | null;
  confidence?: number | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();

  if (!patch.entity_id) {
    return { success: false, error: 'Не выбрана сущность' };
  }
  if (!patch.attribute?.trim()) {
    return { success: false, error: 'Укажите атрибут' };
  }
  if (!patch.value?.trim()) {
    return { success: false, error: 'Укажите значение' };
  }

  try {
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO observations
        (entity_id, attribute, value, source_id,
         observed_at, confidence, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.entity_id,
      patch.attribute.trim(),
      patch.value.trim(),
      patch.source_id || null,
      now,
      patch.confidence ?? 50,
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'observations',
      id,
      'create',
      null,
      `entity=${patch.entity_id}; attribute=${patch.attribute}; value=${patch.value}; origin=manual`,
      'Ручное создание наблюдения через UI'
    );

    return { success: true, id };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return {
        success: false,
        error: 'Такое наблюдение уже существует (entity + attribute + value)',
      };
    }
    return { success: false, error: msg };
  }
}

export function addObservation(observation: {
  entity_id: number;
  attribute: string;
  value: string;
  source_id?: number;
  confidence?: number;
  notes?: string;
  raw_file_path?: string;
}): { inserted: boolean; id: number } {
  const db = getDatabase();

  // Guard: пустые attribute/value не пишем
  if (!observation.attribute?.trim() || !observation.value?.trim()) {
    console.warn(
      `[addObservation] Пропущены пустые attribute/value: entity=${observation.entity_id}`
    );
    return { inserted: false, id: 0 };
  }

  // 1. Проверить существующую запись
  const existing = db.prepare(`
    SELECT id FROM observations
    WHERE entity_id = ? AND attribute = ? AND value = ?
    LIMIT 1
  `).get(
    observation.entity_id,
    observation.attribute,
    observation.value
  ) as { id: number } | undefined;

  if (existing) {
    // Обновляем «видели ещё раз»: observed_at свежий, остальное — COALESCE
    db.prepare(`
      UPDATE observations
      SET observed_at = ?,
          source_id = COALESCE(source_id, ?),
          confidence = COALESCE(confidence, ?),
          raw_file_path = COALESCE(raw_file_path, ?)
      WHERE id = ?
    `).run(
      new Date().toISOString(),
      observation.source_id || null,
      observation.confidence ?? 50,
      observation.raw_file_path || null,
      existing.id
    );
    return { inserted: false, id: existing.id };
  }

  // 2. Вставить новую (с обработкой UNIQUE на случай TOCTOU)
  try {
    const info = db.prepare(`
      INSERT INTO observations
        (entity_id, attribute, value, source_id, observed_at, confidence, notes, raw_file_path)
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
    return { inserted: true, id: Number(info.lastInsertRowid) };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      const again = db.prepare(`
        SELECT id FROM observations
        WHERE entity_id = ? AND attribute = ? AND value = ?
        LIMIT 1
      `).get(
        observation.entity_id,
        observation.attribute,
        observation.value
      ) as { id: number } | undefined;
      if (again) return { inserted: false, id: again.id };
    }
    throw e;
  }
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
 * Поиск сущностей по подстроке в value / label / normalized_value / notes.
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
        AND (value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?)
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?
    `).all(type, rawQuery, rawQuery, normalizedQuery, rawQuery, limit, offset) as unknown as any[];
  }

  return db.prepare(`
    SELECT id, type, value, label, confidence, status, first_seen, last_seen, notes
    FROM entities
    WHERE value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?
    ORDER BY last_seen DESC
    LIMIT ? OFFSET ?
  `).all(rawQuery, rawQuery, normalizedQuery, rawQuery, limit, offset) as unknown as any[];
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
      r.origin,
      r.subject_id,
      r.object_id,
      r.source_id,
      s.label AS subject_label,
      s.type  AS subject_type,
      s.value AS subject_value,
      o.label AS object_label,
      o.type  AS object_type,
      o.value AS object_value,
      src.url          AS source_url,
      src.title        AS source_title,
      src.source_type  AS source_type,
      src.provider     AS source_provider,
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
 * Переводит origin в 'manual' (чтобы скрапер не перезаписал).
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

  const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(recordId) as any;
  if (!old) {
    return { success: false, error: `Запись с id=${recordId} не найдена в таблице ${table}` };
  }

  const oldOrigin = old.origin || 'scraper';

  db.prepare(`
    UPDATE ${table}
    SET status = 'false',
        notes = ?,
        origin = 'manual'
    WHERE id = ?
  `).run(reason, recordId);

  auditChange(
    table,
    recordId,
    'mark_false',
    JSON.stringify(old),
    `status=false; reason=${reason}; origin=${oldOrigin}→manual`,
    reason
  );

  return { success: true };
}

/**
 * Массовая пометка записей как ложных (best-effort).
 * Помечает то, что смог; неудачные id складывает в errors.
 * Всё выполняется внутри одной транзакции — быстро и консистентно
 * по отношению к внешним читателям.
 */
export function markRecordsAsFalse(
  table: 'entities' | 'relations' | 'observations',
  recordIds: number[],
  reason: string
): {
  success: boolean;
  updated: number;
  failed: number;
  errors: { id: number; error: string }[];
} {
  const db = getDatabase();

  if (!['entities', 'relations', 'observations'].includes(table)) {
    return {
      success: false,
      updated: 0,
      failed: 0,
      errors: [{ id: 0, error: `Недопустимая таблица: ${table}` }],
    };
  }

  if (!Array.isArray(recordIds) || recordIds.length === 0) {
    return {
      success: false,
      updated: 0,
      failed: 0,
      errors: [{ id: 0, error: 'Пустой список id' }],
    };
  }

  if (!reason || !reason.trim()) {
    return {
      success: false,
      updated: 0,
      failed: 0,
      errors: [{ id: 0, error: 'Не указана причина' }],
    };
  }

  let updated = 0;
  let failed = 0;
  const errors: { id: number; error: string }[] = [];

  // Транзакция для скорости (одна запись WAL на батч вместо N).
  // Best-effort: исключения от отдельных записей ловим и продолжаем.
  try {
    db.exec('BEGIN');
    try {
      for (const id of recordIds) {
        try {
          const r = markRecordAsFalse(table, id, reason);
          if (r.success) {
            updated++;
          } else {
            failed++;
            errors.push({ id, error: r.error || 'неизвестная ошибка' });
          }
        } catch (e) {
          failed++;
          errors.push({ id, error: (e as Error).message });
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (e) {
    return {
      success: false,
      updated: 0,
      failed: recordIds.length,
      errors: [{ id: 0, error: (e as Error).message }],
    };
  }

  return { success: true, updated, failed, errors };
}

/**
 * Возвращает полную информацию о сущности: поля, наблюдения, связи (в обе стороны), источники.
 */
export function getEntityDetails(entityId: number): any | null {
  const db = getDatabase();

  const entity = db.prepare(`
    SELECT id, type, value, normalized_value, label, confidence, status,
           first_seen, last_seen, notes, rusprofile_id, raw_file_path, origin
    FROM entities
    WHERE id = ?
  `).get(entityId) as any;

  if (!entity) return null;

  const observations = db.prepare(`
    SELECT o.id, o.attribute, o.value, o.confidence, o.observed_at, o.notes,
           o.source_id, o.origin,
           s.url AS source_url, s.title AS source_title, s.provider AS source_provider
    FROM observations o
    LEFT JOIN sources s ON s.id = o.source_id
    WHERE o.entity_id = ?
    ORDER BY o.id DESC
  `).all(entityId) as any[];

  const relationsOut = db.prepare(`
    SELECT r.id, r.predicate, r.confidence, r.status, r.evidence_text,
           r.valid_from, r.valid_to, r.source_id, r.origin,
           e.id AS object_id, e.label AS object_label, e.type AS object_type,
           s.url AS source_url, s.title AS source_title
    FROM relations r
    JOIN entities e ON e.id = r.object_id
    LEFT JOIN sources s ON s.id = r.source_id
    WHERE r.subject_id = ?
    ORDER BY r.id DESC
  `).all(entityId) as any[];

  const relationsIn = db.prepare(`
    SELECT r.id, r.predicate, r.confidence, r.status, r.evidence_text,
           r.valid_from, r.valid_to, r.source_id, r.origin,
           e.id AS subject_id, e.label AS subject_label, e.type AS subject_type,
           s.url AS source_url, s.title AS source_title
    FROM relations r
    JOIN entities e ON e.id = r.subject_id
    LEFT JOIN sources s ON s.id = r.source_id
    WHERE r.object_id = ?
    ORDER BY r.id DESC
  `).all(entityId) as any[];

  const sources = db.prepare(`
    SELECT DISTINCT s.id, s.url, s.title, s.source_type, s.provider,
           s.access_level, s.retrieved_at, s.origin
    FROM sources s
    WHERE s.id IN (
      SELECT source_id FROM observations WHERE entity_id = ? AND source_id IS NOT NULL
      UNION
      SELECT source_id FROM relations WHERE (subject_id = ? OR object_id = ?) AND source_id IS NOT NULL
    )
    ORDER BY s.id DESC
  `).all(entityId, entityId, entityId) as any[];

  return {
    entity,
    observations,
    relations_out: relationsOut,
    relations_in: relationsIn,
    sources,
  };
}

/**
 * Возвращает полную информацию о наблюдении, включая связанную сущность и источник.
 */
export function getObservationDetails(observationId: number): any | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT
      o.id,
      o.entity_id,
      o.attribute,
      o.value,
      o.source_id,
      o.observed_at,
      o.confidence,
      o.notes,
      o.raw_file_path,
      o.origin,
      e.type  AS entity_type,
      e.label AS entity_label,
      e.value AS entity_value,
      s.url           AS source_url,
      s.title         AS source_title,
      s.source_type   AS source_type,
      s.source_kind   AS source_kind,
      s.provider      AS source_provider,
      s.access_level  AS source_access_level,
      s.retrieved_at  AS source_retrieved_at
    FROM observations o
    JOIN entities e ON e.id = o.entity_id
    LEFT JOIN sources s ON s.id = o.source_id
    WHERE o.id = ?
  `).get(observationId) as any;

  return row ?? null;
}

/**
 * Возвращает полную информацию об источнике: поля + связанные наблюдения, связи и сущности.
 */
export function getSourceDetails(sourceId: number): any | null {
  const db = getDatabase();

  const source = db.prepare(`
    SELECT id, url, title, source_type, source_kind, provider, collection_method,
           authority_basis, reliability, access_level, retrieved_at,
           local_path, sha256, notes, origin
    FROM sources
    WHERE id = ?
  `).get(sourceId) as any;

  if (!source) return null;

  const observations = db.prepare(`
    SELECT o.id, o.attribute, o.value, o.confidence, o.observed_at, o.origin,
           e.id AS entity_id, e.label AS entity_label, e.type AS entity_type
    FROM observations o
    JOIN entities e ON e.id = o.entity_id
    WHERE o.source_id = ?
    ORDER BY o.id DESC
  `).all(sourceId) as any[];

  const relations = db.prepare(`
    SELECT r.id, r.predicate, r.confidence, r.status, r.evidence_text,
           r.valid_from, r.valid_to, r.origin,
           s.id AS subject_id, s.label AS subject_label, s.type AS subject_type,
           o.id AS object_id,  o.label AS object_label,  o.type AS object_type
    FROM relations r
    JOIN entities s ON s.id = r.subject_id
    JOIN entities o ON o.id = r.object_id
    WHERE r.source_id = ?
    ORDER BY r.id DESC
  `).all(sourceId) as any[];

  const entities = db.prepare(`
    SELECT DISTINCT e.id, e.type, e.label, e.value, e.origin
    FROM entities e
    WHERE e.id IN (
      SELECT entity_id FROM observations WHERE source_id = ?
      UNION
      SELECT subject_id FROM relations WHERE source_id = ?
      UNION
      SELECT object_id FROM relations WHERE source_id = ?
    )
    ORDER BY e.id DESC
  `).all(sourceId, sourceId, sourceId) as any[];

  return {
    source,
    observations,
    relations,
    entities,
  };
}

export interface RelatedIds {
  entityIds: number[];
  relationIds: number[];
  observationIds: number[];
  sourceIds: number[];
}

/**
 * Возвращает ID связанных записей для каскадного фильтра.
 * Например, если filterType='entity' и filterId=69, то вернёт:
 * - entityIds: [69] + все сущности, с которыми #69 связана через relations
 * - relationIds: все связи, где #69 — subject или object
 * - observationIds: все наблюдения сущности #69
 * - sourceIds: все источники, упомянутые в этих связях и наблюдениях
 */
export function getRelatedIds(
  filterType: 'entity' | 'relation' | 'observation' | 'source',
  filterId: number
): RelatedIds {
  const db = getDatabase();
  const entityIds = new Set<number>();
  const relationIds = new Set<number>();
  const observationIds = new Set<number>();
  const sourceIds = new Set<number>();

  const loadObservationsByEntities = (ids: number[]) => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`SELECT id, source_id FROM observations WHERE entity_id IN (${placeholders})`)
      .all(...ids)
      .forEach((o: any) => {
        observationIds.add(o.id);
        if (o.source_id) sourceIds.add(o.source_id);
      });
  };

  const loadRelationsByEntities = (ids: number[]) => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`SELECT id, subject_id, object_id, source_id FROM relations
                WHERE subject_id IN (${placeholders}) OR object_id IN (${placeholders})`)
      .all(...ids, ...ids)
      .forEach((r: any) => {
        relationIds.add(r.id);
        entityIds.add(r.subject_id);
        entityIds.add(r.object_id);
        if (r.source_id) sourceIds.add(r.source_id);
      });
  };

  const loadRelationsBySource = (sourceId: number) => {
    db.prepare(`SELECT id, subject_id, object_id FROM relations WHERE source_id = ?`)
      .all(sourceId)
      .forEach((r: any) => {
        relationIds.add(r.id);
        entityIds.add(r.subject_id);
        entityIds.add(r.object_id);
      });
  };

  if (filterType === 'entity') {
    entityIds.add(filterId);
    loadRelationsByEntities([filterId]);
    loadObservationsByEntities([filterId]);
  }

  if (filterType === 'relation') {
    relationIds.add(filterId);
    const rel = db.prepare(`SELECT subject_id, object_id, source_id FROM relations WHERE id = ?`).get(filterId) as any;
    if (rel) {
      entityIds.add(rel.subject_id);
      entityIds.add(rel.object_id);
      loadRelationsByEntities([rel.subject_id, rel.object_id]);
      loadObservationsByEntities([rel.subject_id, rel.object_id]);
      if (rel.source_id) sourceIds.add(rel.source_id);
    }
  }

  if (filterType === 'observation') {
    observationIds.add(filterId);
    const obs = db.prepare(`SELECT entity_id, source_id FROM observations WHERE id = ?`).get(filterId) as any;
    if (obs) {
      entityIds.add(obs.entity_id);
      loadRelationsByEntities([obs.entity_id]);
      loadObservationsByEntities([obs.entity_id]);
      if (obs.source_id) sourceIds.add(obs.source_id);
    }
  }

  if (filterType === 'source') {
    sourceIds.add(filterId);
    db.prepare(`SELECT id, entity_id FROM observations WHERE source_id = ?`)
      .all(filterId)
      .forEach((o: any) => {
        observationIds.add(o.id);
        entityIds.add(o.entity_id);
      });
    loadRelationsBySource(filterId);
    // Подтянем также наблюдения связанных сущностей, чтобы картина была полной
    loadObservationsByEntities([...entityIds]);
  }

  return {
    entityIds: [...entityIds],
    relationIds: [...relationIds],
    observationIds: [...observationIds],
    sourceIds: [...sourceIds],
  };
}

export function markEntityAsManual(entityId: number): void {
  const db = getDatabase();
  db.prepare(`UPDATE entities SET origin = 'manual' WHERE id = ?`).run(entityId);
}

export function updateRelation(
  relationId: number,
  patch: {
    predicate?: string;
    confidence?: number | null;
    status?: string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    evidence_text?: string | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM relations WHERE id = ?').get(relationId) as any;
  if (!old) {
    return { success: false, error: `Связь #${relationId} не найдена` };
  }

  const predicate = patch.predicate ?? old.predicate;
  const confidence = patch.confidence !== undefined ? patch.confidence : old.confidence;
  const status = patch.status !== undefined ? patch.status : old.status;
  const valid_from = patch.valid_from !== undefined ? patch.valid_from : old.valid_from;
  const valid_to = patch.valid_to !== undefined ? patch.valid_to : old.valid_to;
  const evidence_text = patch.evidence_text !== undefined ? patch.evidence_text : old.evidence_text;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE relations
      SET predicate = ?,
          confidence = ?,
          status = ?,
          valid_from = ?,
          valid_to = ?,
          evidence_text = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(
      predicate,
      confidence,
      status,
      valid_from,
      valid_to,
      evidence_text,
      notes,
      newOrigin,
      relationId
    );
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'relations',
    relationId,
    'update',
    JSON.stringify(old),
    `predicate=${predicate}; status=${status}; confidence=${confidence}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование связи через UI'
  );

  return { success: true };
}

export function updateObservation(
  observationId: number,
  patch: {
    attribute?: string;
    value?: string;
    confidence?: number | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM observations WHERE id = ?').get(observationId) as any;
  if (!old) {
    return { success: false, error: `Наблюдение #${observationId} не найдено` };
  }

  const attribute = patch.attribute ?? old.attribute;
  const value = patch.value ?? old.value;
  const confidence = patch.confidence !== undefined ? patch.confidence : old.confidence;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE observations
      SET attribute = ?,
          value = ?,
          confidence = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(attribute, value, confidence, notes, newOrigin, observationId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'observations',
    observationId,
    'update',
    JSON.stringify(old),
    `attribute=${attribute}; value=${value}; confidence=${confidence}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование наблюдения через UI'
  );

  return { success: true };
}

export function updateSource(
  sourceId: number,
  patch: {
    url?: string;
    title?: string | null;
    source_type?: string | null;
    source_kind?: string | null;
    provider?: string | null;
    collection_method?: string | null;
    authority_basis?: string | null;
    reliability?: number | null;
    access_level?: string | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as any;
  if (!old) {
    return { success: false, error: `Источник #${sourceId} не найден` };
  }

  const url = patch.url ?? old.url;
  const title = patch.title !== undefined ? patch.title : old.title;
  const source_type = patch.source_type !== undefined ? patch.source_type : old.source_type;
  const source_kind = patch.source_kind !== undefined ? patch.source_kind : old.source_kind;
  const provider = patch.provider !== undefined ? patch.provider : old.provider;
  const collection_method = patch.collection_method !== undefined ? patch.collection_method : old.collection_method;
  const authority_basis = patch.authority_basis !== undefined ? patch.authority_basis : old.authority_basis;
  const reliability = patch.reliability !== undefined ? patch.reliability : old.reliability;
  const access_level = patch.access_level !== undefined ? patch.access_level : old.access_level;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE sources
      SET url = ?,
          title = ?,
          source_type = ?,
          source_kind = ?,
          provider = ?,
          collection_method = ?,
          authority_basis = ?,
          reliability = ?,
          access_level = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(
      url, title, source_type, source_kind, provider,
      collection_method, authority_basis, reliability, access_level,
      notes, newOrigin, sourceId
    );
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'sources',
    sourceId,
    'update',
    JSON.stringify(old),
    `url=${url}; reliability=${reliability}; access_level=${access_level}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование источника через UI'
  );

  return { success: true };
}

/**
 * Удаляет наблюдение. Никаких зависимостей, кроме самого наблюдения.
 */
export function deleteObservation(observationId: number): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM observations WHERE id = ?').get(observationId) as any;
  if (!old) {
    return { success: false, error: `Наблюдение #${observationId} не найдено` };
  }

  try {
    db.prepare('DELETE FROM observations WHERE id = ?').run(observationId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'observations',
    observationId,
    'delete',
    JSON.stringify(old),
    null,
    'Удаление наблюдения через UI'
  );

  return { success: true };
}

/**
 * Удаляет связь.
 */
export function deleteRelation(relationId: number): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM relations WHERE id = ?').get(relationId) as any;
  if (!old) {
    return { success: false, error: `Связь #${relationId} не найдена` };
  }

  try {
    db.prepare('DELETE FROM relations WHERE id = ?').run(relationId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'relations',
    relationId,
    'delete',
    JSON.stringify(old),
    null,
    'Удаление связи через UI'
  );

  return { success: true };
}

/**
 * Удаляет источник. Если на него ссылаются наблюдения/связи — по умолчанию
 * операция блокируется (чтобы не терять данные).
 * Если force=true — ссылки обнуляются (source_id = NULL), затем источник удаляется.
 */
export function deleteSource(
  sourceId: number,
  force = false
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as any;
  if (!old) {
    return { success: false, error: `Источник #${sourceId} не найден` };
  }

  const obsCount = (db.prepare('SELECT COUNT(*) AS c FROM observations WHERE source_id = ?').get(sourceId) as any).c;
  const relCount = (db.prepare('SELECT COUNT(*) AS c FROM relations WHERE source_id = ?').get(sourceId) as any).c;

  if ((obsCount > 0 || relCount > 0) && !force) {
    return {
      success: false,
      error: `Источник используется: ${obsCount} наблюдений, ${relCount} связей. Используйте force=true или сначала отвяжите записи.`,
    };
  }

  try {
    if (force) {
      db.prepare('UPDATE observations SET source_id = NULL WHERE source_id = ?').run(sourceId);
      db.prepare('UPDATE relations SET source_id = NULL WHERE source_id = ?').run(sourceId);
    }
    db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'sources',
    sourceId,
    'delete',
    JSON.stringify(old),
    force ? `force=true; отвязано наблюдений=${obsCount}, связей=${relCount}` : null,
    'Удаление источника через UI'
  );

  return { success: true };
}

/**
 * Удаляет сущность. По умолчанию — только если на неё нет ссылок.
 * Если force=true — каскадно удаляет её наблюдения и все связи, где она участвует,
 * затем саму сущность.
 */
export function deleteEntity(
  entityId: number,
  force = false
): { success: boolean; error?: string; stats?: { observations: number; relations: number } } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as any;
  if (!old) {
    return { success: false, error: `Сущность #${entityId} не найдена` };
  }

  const obsCount = (db.prepare('SELECT COUNT(*) AS c FROM observations WHERE entity_id = ?').get(entityId) as any).c;
  const relCount = (db.prepare('SELECT COUNT(*) AS c FROM relations WHERE subject_id = ? OR object_id = ?').get(entityId, entityId) as any).c;

  if ((obsCount > 0 || relCount > 0) && !force) {
    return {
      success: false,
      error: `На сущность ссылаются: ${obsCount} наблюдений, ${relCount} связей. Используйте force=true для каскадного удаления.`,
      stats: { observations: obsCount, relations: relCount },
    };
  }

  try {
    if (force) {
      db.prepare('DELETE FROM observations WHERE entity_id = ?').run(entityId);
      db.prepare('DELETE FROM relations WHERE subject_id = ? OR object_id = ?').run(entityId, entityId);
    }
    db.prepare('DELETE FROM entities WHERE id = ?').run(entityId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'entities',
    entityId,
    'delete',
    JSON.stringify(old),
    force ? `force=true; удалено наблюдений=${obsCount}, связей=${relCount}` : null,
    'Удаление сущности через UI'
  );

  return { success: true, stats: { observations: obsCount, relations: relCount } };
}

/**
 * Полная очистка всех таблиц с данными (кроме case_info).
 * Порядок удаления важен из-за FK.
 */
export function clearAllTables(): { success: boolean; error?: string } {
  const db = getDatabase();

  try {
    // Удаляем в правильном порядке (сначала зависимые)
    db.exec('DELETE FROM relations;');
    db.exec('DELETE FROM observations;');
    db.exec('DELETE FROM entities;');
    db.exec('DELETE FROM sources;');
    db.exec('DELETE FROM raw_dumps;');
    db.exec('DELETE FROM audit_log;');
    db.exec('DELETE FROM shards;');
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'case_info',
    1,
    'clear_all',
    null,
    'Все таблицы данных очищены',
    'Полная очистка базы через UI'
  );

  return { success: true };
}

export interface AuditLogEntry {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
}

export interface AuditLogFilters {
  table_name?: string | null;
  action?: string | null;
  /** ISO-дата, включительно. Формат YYYY-MM-DD. */
  date_from?: string | null;
  date_to?: string | null;
  /** Поиск по reason / new_value. */
  search?: string | null;
}

export function getAuditLog(
  filters: AuditLogFilters = {},
  limit = 200,
  offset = 0
): { items: AuditLogEntry[]; total: number } {
  const db = getDatabase();

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.table_name) {
    conditions.push('table_name = ?');
    params.push(filters.table_name);
  }
  if (filters.action) {
    conditions.push('action = ?');
    params.push(filters.action);
  }
  if (filters.date_from) {
    conditions.push('changed_at >= ?');
    params.push(`${filters.date_from}T00:00:00.000Z`);
  }
  if (filters.date_to) {
    conditions.push('changed_at <= ?');
    params.push(`${filters.date_to}T23:59:59.999Z`);
  }
  if (filters.search) {
    conditions.push('(reason LIKE ? OR new_value LIKE ? OR old_value LIKE ?)');
    const q = `%${filters.search}%`;
    params.push(q, q, q);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(
    `SELECT COUNT(*) AS c FROM audit_log ${where}`
  ).get(...params) as any).c;

  const items = db.prepare(`
    SELECT id, table_name, record_id, action, old_value, new_value,
           changed_at, changed_by, reason
    FROM audit_log
    ${where}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as unknown as AuditLogEntry[];

  return { items, total };
}

/** Список уникальных table_name для dropdown-фильтра. */
export function listAuditLogTables(): string[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT DISTINCT table_name FROM audit_log ORDER BY table_name ASC'
  ).all() as Array<{ table_name: string }>;
  return rows.map((r) => r.table_name);
}

/** Список уникальных action для dropdown-фильтра. */
export function listAuditLogActions(): string[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT DISTINCT action FROM audit_log ORDER BY action ASC'
  ).all() as Array<{ action: string }>;
  return rows.map((r) => r.action);
}

// ============ Полнотекстовый поиск ============

export type SearchHitKind = 'entity' | 'relation' | 'observation' | 'source';

export interface SearchHit {
  kind: SearchHitKind;
  id: number;
  title: string;
  subtitle: string;
  matched_field: string;
  matched_value: string;
}

export interface SearchAllResult {
  items: SearchHit[];
  total: number;
  counts: Record<SearchHitKind, number>;
  /** Прямые совпадения (то, что реально нашлось по LIKE). */
  matchedIds: {
    entities: number[];
    relations: number[];
    observations: number[];
    sources: number[];
  };
  /** Финальный union: matchedIds ∪ всё связанное с найденными сущностями.
   *  Именно это множество показывается в таблицах UI. */
  unionIds: {
    entities: number[];
    relations: number[];
    observations: number[];
    sources: number[];
  };
}

/**
 * Полнотекстовый поиск (LIKE) по четырём таблицам одновременно.
 * Возвращает плоский список «хитов» с указанием, в каком поле нашлось.
 * Без FTS5 — на текущем масштабе LIKE работает мгновенно.
 */
export function searchAll(
  query: string,
  kinds: SearchHitKind[] = ['entity', 'relation', 'observation', 'source'],
  limit = 100,
  offset = 0
): SearchAllResult {
  const db = getDatabase();
  const q = (query || '').trim();
    const empty: SearchAllResult = {
    items: [],
    total: 0,
    counts: { entity: 0, relation: 0, observation: 0, source: 0 },
    matchedIds: { entities: [], relations: [], observations: [], sources: [] },
    unionIds:   { entities: [], relations: [], observations: [], sources: [] },
  };
  if (!q) return empty;

  const like = `%${q}%`;
  const lowerQ = q.toLowerCase();
  const items: SearchHit[] = [];
  const counts: Record<SearchHitKind, number> = {
    entity: 0, relation: 0, observation: 0, source: 0,
  };

  const matchedEntityIds = new Set<number>();
  const matchedRelationIds = new Set<number>();
  const matchedObservationIds = new Set<number>();
  const matchedSourceIds = new Set<number>();

  const pickMatch = (
    fields: Array<[string, string | null]>
  ): { field: string; value: string } => {
    for (const [name, v] of fields) {
      if (v && String(v).toLowerCase().includes(lowerQ)) {
        return { field: name, value: String(v) };
      }
    }
    // fallback — первое непустое поле
    for (const [name, v] of fields) {
      if (v) return { field: name, value: String(v) };
    }
    return { field: fields[0][0], value: '' };
  };

  // ===== ENTITIES =====
  if (kinds.includes('entity')) {
    counts.entity = (db.prepare(`
      SELECT COUNT(*) AS c FROM entities
      WHERE value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?
    `).get(like, like, like, like) as any).c;

    if (counts.entity > 0) {
      const rows = db.prepare(`
        SELECT id, type, value, label, notes
        FROM entities
        WHERE value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?
        ORDER BY last_seen DESC
        LIMIT ?
      `).all(like, like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedEntityIds.add(r.id);
        const m = pickMatch([
          ['value', r.value], ['label', r.label], ['notes', r.notes],
        ]);
        items.push({
          kind: 'entity',
          id: r.id,
          title: r.label || r.value || `#${r.id}`,
          subtitle: `сущность · ${r.type}`,
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

  // ===== RELATIONS =====
  if (kinds.includes('relation')) {
    counts.relation = (db.prepare(`
      SELECT COUNT(*) AS c FROM relations
      WHERE predicate LIKE ? OR evidence_text LIKE ? OR notes LIKE ?
    `).get(like, like, like) as any).c;

    if (counts.relation > 0) {
      const rows = db.prepare(`
        SELECT r.id, r.predicate, r.evidence_text, r.notes,
               s.label AS subject_label, s.value AS subject_value,
               o.label AS object_label, o.value AS object_value
        FROM relations r
        JOIN entities s ON s.id = r.subject_id
        JOIN entities o ON o.id = r.object_id
        WHERE r.predicate LIKE ? OR r.evidence_text LIKE ? OR r.notes LIKE ?
        ORDER BY r.id DESC
        LIMIT ?
      `).all(like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedRelationIds.add(r.id);
        const m = pickMatch([
          ['predicate', r.predicate],
          ['evidence_text', r.evidence_text],
          ['notes', r.notes],
        ]);
        const subj = r.subject_label || r.subject_value || '?';
        const obj = r.object_label || r.object_value || '?';
        items.push({
          kind: 'relation',
          id: r.id,
          title: `${subj} —${r.predicate}→ ${obj}`,
          subtitle: 'связь',
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

  // ===== OBSERVATIONS =====
  if (kinds.includes('observation')) {
    counts.observation = (db.prepare(`
      SELECT COUNT(*) AS c FROM observations
      WHERE attribute LIKE ? OR value LIKE ? OR notes LIKE ?
    `).get(like, like, like) as any).c;

    if (counts.observation > 0) {
      const rows = db.prepare(`
        SELECT o.id, o.attribute, o.value, o.notes, e.label AS entity_label
        FROM observations o
        JOIN entities e ON e.id = o.entity_id
        WHERE o.attribute LIKE ? OR o.value LIKE ? OR o.notes LIKE ?
        ORDER BY o.id DESC
        LIMIT ?
      `).all(like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedObservationIds.add(r.id);
        const m = pickMatch([
          ['attribute', r.attribute], ['value', r.value], ['notes', r.notes],
        ]);
        items.push({
          kind: 'observation',
          id: r.id,
          title: `${r.entity_label || '?'} · ${r.attribute} = ${r.value}`,
          subtitle: 'наблюдение',
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

  // ===== SOURCES =====
  if (kinds.includes('source')) {
    counts.source = (db.prepare(`
      SELECT COUNT(*) AS c FROM sources
      WHERE url LIKE ? OR title LIKE ? OR provider LIKE ?
         OR authority_basis LIKE ? OR notes LIKE ?
    `).get(like, like, like, like, like) as any).c;

    if (counts.source > 0) {
      const rows = db.prepare(`
        SELECT id, url, title, provider, authority_basis, notes
        FROM sources
        WHERE url LIKE ? OR title LIKE ? OR provider LIKE ?
           OR authority_basis LIKE ? OR notes LIKE ?
        ORDER BY id DESC
        LIMIT ?
      `).all(like, like, like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedSourceIds.add(r.id);
        const m = pickMatch([
          ['url', r.url], ['title', r.title], ['provider', r.provider],
          ['authority_basis', r.authority_basis], ['notes', r.notes],
        ]);
        items.push({
          kind: 'source',
          id: r.id,
          title: r.title || r.url || `#${r.id}`,
          subtitle: 'источник',
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

    // ===== Расширение через связи: matched ∪ related =====
  const relatedEntityIds = new Set<number>();
  const relatedRelationIds = new Set<number>();
  const relatedObservationIds = new Set<number>();
  const relatedSourceIds = new Set<number>();

  // Если нашли сущности — подтянем их связи, наблюдения и источники
  if (matchedEntityIds.size > 0) {
    const ids = [...matchedEntityIds];
    const ph = ids.map(() => '?').join(',');

    // Связи, где найденная сущность — subject или object
    const relRows = db.prepare(`
      SELECT id, subject_id, object_id, source_id
      FROM relations
      WHERE subject_id IN (${ph}) OR object_id IN (${ph})
    `).all(...ids, ...ids) as any[];
    for (const r of relRows) {
      relatedRelationIds.add(r.id);
      relatedEntityIds.add(r.subject_id);
      relatedEntityIds.add(r.object_id);
      if (r.source_id) relatedSourceIds.add(r.source_id);
    }

    // Наблюдения найденных сущностей
    const obsRows = db.prepare(`
      SELECT id, source_id FROM observations WHERE entity_id IN (${ph})
    `).all(...ids) as any[];
    for (const o of obsRows) {
      relatedObservationIds.add(o.id);
      if (o.source_id) relatedSourceIds.add(o.source_id);
    }
  }

  // Если нашли связи — добавим их участников и источники
  if (matchedRelationIds.size > 0) {
    const ids = [...matchedRelationIds];
    const ph = ids.map(() => '?').join(',');
    const relRows = db.prepare(`
      SELECT subject_id, object_id, source_id FROM relations WHERE id IN (${ph})
    `).all(...ids) as any[];
    for (const r of relRows) {
      relatedEntityIds.add(r.subject_id);
      relatedEntityIds.add(r.object_id);
      if (r.source_id) relatedSourceIds.add(r.source_id);
    }
  }

  // Если нашли наблюдения — добавим их сущности и источники
  if (matchedObservationIds.size > 0) {
    const ids = [...matchedObservationIds];
    const ph = ids.map(() => '?').join(',');
    const obsRows = db.prepare(`
      SELECT entity_id, source_id FROM observations WHERE id IN (${ph})
    `).all(...ids) as any[];
    for (const o of obsRows) {
      relatedEntityIds.add(o.entity_id);
      if (o.source_id) relatedSourceIds.add(o.source_id);
    }
  }

  const unionEntities = [...new Set([...matchedEntityIds, ...relatedEntityIds])];
  const unionRelations = [...new Set([...matchedRelationIds, ...relatedRelationIds])];
  const unionObservations = [...new Set([...matchedObservationIds, ...relatedObservationIds])];
  const unionSources = [...new Set([...matchedSourceIds, ...relatedSourceIds])];

  const total = counts.entity + counts.relation + counts.observation + counts.source;
  const paginated = items.slice(offset, offset + limit);

    return {
    items: paginated,
    total,
    counts,
    matchedIds: {
      entities: [...matchedEntityIds],
      relations: [...matchedRelationIds],
      observations: [...matchedObservationIds],
      sources: [...matchedSourceIds],
    },
    unionIds: {
      entities: unionEntities,
      relations: unionRelations,
      observations: unionObservations,
      sources: unionSources,
    },
  };
}