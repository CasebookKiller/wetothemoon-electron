import { Page } from 'playwright';
import { getBrowser, getCredentials } from '../playwrightService';

export interface MosGorsudCase {
  caseNumber: string;
  court: string;
  judge: string;
  plaintiff: string;
  defendant: string;
  // ...
}

export async function scrapeMosGorsud(fio: string): Promise<MosGorsudCase[]> {
  const browser = getBrowser();
  if (!browser) throw new Error('Browser not launched');

  const page: Page = await browser.newPage();
  try {
    await page.goto('https://mos-gorsud.ru/');

    // Авторизация (если нужна)
    const creds = getCredentials('mosgorsud');
    if (creds) {
      await loginToMosGorsud(page, creds.login, creds.password);
      await page.goto('https://mos-gorsud.ru/');
    }

    // Переход в раздел поиска
    await page.click('a[href="/search"]'); // пример
    await page.fill('#fio', fio);
    await page.click('button[type="submit"]');

    await page.waitForSelector('.search-results', { timeout: 15000 });

    const cases = await page.$$eval('.case-item', (items) => {
      return items.map((item) => ({
        caseNumber: item.querySelector('.case-number')?.textContent?.trim() || '',
        court: item.querySelector('.court')?.textContent?.trim() || '',
        judge: item.querySelector('.judge')?.textContent?.trim() || '',
        plaintiff: item.querySelector('.plaintiff')?.textContent?.trim() || '',
        defendant: item.querySelector('.defendant')?.textContent?.trim() || '',
      }));
    });

    return cases;
  } catch (error) {
    console.error('MosGorsud scraping failed:', error);
    return [];
  } finally {
    await page.close();
  }
}

async function loginToMosGorsud(page: Page, login: string, password: string) {
  // Реализуйте вход
}