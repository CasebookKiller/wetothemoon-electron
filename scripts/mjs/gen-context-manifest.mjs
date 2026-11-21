// scripts/gen-context-manifest.mjs
// Генерирует черновик context.manifest.json из .md-файлов проекта.
// Эвристика — только стартовая точка. Пользователь правит руками.

/**
 * @name gen-context-manifest
 * @purpose Генерация context.manifest.json из docs/prompts/<module>/ иерархии
 * @input argv: --module <id> (опционально)
 * @output context.manifest.json
 * @args { "type": "object", "properties": { "module": { "type": "string" } } }
 * @result null
 * @exit 0 — успех
 * @exit 1 — ошибка
 * @tool false
 * @example node scripts/mjs/gen-context-manifest.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.argv[2] || '/home/ll/Документы/GitHub/wetothemoon-project/wetothemoon-electron';
const OUT  = path.join(ROOT, 'context.manifest.json');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'recon-output', 'recon-out', 'md-recon', 'captures']);
const SKIP_PATH_PARTS = ['docs/archive/', 'templates/prompts/', 'scripts/', 'docs/prompts/chats/'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (e.name.startsWith('.')) continue;
      walk(full, acc);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      if (SKIP_PATH_PARTS.some(p => rel.includes(p))) continue;
      acc.push(rel);
    }
  }
  return acc;
}

const files = walk(ROOT);

// Эвристика: (rel, name) → { kind, parent_hint }
function classify(rel, name) {
  const lower = name.toLowerCase();
  const inChats = rel.includes('docs/prompts/chats/') || rel.includes('/chats/');
  const inDocsPrompts = rel.includes('docs/prompts/');

  if (/^global|^00|common_context/i.test(name)) return { kind: 'global' };
  if (/^project_state|^project-?state/i.test(name)) return { kind: 'state' };
  if (/^readme/i.test(name)) {
    if (rel === 'README.md' || rel === 'README.template.md') return { kind: 'submodule' };
    return { kind: 'module' }; // README в подпапке
  }
  if (/roadmap/i.test(name)) return { kind: 'roadmap' };
  if (/^master_index|^index/i.test(name)) return { kind: 'index' };

  // GATEWAY_* / OSINT_* / PRANA_* / SIETCH_* / TASKS_* / TRADING_*
  const moduleMatch = lower.match(/^(gateway|osint|sietch|tasks|prana|trading|ai|ollama)/);
  if (moduleMatch) return { kind: 'module', module: moduleMatch[1] };

  if (inChats) return { kind: 'direction', module: lower.replace(/^\d+_/, '').replace(/\.md$/, '') };

  if (inDocsPrompts) return { kind: 'direction' };

  return { kind: 'direction' }; // fallback
}

// Строим черновик: все файлы — плоский список + parent по эвристике
const nodes = [];
const projectRoot = { key: 'wetothemoon-project', kind: 'project', title: 'WeToTheMoon Project', parent: null, file: null };
const subRoot = { key: 'wetothemoon-electron', kind: 'submodule', title: 'Electron Submodule', parent: 'wetothemoon-project', file: 'README.md' };
const globalNode = { key: 'global', kind: 'global', title: 'Global Context', parent: null, file: null };

// global — всегда отдельный корень
nodes.push(globalNode);
nodes.push(projectRoot);
nodes.push(subRoot);

let idx = 0;
for (const rel of files.sort()) {
  if (rel === 'README.md' || rel === 'README.template.md') continue; // уже subRoot
  const cls = classify(rel, path.basename(rel));
  idx++;

  let parent = 'wetothemoon-electron';
  let key = null;

  if (cls.kind === 'module' && cls.module) {
    const moduleKey = `wetothemoon-project/wetothemoon-electron/${cls.module}`;
    // создаём узел модуля если его ещё нет
    if (!nodes.find(n => n.key === moduleKey)) {
      nodes.push({ key: moduleKey, kind: 'module', title: cls.module.toUpperCase(), parent: 'wetothemoon-electron', file: null });
    }
    parent = moduleKey;
    // файл внутри модуля получает свой key, родитель — moduleKey
    const safeName = path.basename(rel).replace(/\.md$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
    key = `${moduleKey}/${safeName}`;
  }

  const safeName = path.basename(rel).replace(/\.md$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
  if (!key) key = `wetothemoon-project/wetothemoon-electron/${safeName}`;

  // если такой файл уже добавлен — добавляем суффикс
  let finalKey = key;
  let n = 1;
  while (nodes.find(n => n.key === finalKey && n.file)) {
    finalKey = `${key}--${n++}`;
  }

  nodes.push({
    key: finalKey,
    kind: cls.kind === 'module' && !cls.module ? 'direction' : cls.kind,
    title: path.basename(rel).replace(/\.md$/, ''),
    parent,
    file: rel,
  });
}

const manifest = {
  version: 1,
  root: ROOT,
  generatedAt: new Date().toISOString(),
  hint: 'Отредактируй kind/parent/title для нужной иерархии. Файлы можно перемещать между узлами.',
  nodes,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
console.log('✅ манифест создан:', OUT);
console.log('   узлов:', nodes.length);
console.log('\n=== дерево ===');
const byParent = new Map();
for (const n of nodes) {
  const p = n.parent || '__root__';
  if (!byParent.has(p)) byParent.set(p, []);
  byParent.get(p).push(n);
}
function printTree(parentKey, depth) {
  const children = byParent.get(parentKey) || [];
  for (const c of children) {
    console.log('  '.repeat(depth) + '· ' + c.key + '  [' + c.kind + ']' + (c.file ? '  → ' + c.file : ''));
    printTree(c.key, depth + 1);
  }
}
printTree('__root__', 0);
