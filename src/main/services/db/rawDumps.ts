import { getDatabase } from './connection';

export interface DumpListItem {
  company_inn: string;
  company_id_rusprofile: string | null;
  entity_type: string | null;
  entity_name: string | null;
  last_update: string;
  dump_count: number;
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

export function hasRawDumpForInn(inn: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM raw_dumps WHERE company_inn = ? LIMIT 1').get(inn);
  return !!row;
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