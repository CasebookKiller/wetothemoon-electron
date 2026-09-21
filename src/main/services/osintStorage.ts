import fs from 'fs';
import { encode } from '@msgpack/msgpack';

import {
  addObservation,
  addRawDumpRecord,
  addRelation,
  addSource,
  auditChange,
  getDumpSectionsUpdatedAt,
  updateRawDumpSections,
  upsertEntity,
  getDatabase,
} from './database';
import { saveRawDumpSync } from './rawStorage';
import { KadArbitrCase, KadArbitrData, KadArbitrCounterparty } from './osint/scrapers/kadArbitr';

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
function detectEntityTypeFromData(data: any): string {
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

function persistCompanyData(
  companyId: string,
  companyInn: string,
  data: any,
  rawFilePath: string,
  sourceId: number
): {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
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

  let savedObservations = 0;
  const mainObservations = [
    { attribute: 'inn', value: mainSummary.inn },
    { attribute: 'ogrn', value: mainSummary.ogrn },
    { attribute: 'ogrnip', value: mainSummary.ogrnip },
    { attribute: 'kpp', value: mainSummary.kpp },
    { attribute: 'address', value: mainSummary.address },
    { attribute: 'activity', value: mainSummary.main_activity },
    { attribute: 'director', value: mainSummary.manager?.name },
  ];
  for (const obs of mainObservations) {
    if (obs.value) {
      const r = addObservation({
        entity_id: mainEntityId,
        attribute: obs.attribute,
        value: obs.value,
        source_id: sourceId,
        confidence: 90,
        raw_file_path: rawFilePath,
      });
      if (r.inserted) savedObservations++;
    }
  }

  let savedEntities = 1;
  let savedRelations = 0;

  // === Автоматическая связь ФЛ ↔ ИП ===
  // Если это физлицо и у него есть признак ИП в summary.ip — попытаемся
  // связать его с существующей сущностью entrepreneur (по ОГРНИП).
  // Если сущности ИП нет — не создаём «висячую» связь.
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
        } else {
          console.log(
            `[persistCompanyData] Связь ФЛ #${mainEntityId} ↔ ИП #${ipEntityId} уже существует (id=${id})`
          );
        }
      }
    }
  }

  // Обработка учредителей (как раньше)
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
        if (addObservation({ entity_id: founderId, attribute: 'inn', value: founder.inn, source_id: sourceId, raw_file_path: rawFilePath }).inserted) savedObservations++;
      }
      if (founder.ogrn) {
        if (addObservation({ entity_id: founderId, attribute: 'ogrn', value: founder.ogrn, source_id: sourceId, raw_file_path: rawFilePath }).inserted) savedObservations++;
      }
      if (founder.ogrnip) {
        if (addObservation({ entity_id: founderId, attribute: 'ogrnip', value: founder.ogrnip, source_id: sourceId, raw_file_path: rawFilePath }).inserted) savedObservations++;
      }
      if (founder.share) {
        if (addObservation({ entity_id: founderId, attribute: 'share', value: founder.share, source_id: sourceId, raw_file_path: rawFilePath }).inserted) savedObservations++;
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
      if (inserted) savedRelations++;
      savedEntities++;
    }
  }

  // Обработка связей (connections_details)
  if (data.connections_details?.connections) {
    for (const group of data.connections_details.connections) {
      if (group.organizations) {
        for (const org of group.organizations) {
          const orgType =
            detectEntityTypeFromHref(org.href) || detectEntityTypeFromData(org);
          const orgRusprofileId = extractRusprofileId(org.href) || (org.inn ? `inn:${org.inn}` : undefined);
          const orgValue = org.name || org.inn || 'Связанная организация';

          const orgId = upsertEntity({
            rusprofile_id: orgRusprofileId,
            type: orgType,
            value: orgValue,
            label: org.name,
            confidence: 60,
            status: 'unverified',
            raw_file_path: rawFilePath,
          });

          if (org.inn) {
            if (addObservation({ entity_id: orgId, attribute: 'inn', value: org.inn, source_id: sourceId, raw_file_path: rawFilePath }).inserted) savedObservations++;
          }
          if (org.ogrn) {
            if (addObservation({ entity_id: orgId, attribute: 'ogrn', value: org.ogrn, source_id: sourceId, raw_file_path: rawFilePath }).inserted) savedObservations++;
          }
          if (org.ogrnip) {
            if (addObservation({ entity_id: orgId, attribute: 'ogrnip', value: org.ogrnip, source_id: sourceId, raw_file_path: rawFilePath }).inserted) savedObservations++;
          }

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
          if (inserted) savedRelations++;
          savedEntities++;
        }
      }
    }
  }

  // Аудит
  auditChange('entities', mainEntityId, 'update', null, JSON.stringify(mainSummary), 'Сохранение/обновление сущности из Rusprofile');

  return { savedEntities, savedRelations, savedObservations };
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

  return {
    ...result,
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

  return {
    ...result,
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

/**
 * Сохраняет результат scrapeKadArbitr в БД.
 *
 * Логика:
 * 1. Находит/создаёт целевую сущность по ИНН.
 * 2. Для каждого дела — upsert сущности court_case + observations.
 * 3. Связь целевой сущности с делом (plaintiff_in/defendant_in/third_party_in).
 * 4. Контрагенты — upsert сущностей + связи с делом.
 * 5. Суд — ленивая промоция + связь heard_by.
 * 6. Судья — ленивая промоция + связь judge_of.
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
  savedEntities++; // как минимум 1 (или подтверждённая существующая)

  const primaryRole = data.search_params.roles[0] || 'any';
  const targetPredicate = roleToPredicate(primaryRole);

  for (const caseItem of data.cases) {
    // 2. Сущность court_case
    const caseEntityId = upsertEntity({
      type: 'court_case',
      value: caseItem.case_number,
      label: `Дело ${caseItem.case_number}`,
      confidence: 90,
      status: 'confirmed',
      notes: `Тип: ${caseItem.case_type}; суд: ${caseItem.court}`,
    });
    savedEntities++;

    // Observations дела
    const caseObs: Array<{ attribute: string; value: string | undefined }> = [
      { attribute: 'case_number', value: caseItem.case_number },
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
      });
      if (r.inserted) savedObservations++;
    }

    // 3. Роль целевой сущности в деле
    if (targetPredicate) {
      const r = addRelation({
        subject_id: targetEntityId,
        predicate: targetPredicate,
        object_id: caseEntityId,
        source_id: sourceId,
        evidence_text: `Дело ${caseItem.case_number}`,
        confidence: 90,
        status: 'confirmed',
      });
      if (r.inserted) savedRelations++;
    } else {
      // 'any' — уточняем по спискам
      const asPlaintiff = caseItem.plaintiffs.find((p) => p.inn === inn);
      const asDefendant = caseItem.respondents.find((p) => p.inn === inn);
      if (asPlaintiff) {
        const r = addRelation({
          subject_id: targetEntityId,
          predicate: 'plaintiff_in',
          object_id: caseEntityId,
          source_id: sourceId,
          evidence_text: `Дело ${caseItem.case_number}`,
          confidence: 90,
          status: 'confirmed',
        });
        if (r.inserted) savedRelations++;
      }
      if (asDefendant) {
        const r = addRelation({
          subject_id: targetEntityId,
          predicate: 'defendant_in',
          object_id: caseEntityId,
          source_id: sourceId,
          evidence_text: `Дело ${caseItem.case_number}`,
          confidence: 90,
          status: 'confirmed',
        });
        if (r.inserted) savedRelations++;
      }
    }

    // 4. Суд
    if (caseItem.court) {
      const courtEntityId = promoteCourtToEntity(caseItem.court, sourceId);
      if (courtEntityId) {
        const r = addRelation({
          subject_id: caseEntityId,
          predicate: 'heard_by',
          object_id: courtEntityId,
          source_id: sourceId,
          evidence_text: caseItem.court,
          confidence: 90,
          status: 'confirmed',
        });
        if (r.inserted) savedRelations++;
      }
    }

    // 5. Судья
    if (caseItem.judge) {
      const judgeEntityId = promoteJudgeToEntity(caseItem.judge, caseItem.court, sourceId);
      if (judgeEntityId) {
        const r = addRelation({
          subject_id: judgeEntityId,
          predicate: 'judge_of',
          object_id: caseEntityId,
          source_id: sourceId,
          evidence_text: caseItem.judge,
          confidence: 90,
          status: 'confirmed',
        });
        if (r.inserted) savedRelations++;
      }
    }

    // 6. Контрагенты
    const partyGroups: Array<{
      items: KadArbitrCounterparty[];
      predicate: CasePredicate;
    }> = [
      { items: caseItem.plaintiffs, predicate: 'plaintiff_in' },
      { items: caseItem.respondents, predicate: 'defendant_in' },
    ];

    for (const group of partyGroups) {
      for (const party of group.items) {
        // Пропускаем саму целевую организацию — она уже связана
        if (party.inn === inn) continue;

        const type =
          party.type === 'person'  ? 'person'
          : party.type === 'company' ? 'company'
          : 'other';

        const partyEntityId = upsertEntity({
          type,
          value: party.name,
          label: party.name,
          confidence: party.type === 'unknown' ? 50 : 70,
          status: 'unverified',
          notes: party.hidden_data ? 'Данные скрыты в kad.arbitr' : undefined,
        });
        savedEntities++;

        // Наблюдения контрагента
        if (party.inn) {
          const r = addObservation({
            entity_id: partyEntityId,
            attribute: 'inn',
            value: party.inn,
            source_id: sourceId,
            confidence: 80,
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
          });
          if (r.inserted) savedObservations++;
        }

        // Связь контрагент → дело
        const r = addRelation({
          subject_id: partyEntityId,
          predicate: group.predicate,
          object_id: caseEntityId,
          source_id: sourceId,
          evidence_text: `${group.predicate} по делу ${caseItem.case_number}`,
          confidence: 80,
          status: 'unverified',
        });
        if (r.inserted) savedRelations++;
      }
    }
  }

  return { savedEntities, savedRelations, savedObservations, targetEntityId };
}