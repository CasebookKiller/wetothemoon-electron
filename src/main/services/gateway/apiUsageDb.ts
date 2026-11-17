// src/main/services/gateway/apiUsageDb.ts
//
// Учёт расхода DeepSeek API. Append-only JSONL: ~/.config/wetothemoon-electron/api-usage.jsonl
// Не трогает gateway.db, чтобы не рисковать миграциями. Легко мигрировать в SQLite позже.

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface ApiUsageRecord {
  ts: number;                    // epoch ms
  profileId: string;
  model: string;
  effort: string | null;
  promptTokens: number;
  completionTokens: number;      // включает reasoning
  reasoningTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  costOffPeakUsd: number;
  costPeakUsd: number;
}

// Цены DeepSeek (USD за 1M токенов). ⚠️ Проверяй на platform.deepseek.com/pricing.
// Off-peak = 16:30–00:30 UTC; peak = 00:30–16:30 UTC.
export const PRICING: Record<string, {
  inputCacheHit:  { off: number; peak: number };
  inputCacheMiss: { off: number; peak: number };
  output:         { off: number; peak: number };
}> = {
  'deepseek-flash': {
    inputCacheHit:  { off: 0.003, peak: 0.006 },
    inputCacheMiss: { off: 0.15,  peak: 0.30  },
    output:         { off: 0.60,  peak: 1.20  },
  },
  'deepseek-v4-pro': {
    inputCacheHit:  { off: 0.022, peak: 0.044 },
    inputCacheMiss: { off: 0.66,  peak: 1.32  },
    output:         { off: 1.98,  peak: 3.96  },
  },
};

// Алиасы → какой реальный прайс применять (консервативно: reasoner → pro).
const ALIAS_TO_PRICING: Record<string, string> = {
  'deepseek-chat':     'deepseek-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
};

function resolvePricingKey(model: string): string {
  if (PRICING[model]) return model;
  if (ALIAS_TO_PRICING[model]) return ALIAS_TO_PRICING[model];
  for (const k of Object.keys(PRICING)) if (model.startsWith(k)) return k;
  return 'deepseek-flash';
}

/** Peak: 00:30–16:30 UTC. Off-peak: остальное. */
export function isPeak(tsMs: number): boolean {
  const d = new Date(tsMs);
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  return m >= 30 && m < 16 * 60 + 30;
}

export interface CostArgs {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export function estimateCost(a: CostArgs): { costOffPeakUsd: number; costPeakUsd: number } {
  const p = PRICING[resolvePricingKey(a.model)];
  const M = 1_000_000;
  const hit  = a.cacheHitTokens  / M;
  const miss = a.cacheMissTokens / M;
  const out  = a.completionTokens / M;
  return {
    costOffPeakUsd: hit * p.inputCacheHit.off  + miss * p.inputCacheMiss.off  + out * p.output.off,
    costPeakUsd:    hit * p.inputCacheHit.peak + miss * p.inputCacheMiss.peak + out * p.output.peak,
  };
}

function getFilePath(): string {
  const userData = app.getPath('userData');
  return path.join(userData, 'api-usage.jsonl');
}

export interface RecordArgs extends CostArgs {
  profileId: string;
  effort: string | null;
  reasoningTokens: number;
}

export function recordUsage(args: RecordArgs): ApiUsageRecord | null {
  try {
    const ts = Date.now();
    const { costOffPeakUsd, costPeakUsd } = estimateCost(args);
    const rec: ApiUsageRecord = {
      ts,
      profileId: args.profileId,
      model: args.model,
      effort: args.effort,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      reasoningTokens: args.reasoningTokens,
      cacheHitTokens: args.cacheHitTokens,
      cacheMissTokens: args.cacheMissTokens,
      costOffPeakUsd, costPeakUsd,
    };
    fs.appendFileSync(getFilePath(), JSON.stringify(rec) + '\n', 'utf8');
    return rec;
  } catch (e) {
    console.warn('[apiUsageDb] recordUsage failed:', (e as Error).message);
    return null;
  }
}

export interface UsageSummary {
  records: number;
  totalUsdOffPeak: number;
  totalUsdPeak: number;
  byModel: Record<string, { records: number; usdOffPeak: number; usdPeak: number; tokens: number }>;
  firstTs: number | null;
  lastTs: number | null;
}

export function summary(opts: { sinceMs?: number; profileId?: string } = {}): UsageSummary {
  const out: UsageSummary = {
    records: 0, totalUsdOffPeak: 0, totalUsdPeak: 0,
    byModel: {}, firstTs: null, lastTs: null,
  };
  const fp = getFilePath();
  if (!fs.existsSync(fp)) return out;
  const since = opts.sinceMs ?? 0;
  for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r: ApiUsageRecord;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.ts < since) continue;
    if (opts.profileId && r.profileId !== opts.profileId) continue;
    out.records++;
    out.totalUsdOffPeak += r.costOffPeakUsd;
    out.totalUsdPeak += r.costPeakUsd;
    const b = out.byModel[r.model] ??= { records: 0, usdOffPeak: 0, usdPeak: 0, tokens: 0 };
    b.records++;
    b.usdOffPeak += r.costOffPeakUsd;
    b.usdPeak += r.costPeakUsd;
    b.tokens += r.promptTokens + r.completionTokens;
    if (out.firstTs === null || r.ts < out.firstTs) out.firstTs = r.ts;
    if (out.lastTs === null || r.ts > out.lastTs) out.lastTs = r.ts;
  }
  return out;
}

export interface Budget {
  totalUsd: number;
  spentUsd: number;       // худший из двух (peak)
  spentUsdPeak: number;
  remainingUsd: number;
}

/** Бюджет: DEEPSEEK_BUDGET_USD или VITE_DEEPSEEK_BUDGET_USD в env. Если 0 — не настроен. */
export function budget(): Budget {
  const total = parseFloat(
    process.env.DEEPSEEK_BUDGET_USD || process.env.VITE_DEEPSEEK_BUDGET_USD || '0'
  ) || 0;
  const s = summary();
  const worst = Math.max(s.totalUsdPeak, s.totalUsdOffPeak);
  return {
    totalUsd: total,
    spentUsd: worst,
    spentUsdPeak: s.totalUsdPeak,
    remainingUsd: total > 0 ? Math.max(0, total - worst) : 0,
  };
}
