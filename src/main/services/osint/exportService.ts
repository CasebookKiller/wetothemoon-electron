// src/main/services/osint/exportService.ts

import path from 'path';
import fs from 'fs';
import { app, dialog, BrowserWindow } from 'electron';
import { getDatabase } from '../db';
//import { getDatabase } from '../database';

/**
 * Экранирует значение для CSV по RFC 4180.
 * Оборачивает в кавычки, если содержит разделитель, кавычку или перевод строки.
 */
function csvEscape(value: any): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(values: any[]): string {
  return values.map(csvEscape).join(',');
}

// ============ Экспорт сущностей ============

export function buildEntitiesCsv(): string {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, type, value, normalized_value, label,
           first_seen, last_seen, confidence, status, notes,
           origin, rusprofile_id, raw_file_path
    FROM entities
    ORDER BY id ASC
  `).all() as any[];

  const lines: string[] = [];
  lines.push(csvRow([
    'id', 'type', 'value', 'normalized_value', 'label',
    'first_seen', 'last_seen', 'confidence', 'status', 'notes',
    'origin', 'rusprofile_id', 'raw_file_path',
  ]));

  for (const r of rows) {
    lines.push(csvRow([
      r.id, r.type, r.value, r.normalized_value, r.label,
      r.first_seen, r.last_seen, r.confidence, r.status, r.notes,
      r.origin, r.rusprofile_id, r.raw_file_path,
    ]));
  }

  // BOM — чтобы Excel корректно открывал UTF-8
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// ============ Экспорт связей ============

export function buildRelationsCsv(): string {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      r.id,
      r.subject_id,
      s.type  AS subject_type,
      s.label AS subject_label,
      s.value AS subject_value,
      r.predicate,
      r.object_id,
      o.type  AS object_type,
      o.label AS object_label,
      o.value AS object_value,
      r.confidence,
      r.status,
      r.valid_from,
      r.valid_to,
      r.evidence_text,
      r.notes,
      r.origin,
      r.source_id,
      src.url   AS source_url,
      src.title AS source_title
    FROM relations r
    JOIN entities s ON s.id = r.subject_id
    JOIN entities o ON o.id = r.object_id
    LEFT JOIN sources src ON src.id = r.source_id
    ORDER BY r.id ASC
  `).all() as any[];

  const lines: string[] = [];
  lines.push(csvRow([
    'id',
    'subject_id', 'subject_type', 'subject_label', 'subject_value',
    'predicate',
    'object_id', 'object_type', 'object_label', 'object_value',
    'confidence', 'status', 'valid_from', 'valid_to',
    'evidence_text', 'notes', 'origin',
    'source_id', 'source_url', 'source_title',
  ]));

  for (const r of rows) {
    lines.push(csvRow([
      r.id,
      r.subject_id, r.subject_type, r.subject_label, r.subject_value,
      r.predicate,
      r.object_id, r.object_type, r.object_label, r.object_value,
      r.confidence, r.status, r.valid_from, r.valid_to,
      r.evidence_text, r.notes, r.origin,
      r.source_id, r.source_url, r.source_title,
    ]));
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// ============ Экспорт наблюдений ============

export function buildObservationsCsv(): string {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      o.id,
      o.entity_id,
      e.type  AS entity_type,
      e.label AS entity_label,
      o.attribute,
      o.value,
      o.confidence,
      o.observed_at,
      o.notes,
      o.origin,
      o.source_id,
      src.url   AS source_url,
      src.title AS source_title
    FROM observations o
    JOIN entities e ON e.id = o.entity_id
    LEFT JOIN sources src ON src.id = o.source_id
    ORDER BY o.id ASC
  `).all() as any[];

  const lines: string[] = [];
  lines.push(csvRow([
    'id', 'entity_id', 'entity_type', 'entity_label',
    'attribute', 'value', 'confidence', 'observed_at', 'notes', 'origin',
    'source_id', 'source_url', 'source_title',
  ]));

  for (const r of rows) {
    lines.push(csvRow([
      r.id, r.entity_id, r.entity_type, r.entity_label,
      r.attribute, r.value, r.confidence, r.observed_at, r.notes, r.origin,
      r.source_id, r.source_url, r.source_title,
    ]));
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// ============ Экспорт источников ============

export function buildSourcesCsv(): string {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      id, url, title,
      source_type, source_kind, provider,
      collection_method, authority_basis, reliability,
      access_level, retrieved_at,
      local_path, sha256, notes, origin
    FROM sources
    ORDER BY id ASC
  `).all() as any[];

  const lines: string[] = [];
  lines.push(csvRow([
    'id', 'url', 'title',
    'source_type', 'source_kind', 'provider',
    'collection_method', 'authority_basis', 'reliability',
    'access_level', 'retrieved_at',
    'local_path', 'sha256', 'notes', 'origin',
  ]));

  for (const r of rows) {
    lines.push(csvRow([
      r.id, r.url, r.title,
      r.source_type, r.source_kind, r.provider,
      r.collection_method, r.authority_basis, r.reliability,
      r.access_level, r.retrieved_at,
      r.local_path, r.sha256, r.notes, r.origin,
    ]));
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// ============ Диалог сохранения + запись ============

interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
  canceled?: boolean;
}

async function saveCsvWithDialog(
  parentWindow: BrowserWindow | null,
  defaultFileName: string,
  content: string
): Promise<SaveResult> {
  try {
    const defaultPath = path.join(app.getPath('documents'), defaultFileName);

    const dialogOptions: Electron.SaveDialogOptions = {
      title: 'Сохранить CSV',
      defaultPath,
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Все файлы', extensions: ['*'] },
      ],
    };

    const result = parentWindow
      ? await dialog.showSaveDialog(parentWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function exportEntitiesCsv(
  parentWindow: BrowserWindow | null
): Promise<SaveResult> {
  const csv = buildEntitiesCsv();
  const timestamp = new Date().toISOString().slice(0, 10);
  return saveCsvWithDialog(parentWindow, `osint-entities-${timestamp}.csv`, csv);
}

export async function exportRelationsCsv(
  parentWindow: BrowserWindow | null
): Promise<SaveResult> {
  const csv = buildRelationsCsv();
  const timestamp = new Date().toISOString().slice(0, 10);
  return saveCsvWithDialog(parentWindow, `osint-relations-${timestamp}.csv`, csv);
}

export async function exportObservationsCsv(
  parentWindow: BrowserWindow | null
): Promise<SaveResult> {
  const csv = buildObservationsCsv();
  const timestamp = new Date().toISOString().slice(0, 10);
  return saveCsvWithDialog(parentWindow, `osint-observations-${timestamp}.csv`, csv);
}

export async function exportSourcesCsv(
  parentWindow: BrowserWindow | null
): Promise<SaveResult> {
  const csv = buildSourcesCsv();
  const timestamp = new Date().toISOString().slice(0, 10);
  return saveCsvWithDialog(parentWindow, `osint-sources-${timestamp}.csv`, csv);
}