import fs from 'fs';
import { encode } from '@msgpack/msgpack';

import { loadRawDumpSync, saveRawDumpSync } from './rawStorage';
import {
  KadArbitrCase,
  KadArbitrData,
  KadArbitrCounterparty,
  KadArbitrCard,
  KadArbitrCardEvent,
  KadArbitrCardSide,
} from './osint/scrapers/kadArbitr';
import { detectCounterpartyType } from './osint/scrapers/kadArbitr/helpers';
import { addCaseEvent, addObservation, addRawDumpRecord, addRelation, addSource, auditChange, getDatabase, getDumpSectionsUpdatedAt, updateRawDumpSections, upsertEntity } from './db';
import { parseSummaryObservations, parseSummaryObservationsByType } from './osint/scrapers/parsers/rusprofileSummary';
import { isoFromDdMmYyyy } from './osint/scrapers/parsers/rusprofileSummary';

type PersistCtx = {
  sourceId: number;
  rawFilePath: string;
  savedObservations: number;
  savedEntities: number;
  savedRelations: number;
};

/** «с 09.11.2018» / «с 02.03.2009 по 03.11.2010» → { from, to } */
function parseRolePeriod(period: string): { from: string | undefined; to: string | undefined } {
  if (!period) return { from: undefined, to: undefined };
  const m = String(period).match(/с\s+(\d{2}\.\d{2}\.\d{4})(?:\s+по\s+(\d{2}\.\d{2}\.\d{4}))?/);
  if (!m) return { from: undefined, to: undefined };
  return {
    from: isoFromDdMmYyyy(m[1]) ?? undefined,
    to:   m[2] ? (isoFromDdMmYyyy(m[2]) ?? undefined) : undefined,
  };
}

function upsertOrgFromConnection(org: any, ctx: PersistCtx): number {
  const orgType = detectEntityTypeFromHref(org.href) || detectEntityTypeFromData(org);
  const orgRusprofileId = extractRusprofileId(org.href)
    || (org.inn ? `inn:${org.inn}` : undefined);
  const orgValue = org.name || org.inn || 'Связанная организация';

  const orgId = upsertEntity({
    rusprofile_id: orgRusprofileId,
    type: orgType,
    value: orgValue,
    label: org.name,
    confidence: 60,
    status: 'unverified',
    raw_file_path: ctx.rawFilePath,
  });

  if (org.inn) {
    if (addObservation({
      entity_id: orgId, attribute: 'inn', value: org.inn,
      source_id: ctx.sourceId, raw_file_path: ctx.rawFilePath,
    }).inserted) ctx.savedObservations++;
  }
  if (org.ogrn) {
    if (addObservation({
      entity_id: orgId, attribute: 'ogrn', value: org.ogrn,
      source_id: ctx.sourceId, raw_file_path: ctx.rawFilePath,
    }).inserted) ctx.savedObservations++;
  }
  if (org.ogrnip) {
    if (addObservation({
      entity_id: orgId, attribute: 'ogrnip', value: org.ogrnip,
      source_id: ctx.sourceId, raw_file_path: ctx.rawFilePath,
    }).inserted) ctx.savedObservations++;
  }
  if (org.status) {
    if (addObservation({
      entity_id: orgId, attribute: 'status', value: org.status,
      source_id: ctx.sourceId, raw_file_path: ctx.rawFilePath,
    }).inserted) ctx.savedObservations++;
  }

  ctx.savedEntities++;
  return orgId;
}

const CONNECTION_ROLE_PREDICATES: Record<string, string> = {
  'Учредитель':   'founder_of',
  'Руководитель': 'director_of',
  'ИП':           'individual_entrepreneur_of',
};

function persistEntrepreneurConnections(
  data: any,
  mainEntityId: number,
  mainSummary: any,
  ctx: PersistCtx
): void {
  const groups = data?.connections_details?.connections ?? [];
  const selfOgrnip = mainSummary?.ogrnip;

  for (const group of groups) {
    const predicate = CONNECTION_ROLE_PREDICATES[group?.title] ?? 'associated_with';

    for (const org of (group.organizations ?? [])) {
      if (predicate === 'individual_entrepreneur_of'
          && selfOgrnip
          && org.ogrn === selfOgrnip) {
        continue;
      }

      const orgId = upsertOrgFromConnection(org, ctx);

      let validFrom: string | undefined;
      let validTo: string | undefined;
      for (const r of (org.roles ?? [])) {
        const parsed = parseRolePeriod(r?.period);
        if (parsed.from) validFrom = parsed.from;
        if (parsed.to)   validTo   = parsed.to;
      }

      const { inserted } = addRelation({
        subject_id: mainEntityId,
        predicate,
        object_id: orgId,
        source_id: ctx.sourceId,
        valid_from: validFrom,
        valid_to: validTo,
        evidence_text: group.title ?? null,
        confidence: 75,
        status: 'confirmed',
        raw_file_path: ctx.rawFilePath,
      });
      if (inserted) ctx.savedRelations++;
    }
  }
}

function persistPersonRoleSection(
  section: any,
  mainEntityId: number,
  predicate: 'director_of' | 'founder_of',
  ctx: PersistCtx
): void {
  if (!section) return;

  for (const bucket of ['current', 'past'] as const) {
    for (const org of (section[bucket] ?? [])) {
      const orgId = upsertOrgFromConnection(org, ctx);

      const { from, to } = parseRolePeriod(org.period ?? '');

      let roleFrom = from;
      let roleTo = bucket === 'past' ? to : undefined;   // ← undefined вместо null
      for (const r of (org.roles ?? [])) {
        const p = parseRolePeriod(r?.period);
        if (p.from) roleFrom = p.from;
        if (p.to)   roleTo   = p.to;
      }

      const { inserted } = addRelation({
        subject_id: mainEntityId,
        predicate,
        object_id: orgId,
        source_id: ctx.sourceId,
        valid_from: roleFrom,
        valid_to: roleTo,
        evidence_text: org.position ?? null,
        confidence: 80,
        status: 'confirmed',
        raw_file_path: ctx.rawFilePath,
      });
      if (inserted) ctx.savedRelations++;
    }
  }
}

/**
 * Определяет тип сущности по ссылке на профиль Rusprofile.
 * Возможные типы: company (ЮЛ), entrepreneur (ИП), person (физлицо).
 */
function detectEntityTypeFromHref(href?: string): string | null {
  if (!href) return null;
  if (href.includes('/id/')) return 'company';
  if (href.includes('/ip/')) return 'entrepreneur';
  if (href.includes('/person/')) return 'person';
  return null;
}

/**
 * Определяет тип сущности по данным (если нет ссылки).
 */
function detectEntityTypeFromData(data: any): 'company' | 'entrepreneur' | 'person' {
  // 1. Явный тип из collectSummary имеет высший приоритет
  if (data.entity_type === 'person') return 'person';
  if (data.entity_type === 'entrepreneur') return 'entrepreneur';
  if (data.entity_type === 'company') return 'company';

  // 2. По реквизитам
  if (data.ogrn) return 'company';
  if (data.ogrnip) return 'entrepreneur';

  // 3. Всё остальное — физлицо (в т.ч. с ИНН без ОГРН/ОГРНИП)
  return 'person';
}

/**
 * Извлекает уникальный идентификатор Rusprofile из ссылки.
 * Пример: '/id/12345' -> 'id:12345', '/ip/67890' -> 'ip:67890', '/person/abc' -> 'person:abc'
 */
function extractRusprofileId(href?: string): string | undefined {
  if (!href) return undefined;
  const match = href.match(/\/(id|ip|person)\/([^/?]+)/);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

/**
 * Ищет сущность типа 'entrepreneur' по ОГРНИП через таблицу observations.
 * Возвращает id сущности или null.
 */
function findEntrepreneurByOgrnip(ogrnip: string): number | null {
  if (!ogrnip) return null;
  const db = getDatabase();
  const row = db.prepare(`
    SELECT e.id
    FROM entities e
    JOIN observations o ON o.entity_id = e.id
    WHERE e.type = 'entrepreneur'
      AND o.attribute = 'ogrnip'
      AND o.value = ?
    LIMIT 1
  `).get(ogrnip) as { id: number } | undefined;
  return row?.id ?? null;
}

export function persistCompanyData(
  companyId: string,
  companyInn: string,
  data: any,
  rawFilePath: string,
  sourceId: number
): {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  mainEntityId: number;
} {
  const mainSummary = data.summary || {};
  const mainType = detectEntityTypeFromData(mainSummary);

  const mainEntityId = upsertEntity({
    type: mainType,
    value: mainSummary.name || `Сущность ${companyInn}`,
    label: mainSummary.name,
    confidence: 90,
    status: 'confirmed',
    notes: 'Целевая сущность, собранная скраппером',
    raw_file_path: rawFilePath,
  });

  // ===== 1. Observations из summary (диспетчер по типу) =====
  let savedObservations = 0;
  const summaryObservations = parseSummaryObservationsByType(mainSummary, mainType);
  for (const obs of summaryObservations) {
    const r = addObservation({
      entity_id: mainEntityId,
      attribute: obs.attribute,
      value: obs.value,
      source_id: sourceId,
      confidence: obs.confidence,
      raw_file_path: rawFilePath,
    });
    if (r.inserted) savedObservations++;
  }

  let savedEntities = 1;
  let savedRelations = 0;

  // ===== 2. Автосвязь ФЛ ↔ ИП (по ОГРНИП из summary.ip) =====
  if (mainType === 'person') {
    const ipInfo = mainSummary.ip;
    const ogrnip = ipInfo?.ogrnip;

    if (ogrnip) {
      const ipEntityId = findEntrepreneurByOgrnip(ogrnip);
      if (ipEntityId && ipEntityId !== mainEntityId) {
        const { inserted, id } = addRelation({
          subject_id: mainEntityId,
          predicate: 'individual_entrepreneur_of',
          object_id: ipEntityId,
          source_id: sourceId,
          evidence_text: `ОГРНИП ${ogrnip} — совпадение с профилем ФЛ`,
          confidence: 95,
          status: 'confirmed',
          raw_file_path: rawFilePath,
        });
        if (inserted) {
          savedRelations++;
          console.log(
            `[persistCompanyData] Автосвязь ФЛ #${mainEntityId} ↔ ИП #${ipEntityId} (ОГРНИП ${ogrnip}) создана (id=${id})`
          );
        }
      }
    }
  }

  // ===== 3. Роли/связи — диспетчер по типу =====
  const ctx: PersistCtx = {
    sourceId,
    rawFilePath,
    savedObservations,
    savedEntities,
    savedRelations,
  };

  if (mainType === 'company') {
    // --- Учредители ЮЛ ---
    if (data.founders_details?.founders) {
      for (const founder of data.founders_details.founders) {
        const founderType =
          detectEntityTypeFromHref(founder.href) || detectEntityTypeFromData(founder);
        const founderRusprofileId = extractRusprofileId(founder.href);
        const founderValue = founder.name || founder.inn || 'Неизвестный учредитель';

        const founderId = upsertEntity({
          rusprofile_id: founderRusprofileId,
          type: founderType,
          value: founderValue,
          label: founder.name,
          confidence: 70,
          status: 'hypothesis',
          raw_file_path: rawFilePath,
        });

        if (founder.inn) {
          if (addObservation({ entity_id: founderId, attribute: 'inn', value: founder.inn, source_id: sourceId, raw_file_path: rawFilePath }).inserted) ctx.savedObservations++;
        }
        if (founder.ogrn) {
          if (addObservation({ entity_id: founderId, attribute: 'ogrn', value: founder.ogrn, source_id: sourceId, raw_file_path: rawFilePath }).inserted) ctx.savedObservations++;
        }
        if (founder.ogrnip) {
          if (addObservation({ entity_id: founderId, attribute: 'ogrnip', value: founder.ogrnip, source_id: sourceId, raw_file_path: rawFilePath }).inserted) ctx.savedObservations++;
        }
        if (founder.share) {
          if (addObservation({ entity_id: founderId, attribute: 'share', value: founder.share, source_id: sourceId, raw_file_path: rawFilePath }).inserted) ctx.savedObservations++;
        }

        const { inserted } = addRelation({
          subject_id: founderId,
          predicate: 'founder_of',
          object_id: mainEntityId,
          source_id: sourceId,
          evidence_text: founder.share || null,
          confidence: 75,
          status: 'unverified',
          raw_file_path: rawFilePath,
        });
        if (inserted) ctx.savedRelations++;
        ctx.savedEntities++;
      }
    }

    // --- Связи ЮЛ (connections_details) ---
    if (data.connections_details?.connections) {
      for (const group of data.connections_details.connections) {
        if (!group.organizations) continue;
        for (const org of group.organizations) {
          const orgId = upsertOrgFromConnection(org, ctx);

          const { inserted } = addRelation({
            subject_id: mainEntityId,
            predicate: 'associated_with',
            object_id: orgId,
            source_id: sourceId,
            evidence_text: group.title || null,
            confidence: 50,
            status: 'unverified',
            raw_file_path: rawFilePath,
          });
          if (inserted) ctx.savedRelations++;
        }
      }
    }
  } else if (mainType === 'entrepreneur') {
    persistEntrepreneurConnections(data, mainEntityId, mainSummary, ctx);
  } else if (mainType === 'person') {
    persistPersonRoleSection(data.person_ceo_details,     mainEntityId, 'director_of', ctx);
    persistPersonRoleSection(data.person_founder_details, mainEntityId, 'founder_of',  ctx);
  }

  // ===== 4. Разворачиваем счётчики =====
  savedObservations = ctx.savedObservations;
  savedEntities     = ctx.savedEntities;
  savedRelations    = ctx.savedRelations;

  // ===== 5. Аудит =====
  auditChange(
    'entities',
    mainEntityId,
    'update',
    null,
    JSON.stringify(mainSummary),
    'Сохранение/обновление сущности из Rusprofile'
  );

  return { savedEntities, savedRelations, savedObservations, mainEntityId };
}

export function saveCompanyData(
  companyId: string,
  companyInn: string,
  data: any
): {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  rawDumpPath: string;
} {
  // 1. Сохраняем сырой дамп
  const raw = saveRawDumpSync(companyInn, data);

  // 2. Собираем список собранных разделов
  const collectedSections = Object.keys(data).filter(
    (key) => !['company_id', 'entity_type', 'timings', 'startedAt', 'totalDurationMs'].includes(key)
  );

  const sectionUpdatedAt: Record<string, string> = {};
  const nowIso = new Date().toISOString();
  for (const section of collectedSections) {
    sectionUpdatedAt[section] = nowIso;
  }

  // 3. Добавляем запись в raw_dumps
  addRawDumpRecord(
    companyInn,
    companyId,
    raw.filePath,
    raw.sizeBytes,
    collectedSections,
    sectionUpdatedAt
  );

  // 4. Определяем тип и URL источника
  const mainSummary = data.summary || {};
  const mainType = detectEntityTypeFromData(mainSummary);
  const urlPath = mainType === 'company' ? 'id' : mainType === 'entrepreneur' ? 'ip' : 'person';
  const sourceUrl = `https://www.rusprofile.ru/${urlPath}/${companyId}`;

  // 5. Создаём источник
  const sourceId = addSource({
    url: sourceUrl,
    title: 'Rusprofile',
    source_type: 'registry',
    source_kind: 'official_registry',
    provider: 'rusprofile.ru',
    collection_method: 'browser',
    reliability: 80,
    access_level: 'public',
    retrieved_at: new Date().toISOString(),
    local_path: raw.filePath,
  });

  // 6. Сохраняем данные в БД
  const result = persistCompanyData(companyId, companyInn, data, raw.filePath, sourceId);

  // 7. Судебные дела из arbitration_details (если есть)
  let arbStats = { savedEntities: 0, savedRelations: 0, savedObservations: 0, casesProcessed: 0 };
  if (data.arbitration_details?.cases?.length) {
    arbStats = persistRusprofileArbitration(
      result.mainEntityId,
      companyId,
      data.arbitration_details,
      sourceId,
      raw.filePath
    );
  }

  return {
    savedEntities: result.savedEntities + arbStats.savedEntities,
    savedRelations: result.savedRelations + arbStats.savedRelations,
    savedObservations: result.savedObservations + arbStats.savedObservations,
    rawDumpPath: raw.filePath,
  };
}

export function updateCompanyData(
  companyId: string,
  companyInn: string,
  data: any,
  existingDumpPath: string,
  existingDumpId: number
): {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  rawDumpPath: string;
} {
  // 1. Перезаписываем существующий файл дампа
  const buffer = encode(data);
  fs.writeFileSync(existingDumpPath, buffer);
  const stat = fs.statSync(existingDumpPath);

  // 2. Обновляем список собранных разделов в raw_dumps
  const collectedSections = Object.keys(data).filter(
    (key) => !['company_id', 'entity_type', 'timings', 'startedAt', 'totalDurationMs'].includes(key)
  );
  // Получаем старые даты
  const oldSectionDates = getDumpSectionsUpdatedAt(existingDumpId) || {};
  const nowIso = new Date().toISOString();
  for (const section of collectedSections) {
    oldSectionDates[section] = nowIso;
  }

  updateRawDumpSections(existingDumpId, collectedSections, oldSectionDates);

  // 3. Определяем тип и URL источника
  const mainSummary = data.summary || {};
  const mainType = detectEntityTypeFromData(mainSummary);
  const urlPath = mainType === 'company' ? 'id' : mainType === 'entrepreneur' ? 'ip' : 'person';
  const sourceUrl = `https://www.rusprofile.ru/${urlPath}/${companyId}`;

  // 4. Создаём источник (если ещё нет, можно добавить; но для простоты создадим новый? 
  // Лучше использовать существующий источник, но мы не храним его ID. 
  // Пока добавим новый, чтобы не усложнять, но в будущем можно искать по URL)
  const sourceId = addSource({
    url: sourceUrl,
    title: 'Rusprofile',
    source_type: 'registry',
    source_kind: 'official_registry',
    provider: 'rusprofile.ru',
    collection_method: 'browser',
    reliability: 80,
    access_level: 'public',
    retrieved_at: new Date().toISOString(),
    local_path: existingDumpPath,
  });

  // 5. Сохраняем данные в БД
  const result = persistCompanyData(companyId, companyInn, data, existingDumpPath, sourceId);

  // 6. Судебные дела из arbitration_details
  let arbStats = { savedEntities: 0, savedRelations: 0, savedObservations: 0, casesProcessed: 0 };
  if (data.arbitration_details?.cases?.length) {
    arbStats = persistRusprofileArbitration(
      result.mainEntityId,
      companyId,
      data.arbitration_details,
      sourceId,
      existingDumpPath
    );
  }

  return {
    savedEntities: result.savedEntities + arbStats.savedEntities,
    savedRelations: result.savedRelations + arbStats.savedRelations,
    savedObservations: result.savedObservations + arbStats.savedObservations,
    rawDumpPath: existingDumpPath,
  };
}

/**
 * Объединяет существующий дамп с новыми частичными данными.
 * Если поле в newData определено (не undefined), оно замещает старое значение.
 * Служебные поля (timings, startedAt, totalDurationMs) не переносятся.
 */
export function mergeCompanyDumps(existingData: any, newData: any): any {
  const merged = { ...existingData };

  for (const key of Object.keys(newData)) {
    if (
      ['timings', 'startedAt', 'totalDurationMs', 'company_id', 'entity_type'].includes(key)
    ) {
      continue; // эти поля не должны перезаписывать старые или не важны
    }
    if (newData[key] !== undefined) {
      merged[key] = newData[key];
    }
  }

  return merged;
}

// ============================================================================
// Нормализация номера дела (для сопоставления источников)
// ============================================================================

/**
 * Приводит номер дела к каноническому виду:
 *  - убирает пробелы,
 *  - заменяет слэш на дефис,
 *  - приводит к верхнему регистру.
 *
 * Пример: "А40-283283/2026" → "А40-283283-2026".
 *
 * Одна и та же сущность court_case, найденная через rusprofile и kad.arbitr,
 * получает одинаковый normalized_value и не дублируется.
 */
export function normalizeCaseNumber(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, '').replace(/\//g, '-').toUpperCase().trim();
}

// ============================================================================
// KAD.ARBITR: сохранение дел
// ============================================================================

type CasePredicate = 'plaintiff_in' | 'defendant_in' | 'third_party_in';

function roleToPredicate(role: string): CasePredicate | null {
  switch (role) {
    case 'plaintiff':    return 'plaintiff_in';
    case 'defendant':    return 'defendant_in';
    case 'third_party':  return 'third_party_in';
    default:             return null; // 'any' — роль уточняется по спискам
  }
}

/**
 * Находит сущность по ИНН через observations.
 * Если не нашёл — создаёт (тип по длине ИНН) и добавляет observation inn.
 * Пытается вытащить реальное название среди участников дел.
 */
function findOrCreateTargetEntity(
  inn: string,
  cases: KadArbitrCase[],
  sourceId: number
): number {
  const db = getDatabase();

  // 1. Поиск по observations
  const existing = db.prepare(`
    SELECT e.id
    FROM entities e
    JOIN observations o ON o.entity_id = e.id
    WHERE o.attribute = 'inn' AND o.value = ?
    LIMIT 1
  `).get(inn) as { id: number } | undefined;

  if (existing) {
    db.prepare(`UPDATE entities SET last_seen = ? WHERE id = ?`)
      .run(new Date().toISOString(), existing.id);
    return existing.id;
  }

  // 2. Ищем название среди сторон
  let name: string | undefined;
  for (const c of cases) {
    const found = [...c.plaintiffs, ...c.respondents].find((p) => p.inn === inn);
    if (found) { name = found.name; break; }
  }

  const type = inn.length === 12 ? 'entrepreneur' : 'company';
  const value = name || `ИНН ${inn}`;

  // 3. Создаём сущность
  const entityId = upsertEntity({
    type,
    value,
    label: value,
    confidence: name ? 90 : 50,
    status: name ? 'confirmed' : 'unverified',
    notes: 'Целевая сущность kad.arbitr',
  });

  // 4. Фиксируем ИНН как observation
  addObservation({
    entity_id: entityId,
    attribute: 'inn',
    value: inn,
    source_id: sourceId,
    confidence: 90,
  });

  return entityId;
}

/**
 * Ленивая промоция суда в entities.
 * Ищет суд в справочнике `courts` по имени; если найден — обогащает тегом.
 */
function promoteCourtToEntity(courtName: string, sourceId: number): number {
  const db = getDatabase();

  const courtRow = db.prepare(`
    SELECT court_tag, court_name FROM courts WHERE court_name = ? LIMIT 1
  `).get(courtName) as { court_tag: string; court_name: string } | undefined;

  const entityId = upsertEntity({
    type: 'court',
    value: courtName,
    label: courtName,
    confidence: courtRow ? 90 : 70,
    status: courtRow ? 'confirmed' : 'unverified',
    notes: courtRow ? `Тег: ${courtRow.court_tag}` : 'Суд из дела kad.arbitr',
  });

  if (courtRow) {
    addObservation({
      entity_id: entityId,
      attribute: 'court_tag',
      value: courtRow.court_tag,
      source_id: sourceId,
      confidence: 90,
    });
  }

  return entityId;
}

/**
 * Ленивая промоция судьи в entities.
 * Уникальность обеспечивается через `value = 'ФИО (Суд)'`, потому что
 * одно ФИО встречается у разных судей в разных судах.
 */
function promoteJudgeToEntity(
  judgeName: string,
  courtName: string | undefined,
  sourceId: number
): number {
  const db = getDatabase();

  // 1. Пытаемся найти в справочнике: сначала точно (имя+суд), потом только по имени
  let judgeRow: { judge_uuid: string; name: string; post: string | null } | undefined;

  if (courtName) {
    const courtRow = db.prepare(`SELECT id FROM courts WHERE court_name = ? LIMIT 1`)
      .get(courtName) as { id: number } | undefined;
    if (courtRow) {
      judgeRow = db.prepare(`
        SELECT judge_uuid, name, post FROM judges
        WHERE name = ? AND court_id = ?
        LIMIT 1
      `).get(judgeName, courtRow.id) as any;
    }
  }
  if (!judgeRow) {
    judgeRow = db.prepare(`
      SELECT judge_uuid, name, post FROM judges WHERE name = ? LIMIT 1
    `).get(judgeName) as any;
  }

  // 2. Формируем value с указанием суда
  const value = courtName ? `${judgeName} (${courtName})` : judgeName;

  const entityId = upsertEntity({
    type: 'judge',
    value,
    label: value,
    confidence: judgeRow ? 90 : 50,
    status: judgeRow ? 'confirmed' : 'unverified',
    notes: judgeRow ? `UUID: ${judgeRow.judge_uuid}` : 'Судья из дела kad.arbitr',
  });

  if (judgeRow) {
    addObservation({
      entity_id: entityId,
      attribute: 'judge_uuid',
      value: judgeRow.judge_uuid,
      source_id: sourceId,
      confidence: 90,
    });
    if (judgeRow.post) {
      addObservation({
        entity_id: entityId,
        attribute: 'post',
        value: judgeRow.post,
        source_id: sourceId,
        confidence: 90,
      });
    }
  }

  return entityId;
}

// ============================================================================
// Универсальное сохранение одного дела
// ============================================================================

interface PersistCaseParams {
  caseItem: KadArbitrCase;
  sourceId: number;
  targetEntityId?: number;       // целевая организация (для роли)
  targetRole?: 'plaintiff' | 'defendant' | 'third_party' | 'any';
  targetInn?: string;             // для определения роли при 'any'
  rawFilePath?: string;
}

interface PersistCaseResult {
  caseEntityId: number;
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
}

/**
 * Сохраняет одно судебное дело в БД.
 *
 * Идемпотентно: повторный вызов обновляет существующие записи
 * (по normalized_value сущности и по ux_relations_triple / ux_observations_triple).
 *
 * Логика:
 *  1. Нормализация case_number.
 *  2. Upsert сущности court_case.
 *  3. Observations на case.
 *  4. Связь целевой организации с делом (если передан targetEntityId).
 *  5. Контрагенты — upsert + связь с делом.
 *  6. Судья — промоция + judge_of.
 *  7. Суд — промоция + heard_by.
 */
function persistCase(params: PersistCaseParams): PersistCaseResult {
  const { caseItem, sourceId, targetEntityId, targetRole, targetInn, rawFilePath } = params;

  let savedEntities = 0;
  let savedRelations = 0;
  let savedObservations = 0;

  // 1. Нормализация
  const normalizedCaseNumber = normalizeCaseNumber(caseItem.case_number);
  const displayLabel = `Дело ${caseItem.case_number}`;

  // 2. Сущность court_case
  const caseEntityId = upsertEntity({
    type: 'court_case',
    value: normalizedCaseNumber,
    label: displayLabel,
    confidence: 90,
    status: 'confirmed',
    notes: `Тип: ${caseItem.case_type}; суд: ${caseItem.court}`,
    raw_file_path: rawFilePath,
  });
  savedEntities++;

  // 3. Observations на case
  const caseObs: Array<{ attribute: string; value: string | undefined }> = [
    { attribute: 'case_number', value: caseItem.case_number }, // оригинал для отображения
    { attribute: 'case_type',   value: caseItem.case_type },
    { attribute: 'case_uuid',   value: caseItem.case_uuid },
    { attribute: 'filing_date', value: caseItem.filing_date },
    { attribute: 'court',       value: caseItem.court },
    { attribute: 'judge',       value: caseItem.judge },
  ];
  for (const obs of caseObs) {
    if (!obs.value) continue;
    const r = addObservation({
      entity_id: caseEntityId,
      attribute: obs.attribute,
      value: obs.value,
      source_id: sourceId,
      confidence: 90,
      raw_file_path: rawFilePath,
    });
    if (r.inserted) savedObservations++;
  }
 
  // Extra observations (сумма, категория, тип и т.д. — из rusprofile)
  if (caseItem.extra_observations) {
    for (const obs of caseItem.extra_observations) {
      if (!obs.value) continue;
      const r = addObservation({
        entity_id: caseEntityId,
        attribute: obs.attribute,
        value: obs.value,
        source_id: sourceId,
        confidence: 90,
        raw_file_path: rawFilePath,
      });
      if (r.inserted) savedObservations++;
    }
  }

  // 4. Связь целевой организации с делом
  if (targetEntityId) {
    const predicate = resolveTargetPredicate(targetRole, caseItem, targetInn);

    if (predicate) {
      const r = addRelation({
        subject_id: targetEntityId,
        predicate,
        object_id: caseEntityId,
        source_id: sourceId,
        evidence_text: `Дело ${caseItem.case_number}`,
        confidence: 90,
        status: 'confirmed',
        raw_file_path: rawFilePath,
      });
      if (r.inserted) savedRelations++;
    }
  }

  // 5. Контрагенты
  const partyGroups: Array<{
    items: KadArbitrCounterparty[];
    predicate: CasePredicate;
  }> = [
    { items: caseItem.plaintiffs, predicate: 'plaintiff_in' },
    { items: caseItem.respondents, predicate: 'defendant_in' },
    { items: caseItem.third_parties || [], predicate: 'third_party_in' },
  ];

  const db = getDatabase();

  for (const group of partyGroups) {
    for (const party of group.items) {
      // Пропускаем саму целевую организацию — она уже связана
      if (targetInn && party.inn === targetInn) continue;

      const type =
        party.type === 'person'       ? 'person'
        : party.type === 'entrepreneur' ? 'entrepreneur'
        : party.type === 'company'      ? 'company'
        : 'other';

      // Если у контрагента есть rusprofile_id — сначала проверяем, нет ли
      // уже сущности с таким id. На reparse (или повторном scrape) контрагент
      // мог быть заведён ранее — например, в connections_details или
      // founders_details — с тем же rusprofile_id, но другим value.
      // В этом случае переиспользуем существующую запись, иначе
      // получим UNIQUE constraint failed: entities.rusprofile_id.
      // Если у контрагента есть rusprofile_id — сначала проверяем, нет ли
      // уже сущности с таким id. На reparse (или повторном scrape) контрагент
      // мог быть заведён ранее (например, в connections_details) с тем же
      // rusprofile_id, но другим value. Переиспользуем существующую запись,
      // иначе получим UNIQUE constraint failed: entities.rusprofile_id.
      const existingByRusprofileId = party.rusprofile_id
        ? (db.prepare(
            'SELECT id FROM entities WHERE rusprofile_id = ? LIMIT 1'
          ).get(party.rusprofile_id) as { id: number } | undefined)
        : undefined;

      const partyEntityId = existingByRusprofileId
        ? existingByRusprofileId.id
        : upsertEntity({
            rusprofile_id: party.rusprofile_id,
            type,
            value: party.name,
            label: party.name,
            confidence: party.type === 'unknown' ? 50 : 70,
            status: 'unverified',
            notes: party.hidden_data ? 'Данные скрыты' : undefined,
            raw_file_path: rawFilePath,
          });

      if (!existingByRusprofileId) savedEntities++;

      if (party.inn) {
        const r = addObservation({
          entity_id: partyEntityId,
          attribute: 'inn',
          value: party.inn,
          source_id: sourceId,
          confidence: 80,
          raw_file_path: rawFilePath,
        });
        if (r.inserted) savedObservations++;
      }
      if (party.address) {
        const r = addObservation({
          entity_id: partyEntityId,
          attribute: 'address',
          value: party.address,
          source_id: sourceId,
          confidence: 70,
          raw_file_path: rawFilePath,
        });
        if (r.inserted) savedObservations++;
      }

      const r = addRelation({
        subject_id: partyEntityId,
        predicate: group.predicate,
        object_id: caseEntityId,
        source_id: sourceId,
        evidence_text: `${group.predicate} по делу ${caseItem.case_number}`,
        confidence: 80,
        status: 'unverified',
        raw_file_path: rawFilePath,
      });
      if (r.inserted) savedRelations++;
    }
  }

  // 6. Суд
  if (caseItem.court) {
    const courtEntityId = promoteCourtToEntity(caseItem.court, sourceId);
    const r = addRelation({
      subject_id: caseEntityId,
      predicate: 'heard_by',
      object_id: courtEntityId,
      source_id: sourceId,
      evidence_text: caseItem.court,
      confidence: 90,
      status: 'confirmed',
      raw_file_path: rawFilePath,
    });
    if (r.inserted) savedRelations++;
  }

  // 7. Судья
  if (caseItem.judge) {
    const judgeEntityId = promoteJudgeToEntity(caseItem.judge, caseItem.court, sourceId);
    const r = addRelation({
      subject_id: judgeEntityId,
      predicate: 'judge_of',
      object_id: caseEntityId,
      source_id: sourceId,
      evidence_text: caseItem.judge,
      confidence: 90,
      status: 'confirmed',
      raw_file_path: rawFilePath,
    });
    if (r.inserted) savedRelations++;
  }

  return { caseEntityId, savedEntities, savedRelations, savedObservations };
}

/**
 * Определяет предикат для целевой организации.
 *  - Если targetRole задан явно ('plaintiff'|'defendant'|'third_party') — используем его.
 *  - Если 'any' — определяем по спискам дела по targetInn.
 *  - Если ИНН не найден ни в одном списке — null (связь не создаётся).
 */
function resolveTargetPredicate(
  targetRole: 'plaintiff' | 'defendant' | 'third_party' | 'any' | undefined,
  caseItem: KadArbitrCase,
  targetInn: string | undefined
): CasePredicate | null {
  if (targetRole && targetRole !== 'any') {
    return roleToPredicate(targetRole);
  }

  if (!targetInn) return null;

  if (caseItem.plaintiffs.some((p) => p.inn === targetInn))  return 'plaintiff_in';
  if (caseItem.respondents.some((p) => p.inn === targetInn)) return 'defendant_in';
  return null;
}

/**
 * Сохраняет результат scrapeKadArbitr в БД.
 *
 * Тонкая обёртка над `persistCase`:
 *  1. Находит/создаёт целевую сущность по ИНН.
 *  2. Для каждого дела вызывает `persistCase`.
 *
 * Вся логика обработки одного дела — внутри `persistCase`.
 * Это позволяет переиспользовать её для данных из rusprofile.
 */
export function persistKadArbitrData(
  inn: string,
  data: KadArbitrData,
  sourceId: number
): {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  targetEntityId: number;
} {
  let savedEntities = 0;
  let savedRelations = 0;
  let savedObservations = 0;

  // 1. Целевая сущность
  const targetEntityId = findOrCreateTargetEntity(inn, data.cases, sourceId);
  savedEntities++;

  const targetRole = (data.search_params.roles[0] || 'any') as
    | 'plaintiff' | 'defendant' | 'third_party' | 'any';

  // 2. Цикл по делам
  for (const caseItem of data.cases) {
    const r = persistCase({
      caseItem,
      sourceId,
      targetEntityId,
      targetRole,
      targetInn: inn,
    });

    savedEntities += r.savedEntities;
    savedRelations += r.savedRelations;
    savedObservations += r.savedObservations;
  }

  return { savedEntities, savedRelations, savedObservations, targetEntityId };
}

// ============================================================================
// RUSPROFILE: судебные дела (arbitration_details)
// ============================================================================

/**
 * "№ А40-283253/2026 от 04.09.2026" → { number: "А40-283253/2026", date: "2026-09-04" }
 */
function parseRusprofileCaseNumber(raw: string): { number: string; date: string } {
  if (!raw) return { number: '', date: '' };

  let numberRaw = raw;
  let dateRaw = '';

  const idx = raw.indexOf(' от ');
  if (idx !== -1) {
    numberRaw = raw.slice(0, idx);
    dateRaw = raw.slice(idx + 4).trim();
  }

  numberRaw = numberRaw.replace(/^№\s*/, '').trim();

  let isoDate = '';
  const dm = dateRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dm) isoDate = `${dm[3]}-${dm[2]}-${dm[1]}`;

  return { number: numberRaw, date: isoDate };
}

/**
 * "Экономические споры по гражданским правоотношениям" → "civil"
 * "Дела о несостоятельности (банкротстве)" → "bankruptcy"
 */
function mapRusprofileCaseType(typeRaw: string): 'civil' | 'administrative' | 'bankruptcy' | 'other' {
  if (!typeRaw) return 'other';
  const t = typeRaw.toLowerCase();
  if (t.includes('банкротств') || t.includes('несостоятельност')) return 'bankruptcy';
  if (t.includes('административн')) return 'administrative';
  if (t.includes('гражданск')) return 'civil';
  return 'other';
}

/**
 * Извлекает UUID карточки kad.arbitr из ссылки вида
 * "https://kad.arbitr.ru/Card/af78742a-...".
 * Для ссылок вида "/Document/Pdf/..." возвращает ''.
 */
function extractKadUuidFromUrl(url?: string): string {
  if (!url) return '';
  const m = url.match(/\/Card\/([a-f0-9-]+)/i);
  return m ? m[1] : '';
}

/**
 * Преобразует объект {text, href} из rusprofile в KadArbitrCounterparty.
 */
function rusprofilePartyToCounterparty(party: any): KadArbitrCounterparty | null {
  if (!party || typeof party !== 'object' || !party.text) return null;

  const name: string = String(party.text);
  const href: string | undefined = party.href;

  const hrefType = detectEntityTypeFromHref(href);
  const type: KadArbitrCounterparty['type'] =
    hrefType === 'company'      ? 'company'
    : hrefType === 'entrepreneur' ? 'entrepreneur'
    : hrefType === 'person'       ? 'person'
    : 'unknown';

  return {
    name,
    type,
    rusprofile_id: extractRusprofileId(href),
  };
}

/**
 * Читает массив или одиночный объект — на случай, если rusprofile
 * вернёт несколько истцов/ответчиков.
 */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Одно дело из arbitration_details → KadArbitrCase (универсальный формат).
 *
 *  - case_number парсится из "№ А40-... от DD.MM.YYYY";
 *  - case_uuid извлекается из kad_url, если это карточка;
 *  - суд и судья неизвестны из этого формата — пустые строки;
 *  - Истец/Ответчик/Третье лицо → plaintiffs/respondents/third_parties;
 *  - Сумма, Категория, Тип, Исход, Статус → extra_observations.
 */
function rusprofileCaseToKadArbitrCase(caseItem: any): KadArbitrCase | null {
  if (!caseItem) return null;

  const parsed = parseRusprofileCaseNumber(String(caseItem.case_number || ''));
  if (!parsed.number) return null;

  const fields = caseItem.fields || {};

  const plaintiffs: KadArbitrCounterparty[] = [];
  const respondents: KadArbitrCounterparty[] = [];
  const thirdParties: KadArbitrCounterparty[] = [];

  for (const p of asArray(fields['Истец'])) {
    const c = rusprofilePartyToCounterparty(p);
    if (c) plaintiffs.push(c);
  }
  for (const p of asArray(fields['Ответчик'])) {
    const c = rusprofilePartyToCounterparty(p);
    if (c) respondents.push(c);
  }
  for (const p of asArray(fields['Третье лицо'])) {
    const c = rusprofilePartyToCounterparty(p);
    if (c) thirdParties.push(c);
  }

  const extra: Array<{ attribute: string; value: string }> = [];
  if (fields['Сумма'])     extra.push({ attribute: 'amount',   value: String(fields['Сумма']) });
  if (fields['Категория']) extra.push({ attribute: 'category', value: String(fields['Категория']) });
  if (fields['Тип'])       extra.push({ attribute: 'subject',  value: String(fields['Тип']) });
  if (fields['Исход'])     extra.push({ attribute: 'result',   value: String(fields['Исход']) });
  if (caseItem.status)     extra.push({ attribute: 'status',   value: String(caseItem.status) });

  return {
    case_number: parsed.number,
    case_uuid: extractKadUuidFromUrl(caseItem.kad_url),
    case_type: mapRusprofileCaseType(String(fields['Тип'] || '')),
    filing_date: parsed.date,
    court: '',
    judge: undefined,
    plaintiffs,
    respondents,
    third_parties: thirdParties,
    extra_observations: extra,
  };
}

/**
 * Определяет роль целевой компании в деле по её rusprofile_id.
 */
function detectTargetRoleInRusprofileCase(
  caseItem: any,
  targetRusprofileId: string
): 'plaintiff' | 'defendant' | 'third_party' | undefined {
  const fields = caseItem?.fields || {};
  const target = `id:${targetRusprofileId}`;

  const check = (value: any, role: 'plaintiff' | 'defendant' | 'third_party') => {
    for (const p of asArray(value)) {
      if (extractRusprofileId(p?.href) === target) return role;
    }
    return undefined;
  };

  return (
    check(fields['Истец'], 'plaintiff') ||
    check(fields['Ответчик'], 'defendant') ||
    check(fields['Третье лицо'], 'third_party')
  );
}

/**
 * Сохраняет все дела из rusprofile `arbitration_details`.
 * Каждое дело прогоняется через `persistCase` — ту же функцию,
 * что и для kad.arbitr. Дедупликация по normalized_case_number
 * автоматически объединяет дела из двух источников.
 */
export function persistRusprofileArbitration(
  targetEntityId: number,
  targetRusprofileId: string,
  arbitrationDetails: any,
  sourceId: number,
  rawFilePath?: string
): {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  casesProcessed: number;
} {
  let savedEntities = 0;
  let savedRelations = 0;
  let savedObservations = 0;
  let casesProcessed = 0;

  const cases: any[] = Array.isArray(arbitrationDetails?.cases)
    ? arbitrationDetails.cases
    : [];

  for (const caseItem of cases) {
    const kadCase = rusprofileCaseToKadArbitrCase(caseItem);
    if (!kadCase) continue;

    const targetRole = detectTargetRoleInRusprofileCase(caseItem, targetRusprofileId);

    try {
      const r = persistCase({
        caseItem: kadCase,
        sourceId,
        targetEntityId,
        targetRole,
        rawFilePath,
      });

      savedEntities += r.savedEntities;
      savedRelations += r.savedRelations;
      savedObservations += r.savedObservations;
      casesProcessed++;
    } catch (e) {
      console.warn(
        `[persistRusprofileArbitration] Дело пропущено: ` +
        `number=${kadCase.case_number}, ` +
        `plaintiffs=${kadCase.plaintiffs.map(p => `${p.name}(${p.rusprofile_id ?? '-'})`).join(', ')}, ` +
        `respondents=${kadCase.respondents.map(p => `${p.name}(${p.rusprofile_id ?? '-'})`).join(', ')}; ` +
        `error=${(e as Error).message}`
      );
    }
  }

  console.log(
    `[persistRusprofileArbitration] Обработано дел: ${casesProcessed}, ` +
    `сущностей: ${savedEntities}, связей: ${savedRelations}, наблюдений: ${savedObservations}`
  );

  return { savedEntities, savedRelations, savedObservations, casesProcessed };
}

// ============================================================================
// KAD.ARBITR: карточка дела (стороны + инстансы + события)
// ============================================================================

/**
 * Определяет предикат-роль стороны в деле по типу td в карточке.
 * Используется, когда side пришёл из карточки (там нет поля role).
 */
function sidePredicateFromTd(
  td: 'plaintiffs' | 'defendants' | 'third' | 'others'
): 'plaintiff_in' | 'defendant_in' | 'third_party_in' | 'associated_with' {
  switch (td) {
    case 'plaintiffs': return 'plaintiff_in';
    case 'defendants': return 'defendant_in';
    case 'third':      return 'third_party_in';
    case 'others':     return 'associated_with';
  }
}

/**
 * Upsert стороны дела (из карточки kad.arbitr).
 * Возвращает id сущности-стороны.
 */
function persistCardSide(
  side: KadArbitrCardSide,
  predicate: 'plaintiff_in' | 'defendant_in' | 'third_party_in' | 'associated_with',
  caseEntityId: number,
  sourceId: number,
  rawFilePath?: string
): { entityId: number; savedRelations: number; savedObservations: number } {
  const type = detectCounterpartyType(side.name);
  const entityType =
    type === 'person' ? 'person'
    : type === 'company' ? 'company'
    : 'other';

  const entityId = upsertEntity({
    type: entityType,
    value: side.name,
    label: side.name,
    confidence: type === 'unknown' ? 50 : 75,
    status: 'unverified',
    raw_file_path: rawFilePath,
  });

  let savedObservations = 0;
  let savedRelations = 0;

  if (side.address) {
    const r = addObservation({
      entity_id: entityId,
      attribute: 'address',
      value: side.address,
      source_id: sourceId,
      confidence: 70,
      raw_file_path: rawFilePath,
    });
    if (r.inserted) savedObservations++;
  }

  if (side.side_uuid) {
    const r = addObservation({
      entity_id: entityId,
      attribute: 'kad_side_uuid',
      value: side.side_uuid,
      source_id: sourceId,
      confidence: 90,
      raw_file_path: rawFilePath,
    });
    if (r.inserted) savedObservations++;
  }

  const rel = addRelation({
    subject_id: entityId,
    predicate,
    object_id: caseEntityId,
    source_id: sourceId,
    evidence_text: `Сторона дела (kad.arbitr)`,
    confidence: 85,
    status: 'unverified',
    raw_file_path: rawFilePath,
  });
  if (rel.inserted) savedRelations++;

  return { entityId, savedRelations, savedObservations };
}

/**
 * Сохраняет все события одного инстанса.
 * Судья и суд уже промотированы заранее, их id передаются сюда.
 */
/**
 * Сохраняет все события одного инстанса.
 *
 * Дополнительно: для «определений об отложении/назначении», в которых
 * есть hearing_date (дата следующего заседания), создаём дубль-событие
 * типа `hearing`. Это даёт календарю «будущие заседания» без разбора
 * текста на уровне UI.
 *
 * Идемпотентно: дубль дедуплицируется по (case, event_date, event_type,
 * content) внутри `addCaseEvent` — повторный прогон не создаст копий.
 * `event_uuid` для дубля не передаём — это производная запись.
 */
export function persistCaseEvents(
  caseEntityId: number,
  events: KadArbitrCardEvent[],
  sourceId: number,
  judgeEntityId?: number,
  courtEntityId?: number,
  rawFilePath?: string
): { inserted: number; updated: number; skipped: number } {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const ev of events) {
    const notes = ev.additional_info || null;

    const r = addCaseEvent({
      case_entity_id: caseEntityId,
      event_uuid: ev.event_uuid ?? null,
      event_date: ev.event_date,
      event_type: ev.event_type,
      judge_entity_id: ev.judge ? judgeEntityId ?? null : null,
      court_entity_id: courtEntityId ?? null,
      content: ev.content ?? null,
      document_url: ev.document_url ?? null,
      source_id: sourceId,
      origin: 'scraper',
      notes,
      hearing_date: ev.hearing_date ?? null,
      hearing_time: ev.hearing_time ?? null,
      hearing_place: ev.hearing_place ?? null,
      hearing_judges:
        ev.hearing_judges && ev.hearing_judges.length > 0
          ? JSON.stringify(ev.hearing_judges)
          : null,
    });

    if (r.inserted) inserted++;
    else if (r.updated) updated++;
    else skipped++;

    // Дубль-событие hearing из «определений об отложении».
    // Создаём только если у события есть hearing_date.
    if (ev.event_type === 'ruling' && ev.hearing_date) {
      const hearingContent = ev.hearing_time
        ? `Заседание в ${ev.hearing_time}`
        : 'Судебное заседание';

      const dup = addCaseEvent({
        case_entity_id: caseEntityId,
        // event_uuid не передаём — производная запись, дедуп по контенту
        event_date: ev.hearing_date,
        event_type: 'hearing',
        judge_entity_id: judgeEntityId ?? null,
        court_entity_id: courtEntityId ?? null,
        content: hearingContent,
        source_id: sourceId,
        origin: 'scraper',
        notes: ev.hearing_place ?? null,
        // дубль сам тоже «знает» своё время/место
        hearing_date: ev.hearing_date,
        hearing_time: ev.hearing_time ?? null,
        hearing_place: ev.hearing_place ?? null,
      });

      if (dup.inserted) inserted++;
      else if (dup.updated) updated++;
      else skipped++;
    }
  }

  return { inserted, updated, skipped };
}

/**
 * Сохраняет карточку дела целиком:
 *  - сущность court_case;
 *  - observations на неё;
 *  - стороны (истцы/ответчики/третьи/иные);
 *  - судью и суд первой инстанции;
 *  - события по всем инстансам.
 *
 * Идемпотентно: повторный вызов не создаёт дубликатов.
 */
export function persistKadArbitrCard(
  card: KadArbitrCard,
  sourceId: number,
  rawFilePath?: string
): {
  caseEntityId: number;
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  eventsInserted: number;
  eventsUpdated: number;
} {
  let savedEntities = 0;
  let savedRelations = 0;
  let savedObservations = 0;
  let eventsInserted = 0;
  let eventsUpdated = 0;

  // 1. Сущность court_case
  const normalized = normalizeCaseNumber(card.case_number);
  const caseEntityId = upsertEntity({
    type: 'court_case',
    value: normalized,
    label: `Дело ${card.case_number}`,
    confidence: 95,
    status: 'confirmed',
    notes: `Тип: ${card.case_type}${card.category ? `; ${card.category}` : ''}`,
    raw_file_path: rawFilePath,
  });
  savedEntities++;

  // 2. Observations на court_case
  const caseObs: Array<{ attribute: string; value: string | undefined }> = [
    { attribute: 'case_number', value: card.case_number },
    { attribute: 'case_uuid',   value: card.case_uuid },
    { attribute: 'case_type',   value: card.case_type },
    { attribute: 'filing_date', value: card.filing_date },
    { attribute: 'category',    value: card.category },
    { attribute: 'status',      value: card.status },
  ];
  for (const obs of caseObs) {
    if (!obs.value) continue;
    const r = addObservation({
      entity_id: caseEntityId,
      attribute: obs.attribute,
      value: obs.value,
      source_id: sourceId,
      confidence: 90,
      raw_file_path: rawFilePath,
    });
    if (r.inserted) savedObservations++;
  }

  // 3. Стороны
  const sideGroups: Array<{
    items: KadArbitrCardSide[];
    td: 'plaintiffs' | 'defendants' | 'third' | 'others';
  }> = [
    { items: card.sides.plaintiffs,   td: 'plaintiffs' },
    { items: card.sides.respondents,  td: 'defendants' },
    { items: card.sides.third_parties, td: 'third' },
    { items: card.sides.others,       td: 'others' },
  ];

  for (const group of sideGroups) {
    for (const side of group.items) {
      const predicate = sidePredicateFromTd(group.td);
      const r = persistCardSide(side, predicate, caseEntityId, sourceId, rawFilePath);
      savedEntities++;
      savedRelations += r.savedRelations;
      savedObservations += r.savedObservations;
    }
  }

  // 4. Инстансы, судьи, суды, события
  for (const inst of card.instances) {
    // Суд инстанса
    let courtEntityId: number | undefined;
    if (inst.court_name) {
      courtEntityId = promoteCourtToEntity(inst.court_name, sourceId);
      const r = addRelation({
        subject_id: caseEntityId,
        predicate: 'heard_by',
        object_id: courtEntityId,
        source_id: sourceId,
        evidence_text: `${inst.level}: ${inst.court_name}`,
        confidence: 90,
        status: 'confirmed',
        raw_file_path: rawFilePath,
      });
      if (r.inserted) savedRelations++;
    }

    // Судьи инстанса (если есть в шапке — только у первой инстанции)
    let judgeEntityId: number | undefined;
    if (inst.judges && inst.judges.length > 0) {
      for (const judgeName of inst.judges) {
        const jid = promoteJudgeToEntity(judgeName, inst.court_name, sourceId);
        if (!judgeEntityId) judgeEntityId = jid; // для событий берём первого
        const r = addRelation({
          subject_id: jid,
          predicate: 'judge_of',
          object_id: caseEntityId,
          source_id: sourceId,
          evidence_text: `${judgeName} (${inst.court_name})`,
          confidence: 90,
          status: 'confirmed',
          raw_file_path: rawFilePath,
        });
        if (r.inserted) savedRelations++;
      }
    }

    // События инстанса
    if (inst.events.length > 0) {
      const evStats = persistCaseEvents(
        caseEntityId,
        inst.events,
        sourceId,
        judgeEntityId,
        courtEntityId,
        rawFilePath
      );
      eventsInserted += evStats.inserted;
      eventsUpdated += evStats.updated;
    }
  }

  return {
    caseEntityId,
    savedEntities,
    savedRelations,
    savedObservations,
    eventsInserted,
    eventsUpdated,
  };
}

// ============================================================================
// RUSPROFILE: reparse из дампа (без сети)
// ============================================================================

/**
 * Перечитывает ранее сохранённый дамп без обращения к сети.
 *
 * Прогоняет сырой JSON через те же парсеры, что и обычный scrape:
 *   - persistCompanyData (summary, founders, connections, IP, ФЛ→ИП);
 *   - persistRusprofileArbitration (arbitration_details.cases).
 *
 * Используется для отладки парсеров: правим код → reparse → смотрим БД.
 *
 * Не делает:
 *   - не скачивает данные,
 *   - не трогает raw_dumps (файл, collected_sections, section_updated_at),
 *   - не меняет другие модули.
 *
 * Идемпотентна: повторный reparse не создаст дубликатов
 * (за счёт ux_observations_triple и ux_relations_triple_via).
 */
export function reparseCompanyFromDump(dumpId: number): {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  mainEntityId: number;
} {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT id, company_inn, company_id_rusprofile, dump_file_path
    FROM raw_dumps
    WHERE id = ?
  `).get(dumpId) as
    | {
        id: number;
        company_inn: string;
        company_id_rusprofile: string | null;
        dump_file_path: string;
      }
    | undefined;

  if (!row) {
    throw new Error(`Дамп #${dumpId} не найден`);
  }

  const data = loadRawDumpSync(row.dump_file_path);
  const companyId = row.company_id_rusprofile ?? '';

  // Источник с collection_method='reparse' — отделяем пересборку из дампа
  // от сетевого сбора в аудите.
  const mainSummary = data.summary || {};
  const mainType = detectEntityTypeFromData(mainSummary);
  const urlPath =
    mainType === 'company'      ? 'id'
    : mainType === 'entrepreneur' ? 'ip'
    : 'person';
  const sourceUrl = companyId
    ? `https://www.rusprofile.ru/${urlPath}/${companyId}`
    : `rusprofile://reparse/${row.company_inn}`;

  const sourceId = addSource({
    url: sourceUrl,
    title: 'Rusprofile (reparse)',
    source_type: 'registry',
    source_kind: 'official_registry',
    provider: 'rusprofile.ru',
    collection_method: 'reparse',
    reliability: 80,
    access_level: 'public',
    retrieved_at: new Date().toISOString(),
    local_path: row.dump_file_path,
  });

  const result = persistCompanyData(
    companyId,
    row.company_inn,
    data,
    row.dump_file_path,
    sourceId
  );

  // arbitration_details.cases — как в saveCompanyData/updateCompanyData,
  // но без сети и без записи в raw_dumps.
  let arbSavedEntities = 0;
  let arbSavedRelations = 0;
  let arbSavedObservations = 0;
  if (data.arbitration_details?.cases?.length) {
    const arb = persistRusprofileArbitration(
      result.mainEntityId,
      companyId,
      data.arbitration_details,
      sourceId,
      row.dump_file_path
    );
    arbSavedEntities = arb.savedEntities;
    arbSavedRelations = arb.savedRelations;
    arbSavedObservations = arb.savedObservations;
  }

  return {
    savedEntities: result.savedEntities + arbSavedEntities,
    savedRelations: result.savedRelations + arbSavedRelations,
    savedObservations: result.savedObservations + arbSavedObservations,
    mainEntityId: result.mainEntityId,
  };
}