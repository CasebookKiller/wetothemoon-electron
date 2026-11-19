import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { getGatewayCache } from './cache/db';
import { getChain } from './contextService';

export interface HandoffOpts {
  workspaceKeys: string[];
  taskTitle: string;
  rootPath?: string;               // default: process.cwd()
  includeGit?: boolean;            // default true
  includePreflight?: boolean;      // default true
  includeSchema?: boolean;         // default true
  includeRoadmap?: boolean;        // default true
  maxContextBytes?: number;        // default 60_000
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

export async function buildHandoff(opts: HandoffOpts): Promise<BuiltHandoff> {
  const ROOT = opts.rootPath ?? process.cwd();
  const sections: string[] = [];
  const parts: string[] = [];

  parts.push(`# Handoff — ${new Date().toISOString()}\n`);
  parts.push(`**Task:** ${opts.taskTitle}\n`);
  sections.push('title', 'task');

  // 1. Git state
  if (opts.includeGit !== false) {
    const head     = await sh('git rev-parse --short HEAD', ROOT);
    const branch   = await sh('git rev-parse --abbrev-ref HEAD', ROOT);
    const status   = (await sh('git status --short', ROOT)) || '(clean)';
    const log      = await sh('git log --oneline -5', ROOT);
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
      parts.push(`## Schema

- **user_version:** ${uv}
- **Tables (${tables.length}):** ${tables.join(', ')}
- **Counts:** ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}

### context_nodes (${nodes.length})

| key | kind | version |
|---|---|---|
${nodes.map(n => `| ${n.key} | ${n.kind} | ${n.version} |`).join('\n')}
`);
      sections.push('schema');
    } catch (e: any) {
      parts.push(`## Schema\n\n[error] ${e.message}\n`);
      sections.push('schema');
    }
  }

  // 4. Context chain
  try {
    const chain = getChain(opts.workspaceKeys);
    const MAX = 500;
    const md = chain.map((n: any) => {
      const c = n.contentMd || '';
      const preview = c.slice(0, MAX);
      const trunc = c.length > MAX ? '\n\n_(обрезано)_' : '';
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
      "grep -rn 'TODO\\|FIXME' src/main/services/gateway/ src/main/ipcHandlers/gatewayHandlers.ts 2>/dev/null | head -20",
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