// src/main/services/gateway/handoffBuilder.ts

import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { getGatewayCache } from './cache/db';
import { getChain } from './contextService';

export interface HandoffOpts {
  moduleId: string;
  workspaceKeys?: string[];
  taskTitle: string;
  rootPath?: string;               // default: process.cwd()
  includeGit?: boolean;            // default true
  includePreflight?: boolean;      // default true
  includeSchema?: boolean;         // default true
  includeRoadmap?: boolean;        // default true
  includeIntent?: boolean;         // default true — architecture/roadmap/problems/next-steps
  maxContextBytes?: number;        // default 60_000
  selectedTopics?: string[];       // если задан — только эти topics (по basename без .md). Пустой = все
  selectedFiles?: string[];        // если задан — только эти intent-файлы (по fname). Пустой = все
}

export interface BuiltHandoff {
  markdown: string;
  sections: string[];
  bytes: number;
  generatedAt: number;
}

const execAsync = promisify(exec);

async function sh(cmd: string, cwd: string, timeoutMs = 10_000): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return (stdout || '').trim() || (stderr || '').trim();
  } catch (e: any) {
    const out = (e.stdout || '').toString().trim();
    const err = (e.stderr || '').toString().trim();
    return `[error] ${e.message}${out ? '\n' + out : ''}${err ? '\n' + err : ''}`;
  }
}


function readCommon(rootPath: string, fname: string): string {
  const candidates = [
    path.join(rootPath, 'prompts', '_common', fname),
    path.join(rootPath, 'docs', 'prompts', '_common', fname),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch { /* ignore */ }
  }
  return '';
}

/**
 * Читает файл из корня модуля: docs/prompts/<module>/<fname>.
 * Для COMMON_CONTEXT.md, PROJECT_STATE.md, 00_MASTER_INDEX.md (по стандарту
 * docs/prompts/_common/HANDOFF_STRUCTURE.md от 2026-11-20).
 *
 * Возвращает '' если файла нет — это нормально в переходный период:
 * legacy-модули продолжат работать без этих файлов.
 */
function readModuleRoot(rootPath: string, moduleId: string, fname: string): string {
  const candidates = [
    path.join(rootPath, 'docs', 'prompts', moduleId, fname),
    path.join(rootPath, 'prompts', moduleId, fname),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch { /* ignore */ }
  }
  return '';
}

/**
 * Читает все topics/*.md из docs/prompts/<module>/topics/.
 * Сортирует по имени (NN_ — порядок). Возвращает [] если папки нет.
 * По стандарту _common/HANDOFF_STRUCTURE.md — 1 файл = 1 направление.
 */
function readTopics(
  rootPath: string,
  moduleId: string,
  selectedTopics?: string[]
): Array<{ name: string; content: string }> {
  const candidates = [
    path.join(rootPath, 'docs', 'prompts', moduleId, 'topics'),
    path.join(rootPath, 'prompts', moduleId, 'topics'),
  ];
  const filterSet = (selectedTopics && selectedTopics.length > 0)
    ? new Set(selectedTopics)
    : null;
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .filter(f => {
          if (!filterSet) return true;
          return filterSet.has(f.replace(/\.md$/, ''));
        })
        .map(f => ({
          name: f.replace(/\.md$/, ''),
          content: fs.readFileSync(path.join(dir, f), 'utf8').trim(),
        }))
        .filter(t => t.content.length > 0);
    } catch { /* ignore */ }
  }
  return [];
}

export async function buildHandoff(opts: HandoffOpts): Promise<BuiltHandoff> {
  const ROOT = opts.rootPath ?? process.cwd();
  const cfg = MODULE_MAP[opts.moduleId];
  if (!cfg) {
    throw new Error(`Неизвестный moduleId: ${opts.moduleId}. Доступные: ${Object.keys(MODULE_MAP).join(', ')}`);
  }
  const workspaceKeys = opts.workspaceKeys ?? cfg.workspaceKeys;
  const sections: string[] = [];
  const parts: string[] = [];

  parts.push(`# Handoff — ${new Date().toISOString()}\n`);
  parts.push(`**Task:** ${opts.taskTitle}\n`);
  sections.push('title', 'task');

  // 0c. Недавно сделано — из git log (авто, не требует ручной поддержки)
  parts.push(`## ✅ Недавно сделано (git log -10)

\`\`\`
${await sh('git log --oneline -10 --no-decorate', ROOT)}
\`\`\`

> Полный список «Сделано / НЕ откатывать» — в \`docs/prompts/${opts.moduleId}/handoff/done.md\` (если есть).
`);
  sections.push('done-recent');

  // 0. Intent — намерения, не код
  if (opts.includeIntent !== false) {
    // structure: 'topics' → topics/*.md; 'legacy' (default) → handoff/{roadmap,problems,techdebt}.md.
    // Fallback: если 'topics', но topics/ пуст — переключаемся на legacy для этого вызова.
    let effectiveStructure: 'topics' | 'legacy' = cfg.structure ?? 'legacy';
    let topicsContent: Array<{ name: string; content: string }> = [];
    if (effectiveStructure === 'topics') {
      topicsContent = readTopics(ROOT, opts.moduleId, opts.selectedTopics);
      if (topicsContent.length === 0) {
        console.warn(`[handoffBuilder] ${opts.moduleId}: structure='topics', но topics/ пуст → fallback на legacy`);
        effectiveStructure = 'legacy';
      }
    }

    const intentFiles: Array<[string, string, 'module' | 'module-root' | 'legacy' | 'common']> = [
      ['ban-pattern.md',     '## ⏱ Паттерн бана',              'common'],
      // module-root — новые файлы стандарта HANDOFF_STRUCTURE (2026-11-20).
      // Если файла нет — пропускается, legacy продолжает работать.
      ['00_MASTER_INDEX.md', '## 📑 Индекс модуля',            'module-root'],
      ['COMMON_CONTEXT.md',  '## 📘 Общий контекст модуля',    'module-root'],
      ['PROJECT_STATE.md',   '## 📊 Состояние проекта',        'module-root'],
      ['next-steps.md',      '## 🚀 С чего начать',             'module'],
      ['done.md',            '## ✅ Сделано / НЕ откатывать',    'module'],
      ['architecture.md',    '## 🏛 Архитектурные принципы',    'module'],
      ['checklist.md',       '## ✅ Финальный чек-лист',         'common'],
      // legacy — читаем только если structure='legacy' (или fallback)
      ['roadmap.md',         '## 📋 Roadmap',                   'legacy'],
      ['problems.md',        '## 🐞 Известные проблемы',        'legacy'],
      ['techdebt.md',        '## 🧹 Техдолг',                   'legacy'],
    ];
    let intentAdded = false;
    const selectedFilesSet = (opts.selectedFiles && opts.selectedFiles.length > 0)
      ? new Set(opts.selectedFiles)
      : null;
    for (const [fname, header, scope] of intentFiles) {
      if (selectedFilesSet && !selectedFilesSet.has(fname)) continue;
      let content = '';
      if (scope === 'common') {
        content = readPrompt(ROOT, '_common', fname);
      } else if (scope === 'module-root') {
        content = readModuleRoot(ROOT, opts.moduleId, fname);
      } else if (scope === 'legacy') {
        if (effectiveStructure === 'legacy') {
          content = readPrompt(ROOT, opts.moduleId, fname);
        }
      } else {
        content = readPrompt(ROOT, opts.moduleId, fname);
      }
      if (content) {
        parts.push(`${header}\n\n${content}\n`);
        intentAdded = true;
      }
    }

    // Topics (structure='topics') — после intent-файлов
    if (effectiveStructure === 'topics' && topicsContent.length > 0) {
      parts.push(`## 🗂 Topics (${topicsContent.length})\n`);
      for (const t of topicsContent) {
        parts.push(`### ${t.name}\n\n${t.content}\n`);
      }
      sections.push('topics');
      intentAdded = true;
    }

    if (intentAdded) sections.push('intent');
  }

  // 0b. Мета-инструкция: как поддерживать handoff в актуальном виде
  parts.push(`## 🔄 Как поддерживать handoff в актуальном виде

После завершения этапа разработки (в конце сессии, перед \`wm-backup\`) — **обнови intent-файлы**:

| Файл | Когда обновлять | Что менять |
|---|---|---|
| \`docs/prompts/${opts.moduleId}/handoff/roadmap.md\` | Задача закрыта / появилась новая | Убрать из «Ближайшие» → перенести в «Закрытые» или удалить. Добавить новое в «Следующие сессии» |
| \`docs/prompts/${opts.moduleId}/handoff/problems.md\` | Проблема решена / найдена новая | Решённое → в «Закрытые» (или удалить). Новое — с симптомом, причиной, фиксом |
| \`docs/prompts/${opts.moduleId}/handoff/techdebt.md\` | Долг закрыт / обнаружен | То же: закрытое → в «Закрытые», новое — с приоритетом |
| \`docs/prompts/${opts.moduleId}/handoff/architecture.md\` | Появился новый принцип | Добавить в конец, **старое не удалять** (архитектура — накопительная) |
| \`docs/prompts/${opts.moduleId}/summary.md\` | Изменилась архитектура модуля | Обновить цифры, роли, координаторов, стек |
| \`docs/prompts/${opts.moduleId}/handoff/next-steps.md\` | Изменился приоритет | Обновить «Приоритет на сессию» |
| \`docs/prompts/${opts.moduleId}/handoff/done.md\` | Что-то сделано / появилось «не откатывать» | Добавить строку в таблицу «Сделано». Правила/запреты — в «Правила работы» и «Что нельзя откатывать» |

**Формат правок:** «найти → заменить» (два блока: что найти, на что заменить). Не diff, не «весь файл заново», не «вставь после строки N». Не можешь найти — попроси \`grep -n\` и работай по выводу.

**Когда обновлять:**
- В конце сессии, **перед** \`wm-backup\` (иначе бэкап снимет старое)
- После завершения крупного этапа
- **Не автоматически** — только осознанно, чтобы не замусорить intent-файлы

**Проверка:** после обновления — \`git diff docs/prompts/${opts.moduleId}/handoff/\` должен быть осмысленным, не пустым (если этап был).
`);
  sections.push('meta-instructions');

  // 1. Git state
  if (opts.includeGit !== false) {
    const head     = await sh('git rev-parse --short HEAD', ROOT);
    const branch   = await sh('git rev-parse --abbrev-ref HEAD', ROOT);
    const status   = (await sh('git status --short', ROOT)) || '(clean)';
    const log      = await sh('git log --oneline -15', ROOT);
    const diffstat = (await sh('git diff --stat HEAD~5 HEAD 2>/dev/null', ROOT)) || '(n/a)';
    const submod   = (await sh("git -C .. submodule status 2>/dev/null | grep wetothemoon-electron", ROOT)) || '(n/a)';
    parts.push(`## Git state

- **HEAD:** \`${head}\` (branch \`${branch}\`)
- **Submodule:** ${submod}

### git status --short
\`\`\`
${status}
\`\`\`

### git log --oneline -5
\`\`\`
${log}
\`\`\`

### git diff --stat HEAD~5 HEAD
\`\`\`
${diffstat}
\`\`\`
`);
    sections.push('git');
  }

  // 2. Preflight
  if (opts.includePreflight !== false) {
    const pf = await sh('node scripts/preflight-check.mjs --fast 2>&1', ROOT, 60_000);
    parts.push(`## Preflight\n\n\`\`\`\n${pf}\n\`\`\`\n`);
    sections.push('preflight');
  }

  // 3. Schema
  if (opts.includeSchema !== false) {
    try {
      if (cfg.db === 'prana_bindu') {
        // prana_bindu.db — Melange
        const { DatabaseSync } = await import('node:sqlite');
        const dbPath = path.join(process.env.HOME || '', '.config', 'wetothemoon-electron', 'prana_bindu.db');
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const schemaVer = (db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as any)?.value;
        const tables = (db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).all() as any[]).map(r => r.name);
        const counts: Record<string, number> = {};
        for (const t of ['run_facts','run_streams','recovery_logs','plan_events','chains','workout_sessions','water_logs','weight_logs','nutrition_logs','exercise_progress','equivalences']) {
          if (tables.includes(t)) {
            try { counts[t] = (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as any)?.c ?? 0; } catch { counts[t] = -1; }
          }
        }
        db.close();
        parts.push(`## Schema — prana_bindu.db (Melange)

- **schema_version:** ${schemaVer}
- **Tables (${tables.length}):** ${tables.join(', ')}
- **Counts:** ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}
`);
      } else {
        // gateway.db
        const db = getGatewayCache();
        const uv = (db.prepare('PRAGMA user_version').get() as any)?.user_version;
        const tables = (db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).all() as any[]).map(r => r.name);
        const counts: Record<string, number> = {};
        for (const t of ['context_nodes', 'context_versions', 'conversations', 'messages']) {
          if (tables.includes(t)) {
            counts[t] = (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as any)?.c ?? 0;
          }
        }
        const nodes = (db.prepare(
          'SELECT key, kind, version FROM context_nodes ORDER BY key'
        ).all() as any[]);
        parts.push(`## Schema — gateway.db

- **user_version:** ${uv}
- **Tables (${tables.length}):** ${tables.join(', ')}
- **Counts:** ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}

### context_nodes (${nodes.length})

| key | kind | version |
|---|---|---|
${nodes.map(n => `| ${n.key} | ${n.kind} | ${n.version} |`).join('\n')}
`);
      }
      sections.push('schema');
    } catch (e: any) {
      parts.push(`## Schema\n\n[error] ${e.message}\n`);
      sections.push('schema');
    }
  }

  // 4. Context chain
  try {
    const chain = getChain(workspaceKeys);
    // Для submodule/module — 2000 символов (summary.md обычно длиннее 500).
    // Для direction — 800 (там короткие roadmap-выжимки).
    const MAX_BY_KIND: Record<string, number> = {
      global: 1000, project: 1500, submodule: 2000, module: 2500, direction: 800,
    };
    const md = chain.map((n: any) => {
      const MAX = MAX_BY_KIND[n.kind] ?? 800;
      const c = n.contentMd || '';
      // Разные лимиты по kind: direction короткие, module/summary длиннее
      const kindLimit = n.kind === 'module' ? 2500
                       : n.kind === 'submodule' ? 2000
                       : n.kind === 'project' ? 1500
                       : n.kind === 'global' ? 1000
                       : 800;
      const preview = c.slice(0, kindLimit);
      const trunc = c.length > kindLimit ? '\n\n_(обрезано)_' : '';
      return `### ${n.key} [${n.kind}] v${n.version ?? '?'}\n\n${preview}${trunc}`;
    }).join('\n\n---\n\n');
    parts.push(`## Context chain (${chain.length} узлов)\n\n${md}\n`);
    sections.push('context');
  } catch (e: any) {
    parts.push(`## Context chain\n\n[error] ${e.message}\n`);
    sections.push('context');
  }

  // 5. Roadmap / TODOs
  if (opts.includeRoadmap !== false) {
    const todos = (await sh(
      `grep -rn 'TODO\\|FIXME' ${cfg.grepPath} 2>/dev/null | head -20`,
      ROOT
    )) || '(нет)';
    parts.push(`## Roadmap / TODOs\n\n\`\`\`\n${todos}\n\`\`\`\n`);
    sections.push('roadmap');
  }

  let markdown = parts.join('\n');
  const limit = opts.maxContextBytes ?? 60_000;
  if (markdown.length > limit) {
    markdown = markdown.slice(0, limit) + '\n\n_[handoff обрезан по бюджету]_';
  }

  return {
    markdown,
    sections,
    bytes: Buffer.byteLength(markdown, 'utf8'),
    generatedAt: Date.now(),
  };
}

// ============================================================
// MODULE_MAP — маппинг moduleId → параметры сборки handoff
// ============================================================

export const MODULE_MAP: Record<string, {
  title: string;
  workspaceKeys: string[];
  db: 'gateway' | 'prana_bindu';
  grepPath: string;
  /** 'topics' — читать topics/*.md; 'legacy' (default) — handoff/{roadmap,problems,techdebt}.md.
   *  При 'topics' и пустом topics/ — fallback на legacy (warning в консоль). */
  structure?: 'topics' | 'legacy';
}> = {
  gateway: {
    title: 'Gateway (DeepSeek)',
    workspaceKeys: [
      'wetothemoon-electron/gateway',
      'wetothemoon-electron/gateway/api-channel',
    ],
    db: 'gateway',
    grepPath: 'src/main/services/gateway/ src/main/ipcHandlers/gatewayHandlers.ts',
    structure: 'topics',
  },
  'prana-bindu': {
    title: 'Prana-Bindu (тренировки тела)',
    workspaceKeys: [
      'wetothemoon-electron/prana-bindu',
    ],
    db: 'prana_bindu',
    grepPath: 'src/main/services/pranaBindu/ src/main/ipcHandlers/pranaBinduHandlers.ts',
  },
  osint: {
    title: 'OSINT (Fremen Eye)',
    workspaceKeys: ['wetothemoon-electron/osint'],
    db: 'gateway',
    grepPath: 'src/main/services/osint/ src/main/ipcHandlers/osintHandlers.ts',
  },
  sietch: {
    title: 'Sietch',
    workspaceKeys: ['wetothemoon-electron/sietch'],
    db: 'gateway',
    grepPath: 'src/main/services/sietch/ src/main/ipcHandlers/sietchHandlers.ts',
  },
};

function readPrompt(rootPath: string, moduleId: string, fname: string): string {
  // Порядок: <module>/handoff/ → _common/
  const candidates = [
    path.join(rootPath, 'docs', 'prompts', moduleId, 'handoff', fname),
    path.join(rootPath, 'docs', 'prompts', '_common', fname),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch { /* ignore */ }
  }
  return '';
}