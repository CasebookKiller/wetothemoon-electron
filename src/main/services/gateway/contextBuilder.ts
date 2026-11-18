// src/main/services/gateway/contextBuilder.ts
//
// Сборка system prompt из иерархии контекстов.
// Пока источник — context.manifest.json + файлы на диске.
// Позже будет переключено на БД (context_nodes) без изменения интерфейса.

import fs from 'node:fs';
import path from 'node:path';

export interface ContextNode {
  key: string;
  kind: string;
  title: string;
  parent: string | null;
  file: string | null;
}

export interface ContextManifest {
  version: 1;
  root: string;
  nodes: ContextNode[];
}

export interface BuildOpts {
  manifestPath: string;
  /** Один или несколько активных direction'ов (workspace per conversation). */
  activeKeys: string | string[];
  /** Максимальный размер итогового промпта в байтах. */
  maxBytes?: number;
  /** Если true — не включаем global (для узкоспециализированных чатов). */
  skipGlobal?: boolean;
}

export interface BuiltContext {
  systemPrompt: string;
  includedNodes: Array<{ key: string; kind: string; bytes: number; truncated: boolean }>;
  skippedNodes: string[];
  totalBytes: number;
}

const DEFAULT_MAX = 60_000;

function loadManifest(p: string): ContextManifest {
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!raw?.nodes || !Array.isArray(raw.nodes)) throw new Error('manifest: нет nodes');
  return raw;
}

function findNode(manifest: ContextManifest, key: string): ContextNode | null {
  return manifest.nodes.find(n => n.key === key) ?? null;
}

function chainOf(manifest: ContextManifest, key: string): ContextNode[] {
  const chain: ContextNode[] = [];
  const seen = new Set<string>();
  let cur = findNode(manifest, key);
  while (cur) {
    if (seen.has(cur.key)) break;
    seen.add(cur.key);
    chain.unshift(cur);            // root первым
    cur = cur.parent ? findNode(manifest, cur.parent) : null;
  }
  return chain;
}

function readFileSafe(abs: string): string | null {
  try { return fs.readFileSync(abs, 'utf8'); } catch { return null; }
}

/** Обрезает markdown до maxBytes, стараясь сохранить структуру по заголовкам. */
function truncateMd(md: string, maxBytes: number): { text: string; truncated: boolean } {
  if (Buffer.byteLength(md, 'utf8') <= maxBytes) return { text: md, truncated: false };
  // режем по строкам до лимита
  const lines = md.split('\n');
  let acc = '';
  for (const l of lines) {
    if (Buffer.byteLength(acc + l + '\n', 'utf8') > maxBytes) break;
    acc += l + '\n';
  }
  return { text: acc + '\n\n[контекст обрезан по размеру]\n', truncated: true };
}

export function buildContext(opts: BuildOpts): BuiltContext {
  const manifest = loadManifest(opts.manifestPath);
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX;

  const activeKeys = Array.isArray(opts.activeKeys) ? opts.activeKeys : [opts.activeKeys];
  if (activeKeys.length === 0) throw new Error('activeKeys пуст');

  // объединяем цепочки всех активных ключей, дедуп по key (global/project/submodule общие)
  const seen = new Set<string>();
  let chain: ContextNode[] = [];
  for (const k of activeKeys) {
    const c = chainOf(manifest, k);
    if (c.length === 0) throw new Error(`узел не найден: ${k}`);
    for (const n of c) {
      if (seen.has(n.key)) continue;
      seen.add(n.key);
      chain.push(n);
    }
  }

  // сортируем: global → project → submodule → module → direction (по глубине key)
  chain.sort((a, b) => a.key.split('/').length - b.key.split('/').length);

  if (opts.skipGlobal) chain = chain.filter(n => n.kind !== 'global');

  const includedNodes: BuiltContext['includedNodes'] = [];
  const skippedNodes: string[] = [];
  const parts: string[] = [];
  let total = 0;

  for (const node of chain) {
    const effectiveFile = (node as any).summaryFile || node.file;
    if (!effectiveFile) { skippedNodes.push(node.key + ' (no file)'); continue; }
    const abs = path.isAbsolute(effectiveFile) ? effectiveFile : path.join(manifest.root, effectiveFile);
    const raw = readFileSafe(abs);
    if (!raw) { skippedNodes.push(node.key + ' (file missing: ' + effectiveFile + ')'); continue; }

    const remaining = maxBytes - total;
    if (remaining < 500) { skippedNodes.push(node.key + ' (no space left)'); continue; }

    const { text, truncated } = truncateMd(raw, remaining - 200);
    const block =
      `<context key="${node.key}" kind="${node.kind}" title="${escapeAttr(node.title)}">\n` +
      text.trim() +
      `\n</context>`;
    parts.push(block);
    total += Buffer.byteLength(block, 'utf8');
    includedNodes.push({ key: node.key, kind: node.kind, bytes: Buffer.byteLength(block, 'utf8'), truncated });
  }

  const systemPrompt =
    'Ты — ассистент разработчика. Ниже — иерархия контекста проекта. ' +
    'Используй её, чтобы отвечать в контексте задачи. Если чего-то не хватает — спроси.\n\n' +
    parts.join('\n\n');

  return { systemPrompt, includedNodes, skippedNodes, totalBytes: total };
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Continuation prompt: структурированный промпт для продолжения разработки.
// Отличие от buildContext():
//   - извлечённые секции (✅ Выполнено / 🎯 В работе / Ближайшие)
//   - бюджет на узел по kind (global 6K / project 2K / submodule 3K / module 4K / direction 3K)
//   - общий лимит 20K (вместо 60K у buildContext)
//   - возвращает skippedNodes (что не влезло)
// ─────────────────────────────────────────────────────────────────────────────

const CONT_BUDGET_BY_KIND: Record<string, number> = {
  global:    6000,
  project:   2000,
  submodule: 3000,
  module:    4000,
  direction: 3000,
};

/** Обрезает markdown по байтам, стараясь сохранить целые строки. */
function clampMdContinuation(md: string, maxBytes: number): string {
  if (!md) return '';
  if (Buffer.byteLength(md, 'utf8') <= maxBytes) return md;
  const lines = md.split('\n');
  let acc = '';
  for (const l of lines) {
    if (Buffer.byteLength(acc + l + '\n', 'utf8') > maxBytes - 40) break;
    acc += l + '\n';
  }
  return acc + '\n_[(контекст обрезан по бюджету)]_\n';
}

/** Извлекает из roadmap-подобного markdown три секции: done / inProgress / next. */
function extractContinuationSections(md: string | null): {
  done: string[]; inProgress: string[]; next: string[];
} {
  const out = { done: [] as string[], inProgress: [] as string[], next: [] as string[] };
  if (!md) return out;
  let cur: 'done' | 'inProgress' | 'next' | null = null;
  for (const line of md.split('\n')) {
    if (/^##\s/.test(line)) {
      const t = line.toLowerCase();
      cur = (t.includes('выполнено') || t.includes('✅')) ? 'done'
          : (t.includes('в работе') || t.includes('🎯')) ? 'inProgress'
          : (t.includes('ближайшие') || t.includes('next')) ? 'next'
          : null;
      continue;
    }
    if (!cur) continue;
    const b = line.match(/^\s*[-*]\s+(?:\[[x ]\]\s+)?(.+)$/);
    if (b) out[cur].push(b[1].trim());
  }
  return out;
}

export interface BuildContinuationOpts {
  manifestPath: string;
  activeKeys: string[];
  taskTitle: string;
  maxBytes?: number;
}

export interface BuiltContinuation {
  systemPrompt: string;
  bytes: number;
  includedNodes: string[];
  skippedNodes: string[];
  /** Откуда взята цепочка: БД (contextService) или FS (манифест). */
  source: 'db' | 'fs';
}

/**
 * Собирает continuation-промпт для продолжения разработки.
 * Пример:
 *   const r = await buildContinuationSystemPrompt({
 *     manifestPath: '/path/to/context.manifest.json',
 *     activeKeys: ['wetothemoon-electron/gateway', 'wetothemoon-electron/gateway/api-channel'],
 *     taskTitle: 'Внедрение patchright + API-канал',
 *   });
 */
export async function buildContinuationSystemPrompt(
  opts: BuildContinuationOpts,
): Promise<BuiltContinuation> {
  const maxBytes = opts.maxBytes ?? 20_000;
  if (!opts.activeKeys || opts.activeKeys.length === 0) {
    throw new Error('activeKeys пуст');
  }

  // ─── Источник: сначала БД, fallback на FS ─────────────────────────
  // Формат chainNode: { key, kind, title, contentMd } — общий для обоих источников.
  type ChainNode = { key: string; kind: string; title: string; contentMd: string | null };

  let chain: ChainNode[] = [];
  let source: 'db' | 'fs' = 'fs';
  let skippedFromSource: string[] = [];

  try {
    const dbMod = await import('./contextService');
    // Проверим, что все activeKeys есть в БД. Если хоть один отсутствует —
    // считаем БД неполной и уходим на FS (лучше полный промпт, чем дырявой).
    const checkAll = opts.activeKeys.every((k) => !!dbMod.getNode(k));
    if (checkAll) {
      const dbChain = dbMod.getChain(opts.activeKeys);
      if (dbChain.length > 0) {
        chain = dbChain.map((n) => ({
          key: n.key,
          kind: n.kind,
          title: n.title,
          contentMd: n.contentMd || null,
        }));
        source = 'db';
      }
    } else {
      skippedFromSource.push('db: не все activeKeys найдены в context_nodes');
    }
  } catch (e) {
    skippedFromSource.push('db: ' + (e as Error).message);
  }

  // ─── Fallback: FS (манифест) ──────────────────────────────────────
  if (source === 'fs') {
    const manifest = loadManifest(opts.manifestPath);
    const seen = new Set<string>();
    const chainFromFs: ChainNode[] = [];
    for (const k of opts.activeKeys) {
      for (const n of chainOf(manifest, k)) {
        if (seen.has(n.key)) continue;
        seen.add(n.key);
        const eff = (n as any).summaryFile || n.file;
        let contentMd: string | null = null;
        if (eff) {
          const abs = path.isAbsolute(eff) ? eff : path.join(manifest.root, eff);
          contentMd = readFileSafe(abs);
        }
        chainFromFs.push({ key: n.key, kind: n.kind, title: n.title, contentMd });
      }
    }
    chain = chainFromFs;
  }

  // Стабильная сортировка по глубине: global → project → submodule → module → direction.
  // Внутри одной группы — порядок вставки (после unshift в getChain он корректен;
  // для FS-пути chainOf тоже через unshift).
  chain.sort((a, b) => a.key.split('/').length - b.key.split('/').length);

  const parts: string[] = [];
  const includedNodes: string[] = [];
  const skippedNodes: string[] = [...skippedFromSource];

  parts.push(
    `# Продолжение разработки\n\n` +
    `**Workspace:** ${opts.activeKeys.join(' + ')}\n` +
    `**Задача:** ${opts.taskTitle}\n`,
  );

  // 1. global / project / submodule — по бюджету kind
  for (const n of chain.filter(x => ['global', 'project', 'submodule'].includes(x.kind))) {
    if (!n.contentMd) { skippedNodes.push(n.key + ' (no content)'); continue; }
    const budget = CONT_BUDGET_BY_KIND[n.kind] ?? 3000;
    parts.push(`## ${n.title}\n\n${clampMdContinuation(n.contentMd, budget).trim()}\n`);
    includedNodes.push(n.key);
  }

  // 2. module / direction — секциями
  for (const n of chain.filter(x => ['module', 'direction'].includes(x.kind))) {
    if (!n.contentMd) {
      parts.push(`## ${n.title}\n\n_(${n.key}; файл не задан, направление активно)_\n`);
      includedNodes.push(n.key);
      continue;
    }
    const sec = extractContinuationSections(n.contentMd);
    const summary: string[] = [];
    if (sec.done.length)       summary.push(`### ✅ Выполнено\n` + sec.done.slice(0, 10).map(x => `- ${x}`).join('\n'));
    if (sec.inProgress.length) summary.push(`### 🎯 В работе\n` + sec.inProgress.slice(0, 10).map(x => `- ${x}`).join('\n'));
    if (sec.next.length)       summary.push(`### Ближайшие задачи\n` + sec.next.slice(0, 10).map(x => `- ${x}`).join('\n'));

    const budget = CONT_BUDGET_BY_KIND[n.kind] ?? 3000;
    if (summary.length === 0) {
      parts.push(`## ${n.title}\n\n${clampMdContinuation(n.contentMd, budget).trim()}\n`);
    } else {
      parts.push(`## ${n.title}\n\n${clampMdContinuation(summary.join('\n\n'), budget).trim()}\n`);
    }
    includedNodes.push(n.key);
  }

  // 3. инструкция
  parts.push(
    `## Инструкция\n\n` +
    `1. Ознакомься с контекстом выше.\n` +
    `2. Предложи 3-5 конкретных следующих шагов по задаче «${opts.taskTitle}».\n` +
    `3. Для каждого шага укажи: **что делаем** / **файлы** / **зачем**.\n` +
    `4. В конце — «Начинаем с шага 1?» (не пиши код до подтверждения).\n\n` +
    `## Формат\n` +
    `- Markdown, без воды.\n` +
    `- Конкретные имена файлов и методов.\n`,
  );

  let systemPrompt = parts.join('\n\n---\n\n');
  let bytes = Buffer.byteLength(systemPrompt, 'utf8');

  // 4. жёсткий глобальный лимит
  if (bytes > maxBytes) {
    const lines = systemPrompt.split('\n');
    let acc = '';
    for (const l of lines) {
      if (Buffer.byteLength(acc + l + '\n', 'utf8') > maxBytes - 100) break;
      acc += l + '\n';
    }
    systemPrompt = acc + '\n\n_[(промпт обрезан по глобальному лимиту)]_\n';
    bytes = Buffer.byteLength(systemPrompt, 'utf8');
  }

  return { systemPrompt, bytes, includedNodes, skippedNodes, source };
}
