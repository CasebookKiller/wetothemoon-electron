// src/main/services/osint/parsers/rusprofileSummary.ts
//
// Парсер полей `data.summary` из дампа rusprofile.
// Возвращает плоский список наблюдений (attribute/value/confidence),
// которые затем пишутся через addObservation.
//
// Цель: из 6-7 наблюдений, которые сохранялись раньше, получить ~30:
// даты, капитал, статкоды, руководитель, контакты, реестры и т.д.

export interface ParsedObservation {
  attribute: string;
  value: string;
  confidence: number;
}

// ============ Парсинг дат ============

const RU_MONTHS: Record<string, number> = {
  'января': 1,
  'февраля': 2,
  'марта': 3,
  'апреля': 4,
  'мая': 5,
  'июня': 6,
  'июля': 7,
  'августа': 8,
  'сентября': 9,
  'октября': 10,
  'ноября': 11,
  'декабря': 12,
};

/**
 * Парсит русскоязычные даты в ISO (YYYY-MM-DD).
 *
 * Поддерживаемые форматы:
 *  - "21.08.2015"            → "2015-08-21"
 *  - "от 21 августа 2015 г." → "2015-08-21"
 *  - "с 18 ноября 2024 г."   → "2024-11-18"
 *  - "2026-09-24"            → "2026-09-24" (уже ISO)
 *
 * Если распарсить не удалось — возвращает null.
 */
export function parseRussianDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = String(text).trim();
  if (!s) return null;

  // Уже ISO
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // DD.MM.YYYY
  const dm = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dm) {
    const [, d, m, y] = dm;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // "DD <месяц-по-русски> YYYY"
  const ru = s.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (ru) {
    const day = ru[1].padStart(2, '0');
    const monthName = ru[2].toLowerCase();
    const year = ru[3];
    const month = RU_MONTHS[monthName];
    if (month) {
      return `${year}-${String(month).padStart(2, '0')}-${day}`;
    }
  }

  return null;
}

/** «17.02.2017» → «2017-02-17» */
export function isoFromDdMmYyyy(s: string): string | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ============ Парсинг капитала ============

/**
 * "300 000 руб." → { amount: 300000, currency: 'RUB' }
 * Число до первой запятой/точки; пробелы как разделители тысяч.
 */
export function parseCapital(text: string | null | undefined): {
  amount: number | null;
  currency: string | null;
} {
  if (!text) return { amount: null, currency: null };
  const s = String(text).trim();
  if (!s) return { amount: null, currency: null };

  const cleaned = s.replace(/\s/g, '');
  const digitsMatch = cleaned.match(/^(\d+)/);
  const amount = digitsMatch ? parseInt(digitsMatch[1], 10) : null;

  let currency: string | null = null;
  if (/руб/i.test(s)) currency = 'RUB';
  else if (/долл|USD/i.test(s)) currency = 'USD';
  else if (/евро|EUR/i.test(s)) currency = 'EUR';

  return { amount, currency };
}

// ============ Численность ============

/**
 * "33 сотрудника в 2025 году  2" → { count: 33, year: 2025 }
 * Хвостовые числа игнорируются (это, вероятно, шум разметки).
 */
export function parseEmployeesCount(text: string | null | undefined): {
  count: number | null;
  year: number | null;
} {
  if (!text) return { count: null, year: null };
  const s = String(text).trim();
  if (!s) return { count: null, year: null };

  const countMatch = s.match(/(\d+)\s*(сотрудник|человек|работник)/i);
  const count = countMatch ? parseInt(countMatch[1], 10) : null;

  const yearMatch = s.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  return { count, year };
}

// ============ Зарплата ============

/**
 * "92 462 руб в 2025 году  5 745" → { amount: 92462, year: 2025 }
 */
export function parseSalary(text: string | null | undefined): {
  amount: number | null;
  year: number | null;
} {
  if (!text) return { amount: null, year: null };
  const s = String(text).trim();
  if (!s) return { amount: null, year: null };

  const amountMatch = s.match(/(\d[\d\s]*)\s*руб/i);
  const amount = amountMatch
    ? parseInt(amountMatch[1].replace(/\s/g, ''), 10)
    : null;

  const yearMatch = s.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  return { amount, year };
}

// ============ Основная функция ============

/**
 * Преобразует `data.summary` из дампа rusprofile в плоский список
 * наблюдений для addObservation.
 *
 * Правила:
 *  - пустые / null значения пропускаем;
 *  - базовые (inn, ogrn, kpp...) сохраняются с confidence 90;
 *  - статкоды (okpo, oktmo...) — confidence 95 (реестровые данные);
 *  - контакты (phone/email/site) — confidence 70 (могут быть устаревшими);
 *  - каждый телефон/email/site — отдельное observation;
 *  - даты парсятся в ISO, если возможно.
 */
export function parseSummaryObservations(summary: any): ParsedObservation[] {
  if (!summary) return [];

  const out: ParsedObservation[] = [];

  const push = (
    attribute: string,
    value: any,
    confidence = 90
  ): void => {
    if (value === null || value === undefined) return;
    const str = String(value).trim();
    if (!str) return;
    out.push({ attribute, value: str, confidence });
  };

  // === Базовые (совместимость с текущим поведением) ===
  push('inn', summary.inn);
  push('ogrn', summary.ogrn);
  push('ogrnip', summary.ogrnip);
  push('kpp', summary.kpp);
  push('address', summary.address);
  push('activity', summary.main_activity);
  push('director', summary.manager?.name);

  // === Уровень 1: даты ===
  push('registration_date', parseRussianDate(summary.registration_date));
  push('ogrn_date', parseRussianDate(summary.ogrn_date));

  // === Уровень 1: капитал ===
  const capital = parseCapital(summary.capital);
  if (capital.amount !== null) push('capital', capital.amount);
  if (capital.currency) push('capital_currency', capital.currency);

  // === Уровень 1: руководитель ===
  push('director_position', summary.manager?.position);
  push('director_since', parseRussianDate(summary.manager?.since));

  // === Уровень 1: регистратор ===
  push('registry_holder', summary.registry_holder);

  // === Уровень 1: численность + зарплата ===
  const emp = parseEmployeesCount(summary.average_employees);
  if (emp.count !== null) push('average_employees', emp.count);
  if (emp.year !== null) push('average_employees_year', emp.year);

  const sal = parseSalary(summary.average_salary);
  if (sal.amount !== null) push('average_salary', sal.amount);
  if (sal.year !== null) push('average_salary_year', sal.year);

  // === Уровень 1: налоговые / реестры ===
  push('tax_regime', summary.tax_regime);
  push('sme_registry', summary.sme_registry);
  push('predecessor', summary.predecessor);
  push('tax_authority', summary.tax_authority);
  push('tax_authority_since', parseRussianDate(summary.tax_authority_since));

  // === Уровень 1: статкоды (реестровые — confidence 95) ===
  const sc = summary.stat_codes || {};
  push('okpo', sc.okpo, 95);
  push('okato', sc.okato, 95);
  push('oktmo', sc.oktmo, 95);
  push('okfs', sc.okfs, 95);
  push('okogu', sc.okogu, 95);
  push('okopf', sc.okopf, 95);

  // === Уровень 1: описание — НЕ сохраняем ===
  // detailed_description — большой многострочный текст из rusprofile,
  // дублирует сводку и засоряет observations. Исходник остаётся в
  // MessagePack-дампе — при необходимости можно достать оттуда.
  // push('description', summary.detailed_description);
  
  // === Уровень 1: дата обновления дампа ===
  push('summary_updated', parseRussianDate(summary.updated));

  // === Уровень 1: контакты (каждый отдельно, confidence 70) ===
  const contacts = summary.contacts || {};
  for (const phone of (contacts.phones || [])) {
    push('phone', phone, 70);
  }
  for (const email of (contacts.emails || [])) {
    push('email', email, 70);
  }
  for (const site of (contacts.sites || [])) {
    push('site', site, 70);
  }

  return out;
}

/**
 * Парсер summary для ИП. Переиспользует базовый (ЮЛ) набор, добавляя
 * ИП-специфичные поля. У ИП нет капитала, статкодов ОКФС/ОКОГУ/ОКОПФ,
 * зато есть registrar / pension_* / special_tax_regime / msp_category.
 */
export function parseEntrepreneurSummary(summary: any): ParsedObservation[] {
  const out = parseSummaryObservations(summary);
  const push = makePusher(out);

  // Демография
  push('gender', summary.gender);
  push('citizenship', summary.citizenship);

  // Реестровые (высокая достоверность)
  push('registrar', summary.registrar, 95);
  push('pension_reg_number', summary.pension_reg_number, 95);
  push('pension_reg_date', parseRussianDate(summary.pension_reg_date));
  push('pension_authority', summary.pension_authority);

  // Налоговый режим и МСП — у ИП это отдельные поля
  push('special_tax_regime', summary.special_tax_regime);
  push('msp_category', summary.msp_category);

  return out;
}

/**
 * Парсер summary для ФЛ. У ФЛ нет ни ОГРН, ни КПП, ни статкодов,
 * зато есть business_activity и risk_factors.
 */
export function parsePersonSummary(summary: any): ParsedObservation[] {
  const out: ParsedObservation[] = [];
  const push = makePusher(out);

  // Идентификация
  push('inn', summary.inn);
  push('region', summary.region);

  // Дата начала деятельности (не регистрации — у ФЛ её нет)
  push('activity_start', parseRussianDate(summary.activity_start));

  // Сводка по участию
  const ba = summary.business_activity ?? {};
  push('ceo_count', ba.ceo_count, 70);
  push('founder_count', ba.founder_count, 70);
  push('ip_status', ba.ip_status, 70);

  // Персональные риск-факторы (секция «Персональные»)
  for (const group of (summary.risk_factors ?? [])) {
    if (group?.title !== 'Персональные') continue;
    for (const f of (group.factors ?? [])) {
      const parsed = parsePersonRiskFactor(f);
      if (parsed) push(parsed.attr, parsed.value, 70);
    }
  }

  return out;
}

/**
 * Парсит строку риск-фактора ФЛ вида:
 *   «✓ Не имеет признаков массового руководителя» → risk_mass_director=false
 *   «✓ Не включен в Реестр дисквалифицированных лиц» → risk_disqualified=false
 * Warning-факторы (⚠) в секции «Персональные» не встречаются — они
 * относятся к связанным организациям и лежат в person_reliability_details.
 */
export function parsePersonRiskFactor(text: string): { attr: string; value: string } | null {
  const s = String(text ?? '').trim();
  if (!s) return null;
  const isPositive = s.startsWith('✓') || s.startsWith('✔');
  if (!isPositive) return null;

  const clean = s.replace(/^[✓✔]\s*/, '').trim();
  if (!clean.startsWith('Не ')) return null;

  if (/массово(го|й)\s+руководителя/i.test(clean)) return { attr: 'risk_mass_director', value: 'false' };
  if (/массово(го|й)\s+учредителя/i.test(clean))  return { attr: 'risk_mass_founder',  value: 'false' };
  if (/дисквалифицированных/i.test(clean))        return { attr: 'risk_disqualified',  value: 'false' };
  if (/санкци/i.test(clean))                      return { attr: 'risk_sanctions',     value: 'false' };

  return null;
}

/** Диспетчер по типу сущности. */
export function parseSummaryObservationsByType(
  summary: any,
  entityType: string          // ← было: 'company' | 'entrepreneur' | 'person'
): ParsedObservation[] {
  switch (entityType) {
    case 'entrepreneur': return parseEntrepreneurSummary(summary);
    case 'person':       return parsePersonSummary(summary);
    case 'company':
    default:             return parseSummaryObservations(summary);
  }
}

/** Вспомогательный pusher — вынести из parseSummaryObservations, чтобы переиспользовать. */
export function makePusher(out: ParsedObservation[]) {
  return (attribute: string, value: any, confidence = 90): void => {
    if (value === null || value === undefined) return;
    const str = String(value).trim();
    if (!str) return;
    out.push({ attribute, value: str, confidence });
  };
}

