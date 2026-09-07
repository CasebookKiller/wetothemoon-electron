import {
  addObservation,
  addRelation,
  addSource,
  auditChange,
  upsertEntity,
} from './database';
import { saveRawDumpSync } from './rawStorage';

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
  if (data.ogrn && data.inn) return 'company';
  if (data.ogrnip && data.inn) return 'entrepreneur';
  if (data.inn && !data.ogrn) return 'entrepreneur';
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
  // 1. Сохраняем сырой дамп (с разделением по региону и типу)
  const raw = saveRawDumpSync(companyInn, data);

  // 2. Создаём источник
  const sourceId = addSource({
    url: `https://www.rusprofile.ru/id/${companyId}`,
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

  // 3. Сохраняем основную сущность (целевую компанию или ИП/ФЛ)
  const mainSummary = data.summary || {};
  const mainType = detectEntityTypeFromData(mainSummary);
  const urlPath = mainType === 'company' ? 'id' : mainType === 'entrepreneur' ? 'ip' : 'person';
  const sourceUrl = `https://www.rusprofile.ru/${urlPath}/${companyId}`;
  const mainEntityId = upsertEntity({
    type: mainType,
    value: mainSummary.name || `Сущность ${companyInn}`,
    label: mainSummary.name,
    confidence: 90,
    status: 'confirmed',
    notes: 'Целевая сущность, собранная скраппером',
    raw_file_path: raw.filePath,
  });

  // 4. Добавляем наблюдения для основной сущности
  const mainObservations: Array<{ attribute: string; value?: string }> = [
    { attribute: 'inn', value: mainSummary.inn },
    { attribute: 'ogrn', value: mainSummary.ogrn },
    { attribute: 'kpp', value: mainSummary.kpp },
    { attribute: 'address', value: mainSummary.address },
    { attribute: 'activity', value: mainSummary.main_activity },
    { attribute: 'director', value: mainSummary.manager?.name },
  ];

  let savedObservations = 0;
  for (const obs of mainObservations) {
    if (obs.value) {
      addObservation({
        entity_id: mainEntityId,
        attribute: obs.attribute,
        value: obs.value,
        source_id: sourceId,
        confidence: 90,
        raw_file_path: raw.filePath,
      });
      savedObservations++;
    }
  }

  let savedEntities = 1; // основная сущность
  let savedRelations = 0;

  // 5. Обработка учредителей
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
        raw_file_path: raw.filePath,
      });

      if (founder.inn) {
        addObservation({
          entity_id: founderId,
          attribute: 'inn',
          value: founder.inn,
          source_id: sourceId,
          raw_file_path: raw.filePath,
        });
        savedObservations++;
      }
      if (founder.share) {
        addObservation({
          entity_id: founderId,
          attribute: 'share',
          value: founder.share,
          source_id: sourceId,
          raw_file_path: raw.filePath,
        });
        savedObservations++;
      }

      addRelation({
        subject_id: founderId,
        predicate: 'founder_of',
        object_id: mainEntityId,
        source_id: sourceId,
        evidence_text: founder.share || null,
        confidence: 75,
        status: 'unverified',
        raw_file_path: raw.filePath,
      });

      savedEntities++;
      savedRelations++;
    }
  }

  // 6. Обработка связей (connections)
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
            raw_file_path: raw.filePath,
          });

          if (org.inn) {
            addObservation({
              entity_id: orgId,
              attribute: 'inn',
              value: org.inn,
              source_id: sourceId,
              raw_file_path: raw.filePath,
            });
            savedObservations++;
          }
          if (org.ogrn) {
            addObservation({
              entity_id: orgId,
              attribute: 'ogrn',
              value: org.ogrn,
              source_id: sourceId,
              raw_file_path: raw.filePath,
            });
            savedObservations++;
          }

          addRelation({
            subject_id: mainEntityId,
            predicate: 'associated_with',
            object_id: orgId,
            source_id: sourceId,
            evidence_text: group.title || null,
            confidence: 50,
            status: 'unverified',
            raw_file_path: raw.filePath,
          });

          savedEntities++;
          savedRelations++;
        }
      }
    }
  }

  // 7. Аудит
  auditChange(
    'entities',
    mainEntityId,
    'create',
    null,
    JSON.stringify(mainSummary),
    'Сохранение сущности из Rusprofile'
  );

  return {
    savedEntities,
    savedRelations,
    savedObservations,
    rawDumpPath: raw.filePath,
  };
}