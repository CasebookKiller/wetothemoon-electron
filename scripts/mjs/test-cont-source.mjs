// Проверяет, что buildContinuationSystemPrompt теперь берёт цепочку из БД.
// Если БД пуста — fallback на FS, но в нашем случае БД уже засинкана.
/**
 * @name test-cont-source
 * @purpose Проверка buildContinuationSystemPrompt: DB-first vs FS fallback
 * @input env: CONTEXT_MANIFEST (обязателен)
 * @output stdout: source (db|fs), bytes, included, skipped, context теги
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — ошибка (CONTEXT_MANIFEST не задан или DB не открыта)
 * @tool false
 * @example node --import tsx scripts/mjs/test-cont-source.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const MANIFEST = process.env.CONTEXT_MANIFEST;
if (!MANIFEST) { console.error('❌ CONTEXT_MANIFEST не задан'); process.exit(1); }

const dbUrl  = pathToFileURL(path.join(ROOT, 'src/main/services/gateway/cache/db.ts')).href;
const cbUrl  = pathToFileURL(path.join(ROOT, 'src/main/services/gateway/contextBuilder.ts')).href;

const dbMod = await import(dbUrl);
const cbMod = await import(cbUrl);

const dbPath = path.join(process.env.HOME, '.config/wetothemoon-electron/gateway.db');
if (!dbMod.isGatewayCacheOpen()) dbMod.openGatewayCache(dbPath);

const r = await cbMod.buildContinuationSystemPrompt({
  manifestPath: MANIFEST,
  activeKeys: ['wetothemoon-electron/gateway', 'wetothemoon-electron/gateway/api-channel'],
  taskTitle: 'Переключение continuation на БД',
});

console.log('source:   ', r.source);
console.log('bytes:    ', r.bytes);
console.log('included: ', r.includedNodes);
console.log('skipped:  ', r.skippedNodes);
console.log('\n=== первые 600 символов ===');
console.log(r.systemPrompt.slice(0, 600) + '…');
console.log('\n=== последние 300 символов ===');
console.log('…' + r.systemPrompt.slice(-300));

// Дополнительно: обрезка бюджетами работает?
const globalBlock = r.systemPrompt.match(/<context[^>]*key="global"[^>]*>[\s\S]*?<\/context>/);
console.log('\nglobal block present:', !!globalBlock, globalBlock ? `(${globalBlock[0].length} симв.)` : '');

dbMod.closeGatewayCache();
console.log('\n✅ done');
