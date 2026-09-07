// src/main/services/osint/scrapers/rusprofile/login.ts

import { Page } from 'playwright';
import { getStorageStatePath } from '../../playwrightService';
import { closeAllModals } from './helpers';

export async function login(page: Page, login: string, password: string): Promise<void> {
  console.log('Выполняем вход на rusprofile...');
  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Ждём появления кнопки "Войти" в шапке
  const loginTrigger = page.locator('#menu-personal-trigger');
  await loginTrigger.waitFor({ state: 'visible', timeout: 15000 });

  const triggerText = await loginTrigger.innerText().catch(() => '');
  if (!triggerText.includes('Войти')) {
    console.log('Уже авторизованы, вход не требуется');
    return;
  }

  await loginTrigger.click();
  console.log('Клик по кнопке Войти выполнен');

  // Ожидание поля email
  const emailField = page.locator('input[name="email"]');
  try {
    await emailField.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Поле email найдено');
  } catch (e) {
    console.error('Поле email не появилось после клика. Пробуем альтернативный клик по тексту "Войти"');
    const textLogin = page.getByText('Войти', { exact: true }).first();
    if (await textLogin.count() > 0) {
      await textLogin.click();
      await page.waitForTimeout(2000);
    }
    await emailField.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Поле email найдено (после альтернативного клика)');
  }

  // Заполняем email
  await emailField.fill(login);
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.waitForTimeout(2000);

  // Ждём поле пароля
  const passwordField = page.locator('input[name="current-password"]');
  await passwordField.waitFor({ state: 'visible', timeout: 10000 });
  await passwordField.fill(password);

  // Нажимаем кнопку "Войти" в форме
  await page.getByRole('button', { name: 'Войти' }).click();
  console.log('Кнопка Войти в форме нажата');
  await page.waitForTimeout(8000);

  // Закрываем модальные окна
  await closeAllModals(page);

  // Проверяем, что вход успешен
  const loginTriggerAfter = page.locator('#menu-personal-trigger');
  await loginTriggerAfter.waitFor({ state: 'visible', timeout: 10000 });
  const textAfter = await loginTriggerAfter.innerText().catch(() => '');
  if (textAfter.includes('Войти')) {
    console.warn('Вход возможно не выполнен, кнопка всё ещё "Войти"');
  } else {
    console.log('Вход выполнен, кнопка теперь:', textAfter);
    // Сохраняем сессию после успешного входа
    try {
      await page.context().storageState({ path: getStorageStatePath('rusprofile') });
      console.log('Сессия сохранена.');
    } catch (e) {
      console.warn('Не удалось сохранить сессию:', e);
    }
  }
}