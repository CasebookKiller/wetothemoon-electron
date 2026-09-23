// scripts/zepp/probe-zepp-fetch.mjs
// Проверяем, вызывается ли кастомный fetch третьим аргументом
// signInToZepp. В сеть НЕ ходим — возвращаем фиктивный 401.
// Удалить после разведки.

import { signInToZepp } from '@dofek/zepp-client';

const calledUrls = [];

const spyFetch = async (input, init) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

  const newUrl = url.replace(
    /api-user-us2\.zepp\.com/g,
    'api-user.zepp.com'
  );

  calledUrls.push({
    original: url,
    replaced: newUrl,
    method: init?.method || (input instanceof Request ? input.method : 'GET'),
    hasBody: !!(init?.body || (input instanceof Request && input.body)),
    headers: init?.headers
      ? Object.fromEntries(new Headers(init.headers))
      : undefined,
  });

  return new Response(JSON.stringify({ error: 'probe' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
};

try {
  await signInToZepp('probe@example.com', 'probe-password', spyFetch);
} catch (e) {
  console.log('Ожидаемая ошибка (probe):', e.constructor.name, '-', e.message);
}

console.log('\n=== ПЕРЕХВАЧЕННЫЕ ЗАПРОСЫ ===');
console.log('Всего вызовов fetch:', calledUrls.length);
for (const [i, c] of calledUrls.entries()) {
  console.log(`\n[${i + 1}]`);
  console.log('  original:', c.original);
  console.log('  replaced:', c.replaced);
  console.log('  method:  ', c.method);
  console.log('  hasBody: ', c.hasBody);
  if (c.headers) {
    console.log('  headers: ', JSON.stringify(c.headers, null, 2));
  }
}

if (calledUrls.length === 0) {
  console.log('\n⚠️  Кастомный fetch НЕ был вызван.');
  console.log('    Библиотека игнорирует третий аргумент —');
  console.log('    подход с подменой хоста не работает.');
} else {
  console.log('\n✅ Кастомный fetch ВЫЗЫВАЕТСЯ. Подмена хоста возможна.');
}