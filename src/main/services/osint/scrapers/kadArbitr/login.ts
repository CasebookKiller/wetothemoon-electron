// src/main/services/osint/scrapers/kadArbitr/login.ts

import { Page } from 'playwright';
import {
  getBrowser,
  getPage,
  getStorageStatePath,
  launchBrowserWithSession,
} from '../../playwrightService';
import fs from 'fs';

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
  const currentUrl = page.url();
  if (!currentUrl.includes('kad.arbitr.ru')) {
    await page.goto(KAD_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  // Проверяем авторизацию
  if (await isKadAuthorized(page)) {
    console.log('[kad] Сессия уже активна.');
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