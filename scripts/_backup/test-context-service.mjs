// scripts/test-context-service.mjs
// Синкает context.manifest.json → БД и проверяет чтение.
// Запуск: node --import tsx scripts/test-context-service.mjs
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

// Открываем БД (нужен getGatewayCache). electron.app недоступен в скрипте,
// поэтому напрямую DatabaseSync + openGatewayCache — но openGatewayCache требует
// пути. Пробуем как обычно: через getGatewayCache() — если он уже открыт.
// Проще: используем DatabaseSync и сами вызываем migrate (уже применён).
// Импортируем contextService и вызываем синк.

const modUrl = pathToFileURL(path.join(process.cwd(), 'src/main/services/gateway/contextService.ts')).href;
const dbUrl  = pathToFileURL(path.join(process.cwd(), 'src/main/services/gateway/cache/db.ts')).href;

const dbMod = await import(dbUrl);
const svcMod = await import(modUrl);

// Инициализация БД (нужен openGatewayCache, а не getGatewayCache —
// getGatewayCache требует уже открытую)
const dbPath = path.join(process.env.HOME, '.config/wetothemoon-electron/gateway.db');
if (!dbMod.isGatewayCacheOpen()) {
  dbMod.openGatewayCache(dbPath);
  console.log('📂 openGatewayCache:', dbPath);
}

console.log('\n=== 1. syncManifestToDb ===');
const r = svcMod.syncManifestToDb(MANIFEST);
console.log(JSON.stringify(r, null, 2));

console.log('\n=== 2. getNode(global) ===');
const global = svcMod.getNode('global');
if (global) {
  console.log('  key:          ', global.key);
  console.log('  kind:         ', global.kind);
  console.log('  title:        ', global.title);
  console.log('  version:      ', global.version);
  console.log('  contentHash:  ', global.contentHash.slice(0, 16) + '...');
  console.log('  contentMd:    ', global.contentMd.length, 'байт');
  console.log('  sourceFile:   ', global.sourceFile);
}

console.log('\n=== 3. getChain(gateway + api-channel) ===');
const chain = svcMod.getChain([
  'wetothemoon-electron/gateway',
  'wetothemoon-electron/gateway/api-channel',
]);
for (const n of chain) {
  console.log('  ' + n.key.padEnd(50) + '[' + n.kind + ']' + (n.contentMd ? '  ' + n.contentMd.length + 'b' : ''));
}

console.log('\n=== 4. listVersions(global) ===');
const versions = svcMod.listVersions('global');
for (const v of versions) {
  console.log('  v' + v.version + '  ' + v.createdAt + '  ' + (v.changeSummary ?? ''));
}

console.log('\n=== 5. getChildren(wetothemoon-electron) ===');
const children = svcMod.getChildren('wetothemoon-electron');
for (const c of children) console.log('  ' + c.key + '  [' + c.kind + ']');

dbMod.closeGatewayCache();
console.log('\n✅ done');
