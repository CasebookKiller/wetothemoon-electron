// src/main/services/gateway/diagnostics.ts

import { DeepSeekService } from './deepseekService';
import { GatewayCacheService } from './cache/GatewayCacheService';
import { getGatewayCache } from './cache/db';

export interface DiagnosticPwItem {
  pwKey: string;
  role: string;
  branch: string;
  preview: string;
}

export interface DiagnosticDbRow {
  id: string;
  pwKey: string | null;
  role: string;
  sequence: number;
  branchIndex: number;
  branchTotal: number;
  isActive: number;
  hash: string | null;
  preview: string;
}

export interface DiagnosticReport {
  ts: number;
  convId: string;
  convTitle: string | null;
  pwStatus: 'running' | 'stopped';
  pwLoggedIn: boolean;

  pw: {
    ok: boolean;
    error?: string;
    durationMs: number;
    totalCount: number;
    items: DiagnosticPwItem[];
  };

  db: {
    ok: boolean;
    error?: string;
    totalRows: number;
    activeCount: number;
    inactiveCount: number;
    rows: DiagnosticDbRow[];
    ghosts: string[];
    duplicateHashes: Array<{ hash: string; ids: string[] }>;
    branchKeys: string[];
  };

  comparison: {
    onlyInPw: string[];
    onlyInDb: string[];
    activeInDbButNotInPw: string[];
    inPwButInactiveInDb: string[];
    pwNumericRange: { min: number; max: number } | null;
    pwNumericGaps: Array<{ from: number; to: number }>;
  };

  verdict: {
    ok: boolean;
    problems: string[];
  };
}

function sortKeys(arr: string[]): string[] {
  return [...arr].sort((a, b) => {
    const an = parseInt(a, 10), bn = parseInt(b, 10);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return a.localeCompare(b);
  });
}

export class GatewayDiagnosticService {
  static async run(convId: string, convTitle?: string): Promise<DiagnosticReport> {
    const ds = DeepSeekService.getInstance();
    const cache = GatewayCacheService.getInstance();
    const status = ds.getStatus();

    const report: DiagnosticReport = {
      ts: Date.now(),
      convId,
      convTitle: convTitle ?? null,
      pwStatus: status.status === 'running' ? 'running' : 'stopped',
      pwLoggedIn: status.isLoggedIn,
      pw: { ok: false, durationMs: 0, totalCount: 0, items: [] },
      db: {
        ok: false, totalRows: 0, activeCount: 0, inactiveCount: 0,
        rows: [], ghosts: [], duplicateHashes: [], branchKeys: [],
      },
      comparison: {
        onlyInPw: [], onlyInDb: [],
        activeInDbButNotInPw: [], inPwButInactiveInDb: [],
        pwNumericRange: null, pwNumericGaps: [],
      },
      verdict: { ok: true, problems: [] },
    };

    // ── PW ──────────────────────────────────────────────
    if (status.status === 'running') {
      const t0 = Date.now();
      try {
        const items = await ds.dumpFullPWState();
        report.pw = {
          ok: true,
          durationMs: Date.now() - t0,
          totalCount: items.length,
          items: items.map((r) => ({
            pwKey: String(r.pwKey),
            role: r.role,
            branch: r.branch,
            preview: (r.text || '').slice(0, 80),
          })),
        };
      } catch (e) {
        report.pw = {
          ok: false,
          error: (e as Error).message,
          durationMs: Date.now() - t0,
          totalCount: 0,
          items: [],
        };
      }
    } else {
      report.pw.error = 'PW не запущен';
    }

    // ── DB ──────────────────────────────────────────────
    try {
      const db = getGatewayCache();
      const raw = db.prepare(
        `SELECT id, pw_key, sequence, role, branch_total, branch_index,
                is_active, message_hash,
                substr(content_plain, 1, 120) AS preview
         FROM messages
         WHERE conversation_id = ?
         ORDER BY sequence ASC, is_active DESC`
      ).all(convId) as any[];

      const rows: DiagnosticDbRow[] = raw.map((r) => ({
        id: r.id,
        pwKey: r.pw_key != null ? String(r.pw_key) : null,
        role: r.role,
        sequence: r.sequence,
        branchIndex: r.branch_index ?? 1,
        branchTotal: r.branch_total ?? 1,
        isActive: r.is_active ?? 1,
        hash: r.message_hash || null,
        preview: (r.preview || '').replace(/\n/g, ' '),
      }));

      const byKey = new Map<string, DiagnosticDbRow[]>();
      for (const r of rows) {
        if (!r.pwKey) continue;
        if (!byKey.has(r.pwKey)) byKey.set(r.pwKey, []);
        byKey.get(r.pwKey)!.push(r);
      }

      // 5.7.52: ghost = группа версий (role, roundIndex), в которой ВСЕ inactive.
      // Старая логика группировала по pw_key — ложно флагала 41/42/45/46/50,
      // у которых active-пара в другой ветке (43/44/47/48/51).
      const branchKeys: string[] = [];

      // Группа: `${role}_${roundIndex}` — пользователь и assistant на одной итерации
      // диалога (roundIndex = floor(sequence/2)).
      // 5.7.52-v2: ghost = inactive branched row, у которой НЕТ active-peer'а
      // с тем же (role, branchTotal) в пределах ±5 sequence.
      // Реальный ghost (баг prune) — orphaned inactive без active-соседа.
      // Ложные срабатывания: 41/43 — разные версии одной ветки, sequence
      // у них разный (branchIndex меняется → seq растёт).
      const ghosts: string[] = [];
      for (const r of rows) {
        if (r.isActive !== 0) continue;
        if (r.branchTotal <= 1) continue;
        if (!r.pwKey) continue;
        const nearbyActive = rows.find(
          (o) =>
            o.isActive === 1 &&
            o.role === r.role &&
            o.branchTotal === r.branchTotal &&
            Math.abs(o.sequence - r.sequence) <= 5
        );
        if (!nearbyActive) ghosts.push(r.pwKey);
      }

      for (const r of rows) {
        if (r.branchTotal > 1 && r.pwKey) branchKeys.push(r.pwKey);
      }

      const hashToRows = new Map<string, DiagnosticDbRow[]>();
      for (const r of rows) {
        if (!r.hash) continue;
        if (!hashToRows.has(r.hash)) hashToRows.set(r.hash, []);
        hashToRows.get(r.hash)!.push(r);
      }
      const duplicateHashes = Array.from(hashToRows.entries())
        .filter(([_, list]) => list.length > 1)
        .map(([hash, list]) => ({ hash, ids: list.map((r) => r.id) }));

      report.db = {
        ok: true,
        totalRows: rows.length,
        activeCount: rows.filter((r) => r.isActive === 1).length,
        inactiveCount: rows.filter((r) => r.isActive === 0).length,
        rows,
        ghosts: sortKeys(ghosts),
        duplicateHashes,
        branchKeys: sortKeys(branchKeys),
      };
    } catch (e) {
      report.db.error = (e as Error).message;
    }

    // ── Comparison ──────────────────────────────────────
    const pwKeys = new Set(report.pw.items.map((r) => r.pwKey).filter(Boolean));
    const dbAll = new Set(report.db.rows.map((r) => r.pwKey).filter(Boolean) as string[]);
    const dbActive = new Set(
      report.db.rows.filter((r) => r.isActive === 1 && r.pwKey).map((r) => r.pwKey as string)
    );

    report.comparison.onlyInPw = sortKeys([...pwKeys].filter((k) => !dbAll.has(k)));
    report.comparison.onlyInDb = sortKeys([...dbAll].filter((k) => !pwKeys.has(k)));
    report.comparison.activeInDbButNotInPw = sortKeys([...dbActive].filter((k) => !pwKeys.has(k)));
    report.comparison.inPwButInactiveInDb = sortKeys(
      [...pwKeys].filter((k) => dbAll.has(k) && !dbActive.has(k))
    );

    const pwNums = [...pwKeys].map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (pwNums.length > 0) {
      report.comparison.pwNumericRange = { min: pwNums[0], max: pwNums[pwNums.length - 1] };
      const gaps: Array<{ from: number; to: number }> = [];
      for (let i = 1; i < pwNums.length; i++) {
        if (pwNums[i] - pwNums[i - 1] > 1) {
          gaps.push({ from: pwNums[i - 1], to: pwNums[i] });
        }
      }
      report.comparison.pwNumericGaps = gaps;
    }

    // ── Verdict ─────────────────────────────────────────
    const problems: string[] = [];
    if (report.pwStatus !== 'running') problems.push('PW не запущен');
    if (report.pw.error && report.pwStatus === 'running') problems.push(`PW ошибка: ${report.pw.error}`);
    if (report.db.error) problems.push(`DB ошибка: ${report.db.error}`);
    if (report.comparison.activeInDbButNotInPw.length > 0) {
      problems.push(
        `${report.comparison.activeInDbButNotInPw.length} active pw_key в DB отсутствуют в PW: ` +
        `${report.comparison.activeInDbButNotInPw.join(', ')} — причина "Message X not found in PW DOM"`
      );
    }
    if (report.db.ghosts.length > 0) {
      problems.push(
        `${report.db.ghosts.length} ghost-записей (inactive без active-версии в той же позиции диалога): ${report.db.ghosts.join(', ')}`
      );
    }
    if (report.db.duplicateHashes.length > 0) {
      problems.push(`${report.db.duplicateHashes.length} дубликатов message_hash`);
    }

    report.verdict = { ok: problems.length === 0, problems };
    return report;
  }
}