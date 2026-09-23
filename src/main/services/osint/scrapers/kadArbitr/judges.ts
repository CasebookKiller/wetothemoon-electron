// src/main/services/osint/scrapers/kadArbitr/judges.ts

import { Page } from 'playwright';
//import {
//  markPrefixStatus,
//  listPrefixesToScrape,
//  upsertCourt,
//  upsertJudge,
//  countJudges,
//  countCourts,
//  listAllPrefixesForSource,
//  listSaturatedPrefixes,
//} from '../../../database';
//import { addSource } from '../../../database';
import { sleep, normalizeJudgeName } from './helpers';
import type {
  JudgeSuggestion,
  JudgeSuggestResponse,
  JudgesDirectoryOptions,
  JudgesProgressInfo,
} from './types';
import { addSource, countCourts, countJudges, listAllPrefixesForSource, listPrefixesToScrape, listSaturatedPrefixes, markPrefixStatus, upsertCourt, upsertJudge } from '@/main/services/db';

const KAD_HOME = 'https://kad.arbitr.ru/';
const SUGGEST_URL = '/Suggest/Judges';
const SOURCE_KEY = 'kad_judges';
const MAX_DEPTH = 6;         // максимум символов в префиксе
const COUNT_PER_REQUEST = 25;

// Русский алфавит без ё (по решению — MVP без ё)
const RU_LETTERS = 'абвгдежзийклмнопрстуфхцчшщэюя'.split('');

// Стартовые префиксы — сразу 2 буквы.
// 1-буквенные запросы kad.arbitr возвращают мусор (сервер вставляет
// искомую букву в начало ФИО), поэтому пропускаем 1-й уровень.
const RU_START_PREFIXES: string[] = (() => {
  const arr: string[] = [];
  for (const a of RU_LETTERS) {
    for (const b of RU_LETTERS) {
      arr.push(a + b);
    }
  }
  return arr;
})();

/**
 * Публичная точка входа: обходит справочник судей kad.arbitr.
 *
 * Логика:
 * 1. Регистрируем source (один на весь обход).
 * 2. Загружаем прогресс из scrape_progress.
 * 3. BFS по префиксам:
 *    - pending / error / устаревшие done → в очередь.
 *    - Для каждого префикса: запрос к /Suggest/Judges.
 *    - Если Items.length < COUNT_PER_REQUEST → ветка закончилась, done.
 *    - Если == COUNT_PER_REQUEST → дробить на следующий уровень (prefix+буква).
 * 4. Rate limit: пауза между запросами.
 * 5. Прогресс наружу через onProgress.
 * 6. Отмена через signal.
 */
export async function scrapeJudgesDirectory(
  page: Page,
  options: JudgesDirectoryOptions = {}
): Promise<{ judgesTotal: number; courtsTotal: number; requests: number }> {
  const ratePerSecond = options.ratePerSecond ?? 1;
  const maxRequests = options.maxRequests ?? 10000;
  const signal = options.signal;
  const onProgress = options.onProgress;

  // 1. Source
  const sourceId = addSource({
    url: KAD_HOME,
    title: 'KAD Arbitr — справочник судей',
    source_type: 'court',
    source_kind: 'official_registry',
    provider: 'kad.arbitr.ru',
    collection_method: 'browser',
    reliability: 90,
    access_level: 'public',
    retrieved_at: new Date().toISOString(),
  });

  // 2. Очередь префиксов
  //    Сначала то, что уже в scrape_progress (pending/error/устаревшие),
  //    затем (если прогресса нет) — свежая инициализация 33 буквами.
    // Префиксы, требующие обхода: pending / error / in_progress / устаревшие done
    // 1. Все известные префиксы (любой статус)
  const allRows = listAllPrefixesForSource(SOURCE_KEY);
  const knownPrefixes = new Set(allRows.map((r) => r.prefix));

  // 2. Что требует обхода: pending / error / in_progress / устаревшие done
  const toScrape = listPrefixesToScrape(SOURCE_KEY, 90);
  const queueSet = new Set(toScrape.map((r) => r.prefix));

  // 3. Буквы, которых нет в таблице — первый запуск или обрыв на 1-й итерации
  const missingStart = RU_START_PREFIXES.filter((p) => !knownPrefixes.has(p));
  for (const p of missingStart) queueSet.add(p);

  if (missingStart.length > 0) {
    console.log(`[judges] Новые стартовые префиксы: ${missingStart.length}`);
  }

  // 4. Авто-добор пропущенных под-префиксов у saturated-родителей.
  //    Если у родителя с items_found >= 25 нет хотя бы одного дочернего
  //    префикса в scrape_progress — значит обход был прерван и дети
  //    потеряны (лежали в памяти, не успели записаться).
  const saturated = listSaturatedPrefixes(SOURCE_KEY);
  let recoveredCount = 0;
  for (const { prefix: parent } of saturated) {
    for (const l of RU_LETTERS) {
      const child = parent + l;
      if (!knownPrefixes.has(child)) {
        queueSet.add(child);
        knownPrefixes.add(child);
        recoveredCount++;
      }
    }
  }
  if (recoveredCount > 0) {
    console.log(`[judges] Восстановлено пропущенных под-префиксов: ${recoveredCount}`);
  }

  let queue: string[] = [...queueSet];

  if (queue.length === 0) {
    console.log('[judges] Нечего обходить — справочник актуален.');
    return { judgesTotal: countJudges(), courtsTotal: countCourts(), requests: 0 };
  }

  console.log(`[judges] Очередь: ${queue.length} префиксов.`);

  // 3. BFS
  const visited = new Set<string>();
  let requests = 0;
  let totalJudges = countJudges();
  let totalCourts = countCourts();

  // Задержка между запросами (мс)
  const delayMs = Math.max(0, Math.floor(1000 / ratePerSecond));

  while (queue.length > 0) {
    if (signal?.aborted) {
      console.log('[judges] Отменено пользователем.');
      break;
    }
    if (requests >= maxRequests) {
      console.log(`[judges] Достигнут лимит запросов (${maxRequests}).`);
      break;
    }

    const prefix = queue.shift()!;
    if (visited.has(prefix)) continue;
    visited.add(prefix);

    if (prefix.length > MAX_DEPTH) {
      console.warn(`[judges] Префикс "${prefix}" превышает MAX_DEPTH=${MAX_DEPTH}, пропускаем.`);
      markPrefixStatus({ source: SOURCE_KEY, prefix, status: 'done', itemsFound: 0 });
      continue;
    }

    markPrefixStatus({ source: SOURCE_KEY, prefix, status: 'in_progress' });

    let items: JudgeSuggestion[] = [];
    let lastError: string | null = null;

    try {
      items = await fetchSuggest(page, prefix);
      requests++;
    } catch (e) {
      lastError = (e as Error).message;
      console.error(`[judges] Ошибка на "${prefix}":`, lastError);
      markPrefixStatus({
        source: SOURCE_KEY,
        prefix,
        status: 'error',
        lastError,
      });
      // Пауза перед следующим, чтобы не долбить сервер при падении
      await safeSleep(delayMs * 2, signal);
      continue;
    }

    // Сохраняем результаты
    let insertedJudges = 0;
    let insertedCourts = 0;
    for (const item of items) {
      const persisted = persistOne(item, sourceId);
      if (persisted.judgeInserted) insertedJudges++;
      if (persisted.courtInserted) insertedCourts++;
    }
    totalJudges += insertedJudges;
    totalCourts += insertedCourts;

    // Полный префикс → дробим
    const isSaturated = items.length >= COUNT_PER_REQUEST;
    if (isSaturated) {
      if (prefix.length < MAX_DEPTH) {
        for (const letter of RU_LETTERS) {
          const next = prefix + letter;
          if (!visited.has(next)) {
            queue.push(next);
            // ← немедленно фиксируем в БД, чтобы обход можно было прервать
            //   без потери детей (иначе они жили только в памяти).
            if (!knownPrefixes.has(next)) {
              markPrefixStatus({ source: SOURCE_KEY, prefix: next, status: 'pending' });
              knownPrefixes.add(next);
            }
          }
        }
      } else {
        console.warn(
          `[judges] Префикс "${prefix}" упёрся в лимит на глубине ${MAX_DEPTH}, дальше некуда.`
        );
      }
    }

    markPrefixStatus({
      source: SOURCE_KEY,
      prefix,
      status: 'done',
      itemsFound: items.length,
    });

    // Прогресс
    if (onProgress) {
      onProgress({
        prefix,
        status: 'done',
        itemsFound: items.length,
        totalDone: visited.size,
        totalPending: queue.length,
        judgesTotal: totalJudges,
        courtsTotal: totalCourts,
      });
    }

    console.log(
      `[judges] "${prefix}" → ${items.length} записей, ` +
      `в очереди: ${queue.length}, всего судей: ${totalJudges}`
    );

    await safeSleep(delayMs, signal);
  }

  console.log(
    `[judges] Обход завершён. Запросов: ${requests}, судей: ${totalJudges}, судов: ${totalCourts}.`
  );

  return { judgesTotal: totalJudges, courtsTotal: totalCourts, requests };
}

/**
 * Один запрос к /Suggest/Judges?name={prefix}.
 * Использует page.evaluate(fetch), чтобы переиспользовать cookies и заголовки
 * реального браузера.
 */
async function fetchSuggest(page: Page, prefix: string): Promise<JudgeSuggestion[]> {
  const url = `${SUGGEST_URL}?count=${COUNT_PER_REQUEST}&suggestType=judge&name=${encodeURIComponent(prefix)}`;

  const data = await page.evaluate(async (u): Promise<JudgeSuggestResponse | null> => {
    try {
      const res = await fetch(u, {
        headers: { 'x-requested-with': 'XMLHttpRequest' },
        credentials: 'include',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, url);

  if (!data || !data.Success || !data.Result) {
    throw new Error(`Suggest вернул пустой/некорректный ответ для "${prefix}"`);
  }

  // Фильтр мусора: имя должно содержать пробел (ФИО), Id не пустой
  return data.Result.Items.filter((i) => {
    if (!i.Id || !i.Name) return false;
    if (!i.Name.includes(' ')) return false;

    const trimmed = i.Name.trim();

    // Мусор от 1-буквенных запросов: «АБабенко Н. А.», «А Арзамаскина», «абурдаева»
    if (/^[а-яё]/.test(trimmed)) return false;       // строчная первая
    if (/^[А-ЯЁ][А-ЯЁ][а-яё]/.test(trimmed)) return false;  // две заглавные + строчная

    const firstWord = trimmed.split(/\s+/)[0];
    if (firstWord.replace(/\./g, '').length < 2) return false;

    return true;
  });
}

/**
 * Сохраняет одну запись судьи + его суд.
 */
function persistOne(
  item: JudgeSuggestion,
  sourceId: number
): { judgeInserted: boolean; courtInserted: boolean } {
  // 1. Суд
  const court = upsertCourt({
    court_tag: item.CourtTag,
    court_name: item.CourtName,
    court_type: 'arbitration',
    source_id: sourceId,
  });

  // 2. Судья
  const judge = upsertJudge({
    judge_uuid: item.Id,
    name: item.Name,
    court_id: court.id,
    post: item.Post || null,
    source_id: sourceId,
  });

  return {
    judgeInserted: judge.inserted,
    courtInserted: court.inserted,
  };
}

/**
 * sleep с подавлением отмены — используется в конце итерации, чтобы
 * не падать на закрытии, а плавно выйти.
 */
async function safeSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  try {
    await sleep(ms, signal);
  } catch {
    // aborted — не страшно, следующий цикл проверит signal.aborted
  }
}

/**
 * Хелпер для UI: короткая сводка состояния справочника.
 */
export function getJudgesDirectoryStats(): {
  judges: number;
  courts: number;
} {
  return {
    judges: countJudges(),
    courts: countCourts(),
  };
}