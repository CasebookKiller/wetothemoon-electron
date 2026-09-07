// src/main/services/osint/scrapers/rusprofile/helpers.ts

import { Page } from 'playwright';

export async function closeModalIfPresent(page: Page): Promise<void> {
  const closeButton = page.locator('button.modal-close.modal-company-description__close');
  try {
    await closeButton.waitFor({ state: 'visible', timeout: 15000 });
    await closeButton.click({ force: true });
    console.log('Модальное окно закрыто');
  } catch (e) {
    console.log('Модальное окно не появилось или уже закрыто');
  }
}

export async function closeAllModals(page: Page): Promise<void> {
  if (page.isClosed()) return;
  await closeModalIfPresent(page);

  const selectors = [
    "button:has-text('Продолжить работу')",
    "a:has-text('Продолжить работу')",
    "button:has-text('Понятно')",
    "a:has-text('Понятно')",
  ];

  for (const selector of selectors) {
    const elements = page.locator(selector);
    if (await elements.count() > 0) {
      try {
        await elements.first().click({ timeout: 3000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`Не удалось закрыть модальное окно с селектором ${selector}:`, e);
      }
    }
  }
}

export async function waitAndCloseModal(page: Page, maxAttempts = 8, delayMs = 2000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const closeButton = page.locator('button.modal-close.modal-company-description__close');
    if (await closeButton.count() > 0) {
      try {
        await closeButton.click({ force: true });
        console.log(`Модальное окно закрыто (попытка ${i + 1})`);
        return;
      } catch (e) {
        console.log(`Не удалось закрыть модальное окно на попытке ${i + 1}:`, e);
      }
    }
    await page.waitForTimeout(delayMs);
  }
  console.log('Модальное окно не появилось или не закрылось за отведённое время');
}

export function startModalWatcher(page: Page): void {
  (async () => {
    while (true) {
      const closeButton = page.locator('button.modal-close.modal-company-description__close');
      try {
        await closeButton.waitFor({ state: 'visible', timeout: 30000 });
        await closeButton.click({ force: true });
        console.log('Модальное окно закрыто фоновым наблюдателем');
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('Модальное окно не появилось в течение 30 секунд, наблюдатель завершён');
        break;
      }
    }
  })();
}