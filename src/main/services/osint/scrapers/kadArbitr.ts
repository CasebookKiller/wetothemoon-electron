import { Page } from 'playwright';
import { getBrowser, getCredentials } from '../playwrightService';

export interface CourtCase {
  caseNumber: string;
  court: string;
  judge: string;
  plaintiff: string;
  defendant: string;
  date: string;
  // ...
}

export async function scrapeKadArbitr(inn: string): Promise<CourtCase[]> {
  const browser = getBrowser();
  if (!browser) throw new Error('Browser not launched');

  const page: Page = await browser.newPage();
  try {
    await page.goto('https://kad.arbitr.ru/');

    // Авторизация (если требуется)
    const creds = getCredentials('kad');
    if (creds) {
      await loginToKadArbitr(page, creds.login, creds.password);
      // после входа снова переходим на главную
      await page.goto('https://kad.arbitr.ru/');
    }

    // Ввод ИНН в поле поиска участника
    await page.fill('#participant', inn);
    await page.click('button[type="submit"]');

    // Ожидание результатов
    await page.waitForSelector('.b-results', { timeout: 15000 });

    // Извлечение списка дел
    const cases = await page.$$eval('.case-item', (items) => {
      return items.map((item) => ({
        caseNumber: item.querySelector('.case-number')?.textContent?.trim() || '',
        court: item.querySelector('.court')?.textContent?.trim() || '',
        judge: item.querySelector('.judge')?.textContent?.trim() || '',
        plaintiff: item.querySelector('.plaintiff')?.textContent?.trim() || '',
        defendant: item.querySelector('.defendant')?.textContent?.trim() || '',
        date: item.querySelector('.date')?.textContent?.trim() || '',
      }));
    });

    return cases;
  } catch (error) {
    console.error('KadArbitr scraping failed:', error);
    return [];
  } finally {
    await page.close();
  }
}

async function loginToKadArbitr(page: Page, login: string, password: string) {
  // Реализуйте вход (примерные селекторы)
  await page.goto('https://kad.arbitr.ru/login');
  await page.fill('#login', login);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
}