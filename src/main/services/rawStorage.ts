// src/main/services/rawStorage.ts

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { encode } from '@msgpack/msgpack';
import { randomUUID } from 'crypto';

export interface SavedRawDump {
  filePath: string;
  sizeBytes: number;
  entityType: string;
  regionPrefix: string;
}

export function saveRawDumpSync(companyInn: string, data: any): SavedRawDump {
  // Определяем тип сущности по данным
  const summary = data.summary || {};
  let entityType = 'person';
  let prefix = 'unknown';

  if (summary.ogrn && summary.inn) {
    entityType = 'company';
    prefix = summary.inn.slice(0, 5) || 'unknown';
  } else if (summary.ogrnip && summary.inn) {
    entityType = 'entrepreneur';
    prefix = summary.inn.slice(0, 5) || 'unknown';
  } else if (summary.inn && !summary.ogrn) {
    entityType = 'entrepreneur';
    prefix = summary.inn.slice(0, 5) || 'unknown';
  } else {
    entityType = 'person';
    if (summary.inn) {
      prefix = summary.inn.slice(0, 5);
    } else if (summary.region) {
      prefix = summary.region.slice(0, 2);
    } else {
      prefix = 'misc';
    }
  }

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(app.getPath('userData'), 'raw_dumps', entityType, prefix);
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `${dateStr}_${randomUUID()}.msgpack`;
  const filePath = path.join(dir, fileName);

  const buffer = encode(data);
  fs.writeFileSync(filePath, buffer);

  const stat = fs.statSync(filePath);
  return {
    filePath,
    sizeBytes: stat.size,
    entityType,
    regionPrefix: prefix,
  };
}