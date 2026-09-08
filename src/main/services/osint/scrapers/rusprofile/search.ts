// src/main/services/osint/scrapers/rusprofile/search.ts
import { Page } from 'playwright';

export async function getEntityIdByInn(page: Page, inn: string): Promise<{ id: number; type: 'company' | 'entrepreneur' | 'person' }> {
  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const searchInput = page.locator('input#autocomplete-main-search');
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  await searchInput.fill(inn);
  await searchInput.press('Enter');
  await page.waitForTimeout(3000);

  // Проверяем, перешли ли сразу на карточку (любого типа)
  const url = page.url();
  const match = url.match(/\/(id|ip|person)\/(\d+)/);
  if (match) {
    return { id: parseInt(match[2]), type: match[1] as any };
  }

  // Иначе кликаем первую подходящую ссылку
  const firstLink = page.locator("a[href*='/id/'], a[href*='/ip/'], a[href*='/person/']").first();
  await firstLink.click();
  await page.waitForTimeout(5000);
  const newUrl = page.url();
  const newMatch = newUrl.match(/\/(id|ip|person)\/(\d+)/);
  if (newMatch) {
    return { id: parseInt(newMatch[2]), type: newMatch[1] as any };
  }

  throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
}