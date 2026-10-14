// src/main/services/pranaBindu/mentat/graph/data/index.ts
//
// Реестр графов. Читает manifest.json — какие каталоги подключены
// и какие из них enabled. Backward-compat: WADE_SEED и ALL_GRAPHS
// сохранены для существующего кода.

import wade from './wade.graph.json';
import smithrun from './smithrun.graph.json';
import cali from './cali.graph.json';
import runner from './runner.graph.json';
import core from './core.graph.json';
import posture from './posture.graph.json';
import weightloss from './weightloss.graph.json';
import named from './named.graph.json';
import thenics from './thenics.graph.json';
import manifest from './manifest.json';
import type { GraphJson } from '../schema';

export interface ManifestEntry {
  id: string;
  file: string;
  enabled: boolean;
  label: string;
  labelRu?: string;
}

export interface GraphManifest {
  version: number;
  catalogs: ManifestEntry[];
}

/**
 * Реестр всех зарегистрированных JSON-файлов.
 * Если добавляешь новый каталог — импортируй здесь и положи файл рядом.
 */
const FILES: Record<string, GraphJson> = {
  'wade.graph.json':       wade as unknown as GraphJson,
  'smithrun.graph.json':   smithrun as unknown as GraphJson,
  'cali.graph.json':       cali as unknown as GraphJson,
  'runner.graph.json':     runner as unknown as GraphJson,
  'core.graph.json':       core as unknown as GraphJson,
  'posture.graph.json':    posture as unknown as GraphJson,
  'weightloss.graph.json': weightloss as unknown as GraphJson,
  'named.graph.json':      named as unknown as GraphJson,
  'thenics.graph.json':    thenics as unknown as GraphJson,
};

export const MANIFEST: GraphManifest = manifest as unknown as GraphManifest;

/** Seed-графы только тех каталогов, что `enabled: true`. */
export const ENABLED_SEEDS: GraphJson[] = MANIFEST.catalogs
  .filter((c) => c.enabled)
  .map((c) => {
    const g = FILES[c.file];
    if (!g) {
      throw new Error(
        `[graph] manifest: файл ${c.file} указан, но не импортирован в data/index.ts`,
      );
    }
    return g;
  });

/** Все зарегистрированные графы, включая выключенные. Для палитры / будущего. */
export const ALL_SEEDS: GraphJson[] = MANIFEST.catalogs
  .filter((c) => FILES[c.file])
  .map((c) => FILES[c.file]);

/** Backward-compat: Wade seed. Используется в handler'ах и sources.ts. */
export const WADE_SEED: GraphJson = wade as unknown as GraphJson;

/** Backward-compat: раньше экспортировалось под этим именем. */
export const ALL_GRAPHS: GraphJson[] = ENABLED_SEEDS;