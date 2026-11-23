// scripts/mjs/test-context-builder.mjs
/**
 * @name test-context-builder
 * @purpose Сборка system-prompt из context.manifest.json для активного workspace (preview, без API)
 * @input argv[2]=keys (CSV); env: CONTEXT_MANIFEST, ACTIVE_WORKSPACE_KEYS, ACTIVE_CONTEXT_KEY, CONTEXT_MAX_BYTES (default 60000)
 * @output stdout: цепочка/сборка/первые 800 симв.; файл: recon-output/context-prompt-preview.txt
 * @args { "type": "object", "properties": { "keys": { "type": "string" } } }
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет CONTEXT_MANIFEST / manifest не найден / пустые keys / пустая цепочка
 * @tool false
 * @example node scripts/mjs/test-context-builder.mjs "wetothemoon-electron/gateway"
 */

import fs from 'node:fs';
import path from 'node:path';
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
const ACTIVE_RAW = process.argv[2] || process.env.ACTIVE_WORKSPACE_KEYS || process.env.ACTIVE_CONTEXT_KEY || '';
const ACTIVE_KEYS = ACTIVE_RAW.split(',').map(s => s.trim()).filter(Boolean);
const MAX = Number(process.env.CONTEXT_MAX_BYTES || 60000);

console.log('📄 manifest:', MANIFEST);
console.log('   exists:  ', MANIFEST ? fs.existsSync(MANIFEST) : false);
console.log('🔑 workspace keys:', ACTIVE_KEYS);
console.log('📏 max bytes:', MAX);
console.log();

if (!MANIFEST) { console.error('❌ CONTEXT_MANIFEST не задан'); process.exit(1); }
if (!fs.existsSync(MANIFEST)) { console.error('❌ manifest не найден:', MANIFEST); process.exit(1); }
if (ACTIVE_KEYS.length === 0) { console.error('❌ activeKeys пусты'); process.exit(1); }

const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const nodes = m.nodes || [];
function findNode(k) { return nodes.find(n => n.key === k) || null; }
function chainOf(k) {
  const chain = []; const seen = new Set();
  let cur = findNode(k);
  while (cur) {
    if (seen.has(cur.key)) break;
    seen.add(cur.key);
    chain.unshift(cur);
    cur = cur.parent ? findNode(cur.parent) : null;
  }
  return chain;
}

const seen = new Set();
const chain = [];
for (const k of ACTIVE_KEYS) {
  const c = chainOf(k);
  if (c.length === 0) { console.error('⚠️  узел не найден:', k); continue; }
  for (const n of c) { if (!seen.has(n.key)) { seen.add(n.key); chain.push(n); } }
}
chain.sort((a, b) => a.key.split('/').length - b.key.split('/').length);

if (chain.length === 0) { console.error('❌ цепочки пусты'); process.exit(1); }

console.log('=== ЦЕПОЧКА ===');
for (const n of chain) {
  const effFile = n.summaryFile || n.file;
  const fileExists = effFile ? fs.existsSync(path.isAbsolute(effFile) ? effFile : path.join(m.root, effFile)) : false;
  console.log(`  ${n.key}  [${n.kind}]` + (effFile ? `  → ${effFile} ${fileExists ? '✓' : '✗'}` : '  (no file)'));
}

console.log('\n=== СБОРКА (max ' + MAX + ' байт) ===');
const parts = [];
let total = 0;
for (const n of chain) {
  const effFile = n.summaryFile || n.file;
  if (!effFile) { console.log('  · skip', n.key, '(no file)'); continue; }
  const abs = path.isAbsolute(effFile) ? effFile : path.join(m.root, effFile);
  let raw; try { raw = fs.readFileSync(abs, 'utf8'); } catch { console.log('  · skip', n.key, '(missing: ' + effFile + ')'); continue; }
  const remaining = MAX - total - 300;
  if (remaining < 500) { console.log('  · skip', n.key, '(no space)'); continue; }
  let text = raw, truncated = false;
  if (Buffer.byteLength(text, 'utf8') > remaining) {
    text = text.split('\n').slice(0, 200).join('\n') + '\n\n[обрезано]\n';
    truncated = true;
  }
  const block = `<context key="${n.key}" kind="${n.kind}" title="${n.title}">\n${text.trim()}\n</context>`;
  parts.push(block);
  total += Buffer.byteLength(block, 'utf8');
  console.log(`  ✓ ${n.key}  ${Buffer.byteLength(block, 'utf8')} байт${truncated ? ' (обрезано)' : ''}`);
}

const prompt = 'Ты — ассистент разработчика. Ниже — иерархия контекста проекта.\n\n' + parts.join('\n\n');
console.log('\n=== ИТОГО ===');
console.log('  размер system prompt:', Buffer.byteLength(prompt, 'utf8'), 'байт');
console.log('  ~токенов (÷4):', Math.ceil(prompt.length / 4));

const out = path.join(ROOT, 'recon-output', 'context-prompt-preview.txt');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, prompt);
console.log('\n📄 полный промпт:', out);
console.log('\n=== ПЕРВЫЕ 800 СИМВОЛОВ ===');
console.log(prompt.slice(0, 800) + (prompt.length > 800 ? '\n…' : ''));
