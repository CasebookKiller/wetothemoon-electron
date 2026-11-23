// Проверяет, что buildContinuationSystemPrompt теперь берёт цепочку из БД.
// Если БД пуста — fallback на FS, но в нашем случае БД уже засинкана.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const MANIFEST = process.env.CONTEXT_MANIFEST;
if (!MANIFEST) { console.error('❌ CONTEXT_MANIFEST не задан'); process.exit(1); }

const dbUrl  = pathToFileURL(path.join(process.cwd(), 'src/main/services/gateway/cache/db.ts')).href;
const cbUrl  = pathToFileURL(path.join(process.cwd(), 'src/main/services/gateway/contextBuilder.ts')).href;

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
