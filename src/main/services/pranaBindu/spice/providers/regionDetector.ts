// src/main/services/pranaBindu/spice/regionDetector.ts
//
// Автодетект регионального хоста Zepp.
//
// Библиотека @dofek/zepp-client жёстко зашивает US2-хосты:
//   - регистрация: POST https://api-user-us2.zepp.com/v2/registrations/tokens
//   - exchange:    POST https://api-mifit-us2.zepp.com/v2/client/login
//
// Оба запроса идут через переданный fetchFn (см. client.js:98, 175),
// поэтому одной подмены хостов достаточно для всего флоу.
//
// Проверено probe-скриптами 2026-09-23 (scripts/zepp/).

import { signInToZepp } from '@dofek/zepp-client';

interface RegionPair {
  /** Хост аутентификации (первый шаг — registration) */
  authHost: string;
  /** Хост обмена кода на токен (второй шаг — login) */
  dataHost: string;
}

/**
 * Порядок перебора: от наиболее вероятного (глобальный) к резервным.
 * Зафиксировано в PROJECT_STATE.md 2026-09-23.
 */
const REGION_CANDIDATES: readonly RegionPair[] = [
  { authHost: 'api-user.zepp.com',    dataHost: 'api-mifit.zepp.com' },
  { authHost: 'api-user-de2.zepp.com', dataHost: 'api-mifit-de2.zepp.com' },
  { authHost: 'api-user-us2.zepp.com', dataHost: 'api-mifit-us2.zepp.com' },
];

/** Хосты, зашитые в @dofek/zepp-client. */
const ORIGIN_AUTH_HOST = 'api-user-us2.zepp.com';
const ORIGIN_DATA_HOST = 'api-mifit-us2.zepp.com';

export interface ZeppConnectionResult {
  appToken: string;
  userId: string;
  /** Рабочий хост аутентификации */
  authHost: string;
  /** Хост обмена кода на токен */
  dataHost: string;
}

export interface ZeppConnectError {
  host: string;
  message: string;
}

/**
 * Создаёт fetch, который в каждом URL заменяет оригинальные US2-хосты
 * на целевые (указанного региона).
 *
 * @dofek/zepp-client вызывает fetchFn со строкой URL + init, поэтому
 * основной путь — просто передать init без изменений. Ветка Request —
 * defensive, на случай будущих изменений библиотеки.
 */
function createHostReplacingFetch(pair: RegionPair): typeof fetch {
  const replacements: ReadonlyArray<readonly [string, string]> = [
    [ORIGIN_AUTH_HOST, pair.authHost],
    [ORIGIN_DATA_HOST, pair.dataHost],
  ];

  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    let newUrl = url;
    for (const [from, to] of replacements) {
      if (newUrl.includes(from)) {
        newUrl = newUrl.split(from).join(to);
      }
    }

    if (typeof input === 'string' || input instanceof URL) {
      return globalThis.fetch(newUrl, init);
    }

    // Defensive: Request как input. Клонируем, чтобы не съесть body.
    const body = await input.clone().text();
    return globalThis.fetch(newUrl, {
      method: input.method,
      headers: input.headers,
      body,
      ...init,
    });
  };
}

/**
 * Пытается аутентифицироваться в облаке Zepp, перебирая региональные хосты.
 * Возвращает первое успешное подключение или выбрасывает ошибку
 * с перечнем всех попыток.
 */
export async function detectZeppConnection(
  email: string,
  password: string
): Promise<ZeppConnectionResult> {
  const errors: ZeppConnectError[] = [];

  for (const pair of REGION_CANDIDATES) {
    try {
      console.log(`[Spice] Попытка подключения к ${pair.authHost}...`);
      const fetchFn = createHostReplacingFetch(pair);

      const session = await signInToZepp(email, password, fetchFn);

      console.log(`[Spice] Успешное подключение через ${pair.authHost}`);

      return {
        appToken: session.appToken,
        userId: session.userId,
        authHost: pair.authHost,
        dataHost: pair.dataHost,
      };
    } catch (error) {
      const message = (error as Error).message;
      errors.push({ host: pair.authHost, message });
      console.warn(`[Spice] ${pair.authHost} не ответил: ${message}`);
    }
  }

  const detail = errors.map((e) => `  • ${e.host}: ${e.message}`).join('\n');
  throw new Error(`Не удалось подключиться ни к одному хосту Zepp.\n${detail}`);
}