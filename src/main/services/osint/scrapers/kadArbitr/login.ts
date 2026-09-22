// src/main/services/osint/scrapers/kadArbitr/login.ts

import { Page } from 'playwright';
import {
  getBrowser,
  getPage,
  getStorageStatePath,
  launchBrowserWithSession,
} from '../../playwrightService';

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const KAD_COOKIES_FILE = () => path.join(app.getPath('userData'), 'kad_cookies.json');

/**
 * Сохраняет ВСЕ cookies контекста (включая session — rcid, ASP.NET_SessionId).
 */
export async function saveAllKadCookies(page: Page): Promise<void> {
  try {
    const cookies = await page.context().cookies();
    fs.writeFileSync(KAD_COOKIES_FILE(), JSON.stringify(cookies, null, 2), 'utf-8');
    console.log(`[kad] Сохранено cookies: ${cookies.length}`);
  } catch (e) {
    console.warn('[kad] Не удалось сохранить cookies:', e);
  }
}

/**
 * Восстанавливает все cookies после создания контекста.
 */
export async function restoreAllKadCookies(page: Page): Promise<void> {
  try {
    const file = KAD_COOKIES_FILE();
    if (!fs.existsSync(file)) {
      console.log('[kad] Файл cookies не найден, пропускаем восстановление.');
      return;
    }
    const cookies = JSON.parse(fs.readFileSync(file, 'utf-8'));
    await page.context().addCookies(cookies);
    console.log(`[kad] Восстановлено cookies: ${cookies.length}`);
  } catch (e) {
    console.warn('[kad] Не удалось восстановить cookies:', e);
  }
}

const KAD_HOME = 'https://kad.arbitr.ru/';
const SESSION_SAVE_TIMEOUT_MS = 10 * 60 * 1000; // 10 минут на ручной логин

export async function ensureKadSession(): Promise<Page> {
  let browser = getBrowser();
  if (!browser || !browser.isConnected()) {
    await launchBrowserWithSession('kad', KAD_HOME);
    browser = getBrowser();
  }
  if (!browser) throw new Error('Не удалось запустить браузер для kad.arbitr');

  let page = getPage();
  if (!page || page.isClosed()) {
    page = await browser.newPage();
  }

  // Переходим на главную, если мы не на ней
  // Восстанавливаем ВСЕ cookies (включая rcid, ASP.NET_SessionId) из своего файла
  await restoreAllKadCookies(page);

  // Переходим на главную, если мы не на ней
  const currentUrl = page.url();
  if (!currentUrl.includes('kad.arbitr.ru')) {
    await page.goto(KAD_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  // Проверяем авторизацию
  if (await isKadAuthorized(page)) {
    console.log('[kad] Сессия уже активна.');
    // Session-куки (rcid) теряются при storageState → нужен F5, чтобы Pravocaptcha переустановила rcid
    //await ensureRcid(page);
    // Обновляем сохранённые cookies (могли обновиться rcid, __ddg*)
    await saveAllKadCookies(page);
    return page;
  }

  // ❗ НЕ открываем модальное окно и НЕ кликаем по кнопке «Войти».
  // Просто просим пользователя войти вручную в открытом окне браузера.
  console.log('[kad] Пожалуйста, войдите вручную через кнопку «Войти» в открывшемся окне браузера.');
  console.log('[kad] После входа приложение автоматически определит сессию и продолжит работу.');

  // Ждём, пока пользователь авторизуется
  await waitForManualLogin(page, SESSION_SAVE_TIMEOUT_MS);
  
  // Сохраняем storageState
  try {
    await page.context().storageState({ path: getStorageStatePath('kad') });
    console.log('[kad] Сессия сохранена.');
  } catch (e) {
    console.warn('[kad] Не удалось сохранить storageState:', e);
  }

  // После ручного логина rcid может отсутствовать — принудительно получаем
  //await ensureRcid(page);

  // Сохраняем ВСЕ cookies, включая session — при следующем запуске восстановим
  await saveAllKadCookies(page);

  return page;
}

/**
 * Проверяет, авторизованы ли мы.
 * Признак — в шапке есть имя пользователя (`.js-arbitr-header-auth-name`).
 */
export async function isKadAuthorized(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('.js-arbitr-header-auth-name', { timeout: 5000 });
    const name = await page.locator('.js-arbitr-header-auth-name').first().textContent();
    return !!name && name.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Ждёт, пока пользователь залогинится. Поллинг каждые 2 секунды.
 */
async function waitForManualLogin(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (page.isClosed()) throw new Error('Окно браузера закрыто до завершения логина');
    if (await isKadAuthorized(page)) {
      console.log('[kad] Авторизация обнаружена.');
      return;
    }
    await page.waitForTimeout(2000);
  }
  throw new Error(
    'Таймаут ожидания ручного логина (10 минут). Попробуйте снова или проверьте, что вы вошли в kad.arbitr.'
  );
}

/**
 * Сброс сохранённой сессии (для UI-кнопки «Выйти из kad.arbitr»).
 */
export async function clearKadSession(): Promise<void> {
  const p = getStorageStatePath('kad');
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('[kad] Файл сессии удалён.');
  }
}

/**
 * Pravocaptcha выдаёт куку rcid только после F5.
 * При storageState она теряется (session cookie).
 * Делаем reload, если rcid ещё нет.
 */
async function ensureRcid(page: Page): Promise<void> {
  const hasRcid = async (): Promise<boolean> => {
    try {
      const cookies = await page.context().cookies('https://kad.arbitr.ru');
      return cookies.some((c) => c.name === 'rcid' && c.value.length > 0);
    } catch {
      return false;
    }
  };

  if (await hasRcid()) {
    console.log('[kad] rcid уже есть.');
    return;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[kad] rcid нет, перезагружаем страницу (попытка ${attempt}/3)...`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    if (await hasRcid()) {
      console.log('[kad] rcid получен.');
      return;
    }
  }
  console.warn('[kad] rcid так и не появился — возможен 403 на SearchInstances.');
}