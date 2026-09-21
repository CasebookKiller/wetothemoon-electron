// ============ Даты ============

/**
 * '04.09.2026 0:00:00' → '2026-09-04'
 */
export function parseKadDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

// ============ ИНН / ОГРН из HTML ============

/**
 * Из текста вида "ИНН: 7702059128" вытащить "7702059128".
 */
export function extractInn(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const m = text.match(/ИНН:\s*(\d{10,12})/);
  return m ? m[1] : undefined;
}

// ============ Декодирование HTML entities ============

/**
 * 'АО &quot;МОСДАЧТРЕСТ&quot;' → 'АО "МОСДАЧТРЕСТ"'
 */
export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// ============ Тип контрагента ============

/**
 * Определяет тип контрагента по названию.
 * ИП / ООО / АО / ПАО / ЗАО → company
 * 'Иванов И. И.' (есть инициалы) → person
 */
export function detectCounterpartyType(name: string): 'company' | 'person' | 'unknown' {
  if (!name) return 'unknown';
  const upper = name.toUpperCase();
  if (/\b(ООО|ОАО|ЗАО|ПАО|АО|ИП|НП|СРО|ГУП|МУП|ФГУП|КБ|ПК|ТСЖ|ЖСК)\b/.test(upper)) {
    // 'ИП Иванов И. И.' — это ИП, но в kad.arbitr роль ИП, а не физлицо
    if (/^ИП\s/.test(upper)) return 'person';
    return 'company';
  }
  // ФИО с инициалами: 'Иванов И. И.' или 'Иванов И.И.'
  if (/[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]?\.?/.test(name)) return 'person';
  return 'unknown';
}

// ============ Нормализация ФИО ============

/**
 * 'Соловцов С. Н.' → 'соловцов с. н.'
 * Используется для ключа дедупликации в справочнике.
 */
export function normalizeJudgeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ============ Пауза ============

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    }, { once: true });
  });
}