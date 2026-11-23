#!/usr/bin/env node
/**
 * test-intervals-abort.mjs
 *
 * Воспроизводит прод-сценарий из auto-sync:
 *   [Prana-Bindu] auto-sync workouts (intervals-icu) error: This operation was aborted
 *
 * Проверяет, что intervalsIcuProvider:
 *   1. при AbortError (таймаут fetch) → бросает IntervalsApiError(status=0, body='aborted'),
 *      а не сырой DOMException;
 *   2. при 401 → IntervalsApiError(status=401), не abort;
 *   3. при 200 [] → возвращает [], это НЕ ошибка.
 *
 * Запуск:  npx tsx scripts/test-intervals-abort.mjs
 *   (или:  node --import tsx scripts/test-intervals-abort.mjs)
 */
import assert from 'node:assert/strict';
import { IntervalsIcuProvider, IntervalsApiError } from '../src/main/services/pranaBindu/spice/providers/intervalsIcuProvider.ts';

const FROM = '2026-08-25';
const TO = '2026-11-23';

const ctx = {
  getApiKey: () => 'fake-key',
  getAthleteId: () => '0',
};

/** Подмена globalThis.fetch на один вызов. */
async function withFetch(fakeFetch, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const abortFetch = async () => {
  // Точно как в логе: undici бросает DOMException с name='AbortError'
  throw new DOMException('This operation was aborted', 'AbortError');
};

const unauthorizedFetch = async () =>
  new Response('nope', { status: 401, statusText: 'Unauthorized' });

const emptyOkFetch = async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });

/** Проверяет, что fn бросает IntervalsApiError с указанными полями. */
async function expectIntervalsError(fn, { status, bodyIncludes }) {
  try {
    await fn();
  } catch (e) {
    assert.ok(
      e instanceof IntervalsApiError,
      `ожидали IntervalsApiError, получили ${e?.name}: ${e?.message}`
    );
    assert.equal(e.status, status, `status: ожидали ${status}, получили ${e.status}`);
    if (bodyIncludes !== undefined) {
      assert.ok(
        typeof e.body === 'string' && e.body.includes(bodyIncludes),
        `body: ожидали подстроку "${bodyIncludes}", получили "${e.body}"`
      );
    }
    return e;
  }
  assert.fail('ожидали ошибку, но функция завершилась успешно');
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e?.message ?? e}`);
  }
}

console.log('\n=== intervals.icu: «не отдал данные» ===\n');

const provider = () => new IntervalsIcuProvider(ctx);

// 1. AbortError → IntervalsApiError(status=0, body='aborted')
await test('fetchWorkouts: AbortError → IntervalsApiError(0, "aborted")', async () => {
  await withFetch(abortFetch, async () => {
    const err = await expectIntervalsError(
      () => provider().fetchWorkouts(FROM, TO),
      { status: 0, bodyIncludes: 'aborted' }
    );
    assert.match(err.message, /таймаут|abort/i);
  });
});

// 2. AbortError в wellness
await test('fetchWellness: AbortError → IntervalsApiError(0, "aborted")', async () => {
  await withFetch(abortFetch, async () => {
    await expectIntervalsError(
      () => provider().fetchWellness(FROM, TO),
      { status: 0, bodyIncludes: 'aborted' }
    );
  });
});

// 3. AbortError в fetchActivitiesRaw
await test('fetchActivitiesRaw: AbortError → IntervalsApiError(0, "aborted")', async () => {
  await withFetch(abortFetch, async () => {
    await expectIntervalsError(
      () => provider().fetchActivitiesRaw(FROM, TO),
      { status: 0, bodyIncludes: 'aborted' }
    );
  });
});

// 4. 401 → IntervalsApiError(401), НЕ abort
await test('fetchWorkouts: 401 → IntervalsApiError(401), не abort', async () => {
  await withFetch(unauthorizedFetch, async () => {
    const err = await expectIntervalsError(
      () => provider().fetchWorkouts(FROM, TO),
      { status: 401 }
    );
    assert.doesNotMatch(err.message, /abort/i);
  });
});

// 5. 200 [] → пустой массив, это НЕ ошибка
await test('fetchWorkouts: 200 [] → [], не ошибка', async () => {
  await withFetch(emptyOkFetch, async () => {
    const res = await provider().fetchWorkouts(FROM, TO);
    assert.deepEqual(res, []);
  });
});

// 6. fetchFileBuffer через fetchUnifiedWorkout: AbortError → IntervalsApiError(0)
await test('fetchUnifiedWorkout: AbortError → IntervalsApiError(0, "aborted")', async () => {
  await withFetch(abortFetch, async () => {
    await expectIntervalsError(
      () => provider().fetchUnifiedWorkout('12345'),
      { status: 0, bodyIncludes: 'aborted' }
    );
  });
});

console.log(`\n=== Итог: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);