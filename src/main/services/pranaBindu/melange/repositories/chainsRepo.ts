// src/main/services/pranaBindu/melange/repositories/chainsRepo.ts
//
// Цепочки маршрутов (C.12): явные последовательности слотов.
// Слот = «в этом месте маршрута пробеги N раз любой атом из clusters
// (или из specificAtoms)». См. 18b_ATOM_CHAINS.md.

import type { DatabaseSync } from 'node:sqlite';
import type {
  Chain,
  ChainRow,
  ChainSlot,
  ChainSlotRow,
  ChainWithSlots,
  ChainAggregate,
} from '../types';

// ==================== Внутренние хелперы ====================

function safeParseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function safeParseNumberArray(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => typeof x === 'number');
  } catch {
    return [];
  }
}

function rowToChain(row: ChainRow): Chain {
  return {
    id: row.id,
    name: row.name,
    ordered: row.ordered === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSlot(row: ChainSlotRow): ChainSlot {
  return {
    id: row.id,
    chainId: row.chain_id,
    orderIndex: row.order_index,
    expectedRepeatsMin: row.expected_repeats_min,
    expectedRepeatsMax: row.expected_repeats_max,
    aggregate: (row.aggregate as ChainAggregate) ?? 'best',
    minCoverage: row.min_coverage,
    optional: row.optional === 1,
    clusters: safeParseStringArray(row.clusters_json),
    specificAtoms: safeParseNumberArray(row.specific_atoms_json),
    notes: row.notes,
  };
}

// ==================== Входные типы ====================

export interface CreateChainSlotInput {
  orderIndex: number;
  expectedRepeatsMin?: number;
  expectedRepeatsMax?: number;
  aggregate?: ChainAggregate;
  minCoverage?: number;
  optional?: boolean;
  clusters?: string[];
  specificAtoms?: number[];
  notes?: string | null;
}

export interface CreateChainInput {
  name: string;
  ordered?: boolean;
  slots: CreateChainSlotInput[];
}

// ==================== CRUD ====================

export function createChain(
  db: DatabaseSync,
  input: CreateChainInput,
): number {
  const name = input.name?.trim();
  if (!name) throw new Error('chain: name обязателен');
  if (!Array.isArray(input.slots) || input.slots.length === 0) {
    throw new Error('chain: нужно минимум 1 слот');
  }

  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    const info = db
      .prepare(
        `INSERT INTO chains (name, ordered, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(name, input.ordered ? 1 : 0, now, now);

    const chainId = Number(info.lastInsertRowid);
    insertSlots(db, chainId, input.slots);

    db.exec('COMMIT');
    return chainId;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function insertSlots(
  db: DatabaseSync,
  chainId: number,
  slots: CreateChainSlotInput[],
): void {
  const stmt = db.prepare(
    `INSERT INTO chain_slots
       (chain_id, order_index, expected_repeats_min, expected_repeats_max,
        aggregate, min_coverage, optional, clusters_json, specific_atoms_json,
        notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const sorted = [...slots].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
  );

  sorted.forEach((s, i) => {
    const clusters = Array.isArray(s.clusters) ? s.clusters : [];
    const atoms = Array.isArray(s.specificAtoms) ? s.specificAtoms : [];

    if (clusters.length === 0 && atoms.length === 0) {
      throw new Error(
        `slot[${i}]: нужен либо clusters, либо specificAtoms`,
      );
    }

    stmt.run(
      chainId,
      i,
      s.expectedRepeatsMin ?? 1,
      s.expectedRepeatsMax ?? s.expectedRepeatsMin ?? 1,
      s.aggregate ?? 'best',
      s.minCoverage ?? 90,
      s.optional ? 1 : 0,
      clusters.length > 0 ? JSON.stringify(clusters) : null,
      atoms.length > 0 ? JSON.stringify(atoms) : null,
      s.notes ?? null,
    );
  });
}

export function getChainById(
  db: DatabaseSync,
  id: number,
): ChainWithSlots | null {
  const chainRow = db
    .prepare(`SELECT * FROM chains WHERE id = ?`)
    .get(id) as unknown as ChainRow | undefined;
  if (!chainRow) return null;

  const slotRows = db
    .prepare(
      `SELECT * FROM chain_slots WHERE chain_id = ? ORDER BY order_index ASC`,
    )
    .all(id) as unknown as ChainSlotRow[];

  return {
    ...rowToChain(chainRow),
    slots: slotRows.map(rowToSlot),
  };
}

export function listChains(db: DatabaseSync): Chain[] {
  const rows = db
    .prepare(`SELECT * FROM chains ORDER BY name ASC, id ASC`)
    .all() as unknown as ChainRow[];
  return rows.map(rowToChain);
}

export function updateChainName(
  db: DatabaseSync,
  id: number,
  name: string,
): boolean {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error('chain: name обязателен');
  const info = db
    .prepare(
      `UPDATE chains SET name = ?, updated_at = ? WHERE id = ?`,
    )
    .run(trimmed, new Date().toISOString(), id);
  return Number(info.changes) > 0;
}

/**
 * Заменить все слоты цепочки новым набором.
 * Атомарно: BEGIN / DELETE / INSERT / COMMIT.
 */
export function replaceChainSlots(
  db: DatabaseSync,
  chainId: number,
  slots: CreateChainSlotInput[],
): number {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error('slots: нужно минимум 1');
  }

  db.exec('BEGIN');
  try {
    db.prepare(`DELETE FROM chain_slots WHERE chain_id = ?`).run(chainId);
    insertSlots(db, chainId, slots);
    db.prepare(
      `UPDATE chains SET updated_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), chainId);
    db.exec('COMMIT');
    return slots.length;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function deleteChain(db: DatabaseSync, id: number): boolean {
  const info = db.prepare(`DELETE FROM chains WHERE id = ?`).run(id);
  return Number(info.changes) > 0;
}

/**
 * Найти цепочки, в которых участвует конкретный атом
 * (в specificAtoms или в одном из clusters).
 * Пока не используется, но пригодится для UI «этот атом — часть цепочки X».
 */
export function listChainsUsingAtom(
  db: DatabaseSync,
  atomId: number,
): Chain[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT c.* FROM chains c
       JOIN chain_slots s ON s.chain_id = c.id
       WHERE s.specific_atoms_json LIKE ?
          OR s.clusters_json IS NOT NULL
       ORDER BY c.name ASC`,
    )
    .all(`%${atomId}%`) as unknown as ChainRow[];

  // Дополнительно фильтруем по точному совпадению id в JSON-массиве
  // (LIKE может дать ложные срабатывания: '1' в '[11, 12]').
  const result: Chain[] = [];
  for (const row of rows) {
    const full = getChainById(db, row.id);
    if (!full) continue;
    const hit = full.slots.some((s) => s.specificAtoms.includes(atomId));
    if (hit) result.push(rowToChain(row));
  }
  return result;
}