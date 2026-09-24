import { DatabaseSync } from 'node:sqlite';
import { normalize } from 'path';

export function initializeSchema(db: DatabaseSync) {
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

  // === Справочник судов ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS courts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      court_tag     TEXT NOT NULL UNIQUE,
      court_name    TEXT NOT NULL,
      court_type    TEXT NOT NULL DEFAULT 'arbitration',
      region        TEXT,
      source_id     INTEGER REFERENCES sources(id),
      first_seen    TEXT NOT NULL,
      last_seen     TEXT NOT NULL,
      raw_file_path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_courts_type ON courts(court_type);
    CREATE INDEX IF NOT EXISTS idx_courts_name ON courts(court_name);
  `);

  // === Справочник судей ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS judges (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_uuid    TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      court_id      INTEGER REFERENCES courts(id),
      post          TEXT,
      source_id     INTEGER REFERENCES sources(id),
      first_seen    TEXT NOT NULL,
      last_seen     TEXT NOT NULL,
      raw_file_path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_judges_court ON judges(court_id);
    CREATE INDEX IF NOT EXISTS idx_judges_name  ON judges(name);
  `);

  // === Прогресс обхода справочников (универсальная) ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS scrape_progress (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      source        TEXT NOT NULL,
      prefix        TEXT NOT NULL,
      status        TEXT NOT NULL,
      items_found   INTEGER DEFAULT 0,
      started_at    TEXT,
      finished_at   TEXT,
      last_error    TEXT,
      UNIQUE(source, prefix)
    );
    CREATE INDEX IF NOT EXISTS idx_scrape_progress_source_status
      ON scrape_progress(source, status);
  `);

    // === Timeline судебных событий (case_events) ===
  db.exec(`
        CREATE TABLE IF NOT EXISTS case_events (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      case_entity_id    INTEGER NOT NULL,
      event_uuid        TEXT,
      event_date        TEXT NOT NULL,
      event_type        TEXT NOT NULL,
      judge_entity_id   INTEGER,
      court_entity_id   INTEGER,
      result            TEXT,
      content           TEXT,
      document_url      TEXT,
      source_id         INTEGER,
      origin            TEXT NOT NULL DEFAULT 'manual',
      notes             TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      FOREIGN KEY (case_entity_id)  REFERENCES entities(id),
      FOREIGN KEY (judge_entity_id) REFERENCES entities(id),
      FOREIGN KEY (court_entity_id) REFERENCES entities(id),
      FOREIGN KEY (source_id)       REFERENCES sources(id)
    );
    CREATE INDEX IF NOT EXISTS idx_case_events_case_date
      ON case_events(case_entity_id, event_date);
    CREATE INDEX IF NOT EXISTS idx_case_events_date
      ON case_events(event_date);
    CREATE INDEX IF NOT EXISTS idx_case_events_type
      ON case_events(event_type);
  `);

    // === Кеш дампов kad.arbitr ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS kad_dumps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      key TEXT NOT NULL,
      shard TEXT,
      dump_file_path TEXT NOT NULL,
      size_bytes INTEGER,
      payload_meta TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_accessed_at TEXT NOT NULL,
      UNIQUE(kind, key)
    );
    CREATE INDEX IF NOT EXISTS idx_kad_dumps_kind_key
      ON kad_dumps(kind, key);
    CREATE INDEX IF NOT EXISTS idx_kad_dumps_kind_shard
      ON kad_dumps(kind, shard);
    CREATE INDEX IF NOT EXISTS idx_kad_dumps_updated
      ON kad_dumps(updated_at);
  `);

  // Миграция: колонка shard в kad_dumps (если таблица уже была без неё).
  // PRAGMA + ALTER — на всякий случай, если kad_dumps в будущем изменится.
  try {
    const kadDumpsCols = db.prepare(`PRAGMA table_info(kad_dumps)`).all() as { name: string }[];
    if (kadDumpsCols.length > 0 && !kadDumpsCols.some((c) => c.name === 'shard')) {
      db.exec(`ALTER TABLE kad_dumps ADD COLUMN shard TEXT;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_kad_dumps_kind_shard
               ON kad_dumps(kind, shard);`);
      console.log('Добавлена колонка shard в kad_dumps');
    }
  } catch (e) {
    // Таблицы ещё нет — не страшно, CREATE TABLE создаст с shard.
  }

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

  // Миграция: via_entity_id в relations — контекст тройных связей.
  // Пример: P --represents--> A, via=Case. Позволяет хранить представителей
  // (и другие контекстные связи) без пятой таблицы, оставаясь в бинарной
  // модели relations.
  const relCols = db.prepare(`PRAGMA table_info(relations)`).all() as { name: string }[];
  if (!relCols.some((c) => c.name === 'via_entity_id')) {
    db.exec(`ALTER TABLE relations ADD COLUMN via_entity_id INTEGER REFERENCES entities(id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_relations_via ON relations(via_entity_id);`);
    console.log('Добавлена колонка via_entity_id в relations');
  }

  // Миграция: расширяем уникальный индекс relations до (subject, predicate, object, via).
  // Старый ux_relations_triple не пропускал "P представляет A в деле X" и
  // "P представляет A в деле Y" одновременно.
  try {
    // Проверяем, существует ли старый индекс
    const oldIdx = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND name='ux_relations_triple'`
    ).get();

    if (oldIdx) {
      db.exec(`DROP INDEX ux_relations_triple;`);
      console.log('[db] Удалён старый ux_relations_triple');
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_relations_triple_via
        ON relations(subject_id, predicate, object_id, COALESCE(via_entity_id, 0));
    `);
  } catch (e) {
    console.warn(
      '[db] Не удалось создать ux_relations_triple_via — в relations, вероятно, есть дубликаты. ' +
      'Чистка: DELETE FROM relations WHERE id NOT IN ' +
      '(SELECT MAX(id) FROM relations GROUP BY subject_id, predicate, object_id, COALESCE(via_entity_id, 0));',
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

  // Миграция court_case:
  // 1) вычисляем для каждой сущности желаемый normalized_value (lowercase);
  // 2) группируем по нему;
  // 3) сливаем дубли на keeper (min id) — переносим events/observations/relations;
  // 4) у keeper обновляем normalized_value и value.
  //
  // Порядок именно такой: если сначала обновить normalized_value, UNIQUE
  // idx_entities_unique(type, normalized_value) упадёт на дублях.
  try {
    db.exec('PRAGMA foreign_keys = OFF;');

    const rows = db.prepare(`
      SELECT id, value, normalized_value FROM entities WHERE type = 'court_case'
    `).all() as Array<{ id: number; value: string; normalized_value: string }>;

    const wantNormalized = (v: string) =>
      v.trim().toLowerCase().replace(/\s+/g, ' ');

    // Группируем по желаемому normalized_value
    const groups = new Map<string, Array<{ id: number; value: string }>>();
    for (const row of rows) {
      const key = wantNormalized(row.value);
      const list = groups.get(key) ?? [];
      list.push({ id: row.id, value: row.value });
      groups.set(key, list);
    }

    let normalized = 0;
    let merged = 0;

    db.exec('BEGIN');
    try {
      for (const [wantNorm, items] of groups) {
        items.sort((a, b) => a.id - b.id);
        const keeper = items[0];
        const dups = items.slice(1);

        // 1. Сливаем дубли НА keeper
        for (const dup of dups) {
          // case_events (FK на entities)
          db.prepare('UPDATE case_events SET case_entity_id = ? WHERE case_entity_id = ?')
            .run(keeper.id, dup.id);

          // observations — конфликты удаляем, остальное переносим
          const dupObs = db.prepare(
            'SELECT id, attribute, value FROM observations WHERE entity_id = ?'
          ).all(dup.id) as Array<{ id: number; attribute: string; value: string }>;
          for (const obs of dupObs) {
            const conflict = db.prepare(`
              SELECT id FROM observations
              WHERE entity_id = ? AND attribute = ? AND value = ?
            `).get(keeper.id, obs.attribute, obs.value) as { id: number } | undefined;
            if (conflict) {
              db.prepare('DELETE FROM observations WHERE id = ?').run(obs.id);
            } else {
              db.prepare('UPDATE observations SET entity_id = ? WHERE id = ?')
                .run(keeper.id, obs.id);
            }
          }

          // relations (subject)
          const dupSubj = db.prepare(
            'SELECT id, predicate, object_id FROM relations WHERE subject_id = ?'
          ).all(dup.id) as Array<{ id: number; predicate: string; object_id: number }>;
          for (const rel of dupSubj) {
            const conflict = db.prepare(`
              SELECT id FROM relations
              WHERE subject_id = ? AND predicate = ? AND object_id = ?
            `).get(keeper.id, rel.predicate, rel.object_id) as { id: number } | undefined;
            if (conflict) {
              db.prepare('DELETE FROM relations WHERE id = ?').run(rel.id);
            } else {
              db.prepare('UPDATE relations SET subject_id = ? WHERE id = ?')
                .run(keeper.id, rel.id);
            }
          }

          // relations (object)
          const dupObj = db.prepare(
            'SELECT id, subject_id, predicate FROM relations WHERE object_id = ?'
          ).all(dup.id) as Array<{ id: number; subject_id: number; predicate: string }>;
          for (const rel of dupObj) {
            const conflict = db.prepare(`
              SELECT id FROM relations
              WHERE subject_id = ? AND predicate = ? AND object_id = ?
            `).get(rel.subject_id, rel.predicate, keeper.id) as { id: number } | undefined;
            if (conflict) {
              db.prepare('DELETE FROM relations WHERE id = ?').run(rel.id);
            } else {
              db.prepare('UPDATE relations SET object_id = ? WHERE id = ?')
                .run(keeper.id, rel.id);
            }
          }

          // Удаляем дубль — освобождаем normalized_value
          db.prepare('DELETE FROM entities WHERE id = ?').run(dup.id);
          merged++;
        }

        // 2. Теперь у keeper можно выставить желаемый normalized_value
        const keeperRow = db.prepare(
          'SELECT value, normalized_value FROM entities WHERE id = ?'
        ).get(keeper.id) as { value: string; normalized_value: string } | undefined;

        if (keeperRow && keeperRow.normalized_value !== wantNorm) {
          db.prepare('UPDATE entities SET normalized_value = ? WHERE id = ?')
            .run(wantNorm, keeper.id);
          normalized++;
        }
      }

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }

    if (normalized > 0 || merged > 0) {
      console.log(
        `[db] Миграция court_case: normalized_value=${normalized}, слито дублей=${merged}`
      );
    }
  } catch (e) {
    console.warn('[db] Миграция court_case не удалась:', (e as Error).message);
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

  // Миграция: event_uuid в case_events (для БД, созданных до Фазы 3)
  const caseEventsCols = db.prepare(`PRAGMA table_info(case_events)`).all() as { name: string }[];
  if (!caseEventsCols.some((c) => c.name === 'event_uuid')) {
    db.exec(`ALTER TABLE case_events ADD COLUMN event_uuid TEXT;`);
    console.log('Добавлена колонка event_uuid в case_events');
  }
  // Всегда создаём индекс — идемпотентно, безопасно на новой и старой БД.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_case_events_uuid
           ON case_events(case_entity_id, event_uuid);`);

  // Миграция 12a: поля hearing_* и significance в case_events (аддитивная).
  // Старые события остаются нетронутыми — новые колонки заполняются NULL.
  try {
    const ceCols = db.prepare(`PRAGMA table_info(case_events)`).all() as { name: string }[];
    const addCeCol = (name: string, type = 'TEXT') => {
      if (!ceCols.some((c) => c.name === name)) {
        db.exec(`ALTER TABLE case_events ADD COLUMN ${name} ${type};`);
        console.log(`[db] Добавлена колонка ${name} в case_events`);
      }
    };

    addCeCol('hearing_date');
    addCeCol('hearing_time');
    addCeCol('hearing_place');
    addCeCol('hearing_judges');

    // Задел под направление 12 (фильтры событий). Заполняется позже.
    addCeCol('significance');
    addCeCol('significance_reason');
  } catch (e) {
    console.warn('[db] Миграция case_events (hearing_*) не удалась:', (e as Error).message);
  }

  const caseRow = db.prepare('SELECT id FROM case_info WHERE id = 1').get();
  if (!caseRow) {
    db.prepare(`
      INSERT INTO case_info (id, name, description, status, created_at)
      VALUES (1, ?, ?, ?, ?)
    `).run('OSINT Electron', 'Локальное OSINT-дело', 'active', new Date().toISOString());
  }
}

/**
 * Локальная копия normalizeCaseNumber из osintStorage.
 * Дублируется, чтобы не было циклической зависимости database ← osintStorage.
 */
export function normalizeCaseNumberLocal(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, '').replace(/\//g, '-').toUpperCase().trim();
}