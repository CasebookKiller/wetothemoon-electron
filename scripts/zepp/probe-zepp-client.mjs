// scripts/zepp/probe-zepp-client.mjs
// Временный скрипт разведки API @dofek/zepp-client.
// В сеть НЕ ходит. Удалить после разведки.

import * as z from '@dofek/zepp-client';

console.log('=== ЭКСПОРТЫ ПАКЕТА ===');
console.log(Object.keys(z));

console.log('\n=== СИГНАТУРА signInToZepp ===');
const fn = z.signInToZepp;
console.log('typeof:', typeof fn);
console.log('length (число объявленных аргументов):', fn?.length);
console.log('source (первые 800 символов):');
console.log(fn?.toString().slice(0, 800));

console.log('\n=== ДРУГИЕ ЭКСПОРТЫ ===');
for (const key of Object.keys(z)) {
  const val = z[key];
  if (typeof val === 'function') {
    console.log(`${key}: function, length=${val.length}`);
  } else {
    console.log(`${key}:`, val);
  }
}

console.log('\n=== КОНСТАНТЫ ===');
console.log('ZEPP_REGISTRATION_REDIRECT_URI:', z.ZEPP_REGISTRATION_REDIRECT_URI);
console.log('ZEPP_ENCRYPTED_REGISTRATION_URL:', z.ZEPP_ENCRYPTED_REGISTRATION_URL);