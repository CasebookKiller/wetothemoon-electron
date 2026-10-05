// src/components/PRANA_BINDU/utils/groupRunFacts.ts
//
// Группировка run_facts одной физической тренировки.
// Один забег может быть записан в БД несколько раз — dodofo,
// fit/strava-archive, intervals-icu, strava-csv, zepp. UI их
// показывает одной строкой, в которой бейджи источников.
// Окно совпадения: ±30 минут по start_time (та же цифра, что в ICU).

export const SAME_WORKOUT_WINDOW_MIN = 30;
export const SAME_WORKOUT_WINDOW_MS = SAME_WORKOUT_WINDOW_MIN * 60 * 1000;

/** Приоритет источника для выбора "primary" при группировке. */
export const SOURCE_PRIORITY: Record<string, number> = {
  fit: 1,
  tcx: 2,
  manual: 3,
  dodofo: 4,
  zepp: 5,
  'strava-csv': 6,
};

export interface GroupedRunFact {
  date: string;
  startTime: string | null;
  sources: string[];
  primary: any;
  items: any[];
  count: number;
  hasStreams: boolean;
  displayName: string;
  hasUserName: boolean;
}

/** Бейдж источника по паре (source, origin). */
export function sourceBadge(
  source: string | null,
  origin: string | null
): string {
  if (source === 'fit' || source === 'tcx') {
    if (origin === 'zepp-app') return 'zepp';
    if (origin === 'manual-import') return 'manual';
    return source;
  }
  return source ?? '—';
}

/**
 * Группирует run_facts, относящиеся к одной тренировке.
 * streamsMap — карта { runFactId: [...] } для флага hasStreams
 * (если нет — можно передать {}).
 */
export function groupRunFacts(
  items: any[],
  streamsMap: Record<number, any[]>
): GroupedRunFact[] {
  if (items.length === 0) return [];

  // 1. Сортировка по дате и start_time
  const sorted = [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const sa = a.start_time ?? '9999-12-31T23:59:59Z';
    const sb = b.start_time ?? '9999-12-31T23:59:59Z';
    return sa.localeCompare(sb);
  });

  // 2. Группировка последовательно: считаем одной тренировкой,
  //    если дата совпадает, и либо у кого-то нет времени,
  //    либо разница в пределах окна.
  const groups: any[][] = [];
  for (const it of sorted) {
    const last = groups[groups.length - 1];

    if (last && last.length > 0) {
      const anchor = last[0];
      const sameDate = anchor.date === it.date;

      if (sameDate) {
        const anchorMs = anchor.start_time
          ? new Date(anchor.start_time).getTime()
          : null;
        const itMs = it.start_time
          ? new Date(it.start_time).getTime()
          : null;

        const noTime = anchorMs == null || itMs == null;
        const withinWindow =
          anchorMs != null &&
          itMs != null &&
          Math.abs(itMs - anchorMs) <= SAME_WORKOUT_WINDOW_MS;

        if (noTime || withinWindow) {
          last.push(it);
          continue;
        }
      }
    }

    groups.push([it]);
  }

  // 3. Из каждой группы — GroupedRunFact
  return groups
    .map((group) => {
      const sortedGroup = [...group].sort((a, b) => {
        const pa = SOURCE_PRIORITY[a.source ?? ''] ?? 99;
        const pb = SOURCE_PRIORITY[b.source ?? ''] ?? 99;
        if (pa !== pb) return pa - pb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const sources = sortedGroup.map((s) =>
        sourceBadge(s.source, s.origin)
      );
      const hasStreams = sortedGroup.some((s) => streamsMap[s.id]?.length);

      const anchorStartTime =
        sortedGroup.find((s) => s.start_time)?.start_time ?? null;
      const primary = sortedGroup[0];
      const groupUserName =
        sortedGroup.find((s) => s.user_name)?.user_name ?? null;
      const groupName = sortedGroup.find((s) => s.name)?.name ?? null;
      const displayName = groupUserName ?? groupName ?? '—';
      const hasUserName = !!groupUserName;

      return {
        date: group[0].date,
        startTime: anchorStartTime,
        sources,
        primary,
        items: sortedGroup,
        displayName,
        hasUserName,
        count: sortedGroup.length,
        hasStreams,
      };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const sa = a.startTime ?? '';
      const sb = b.startTime ?? '';
      return sb.localeCompare(sa);
    });
}