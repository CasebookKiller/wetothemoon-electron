// src/components/PRANA_BINDU/RunsPanel/utils.ts
//
// Форматтеры и хелперы, специфичные для таблицы пробежек.

export const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const DOW_RU = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
];

export function fmtKm(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(2);
}

export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Разбор ISO-даты дня → «26 сентября 2026» + «суббота». */
export function fmtDayHeader(iso: string): { date: string; dow: string } {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { date: iso, dow: '' };
  return {
    date: `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`,
    dow: DOW_RU[d.getDay()],
  };
}

/** «1 пробежка», «2 пробежки», «5 пробежек». */
export function pluralRun(n: number): string {
  if (n === 1) return 'пробежка';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'пробежки';
  return 'пробежек';
}

/** Счётчик пробежек по дате. Нужен только группированному виду. */
export function countByDate(
  items: Array<{ date: string }>
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const it of items) m[it.date] = (m[it.date] ?? 0) + 1;
  return m;
}