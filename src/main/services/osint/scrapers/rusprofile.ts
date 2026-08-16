import { Page } from 'playwright';
import { getBrowser, getCredentials } from '../playwrightService';

export interface CompanyInfo {
  name: string;
  inn: string;
  ogrn: string;
  address: string;
  director: string;
  // ... добавьте поля по необходимости
}

export async function scrapeRusprofile(inn: string): Promise<CompanyInfo | null> {
  const browser = getBrowser();
  if (!browser) throw new Error('Browser not launched');

  const page: Page = await browser.newPage();
  try {
    // Переход на страницу поиска
    await page.goto(`https://www.rusprofile.ru/search?query=${inn}`, { waitUntil: 'domcontentloaded' });

    // Если требуется авторизация — выполняем
    const creds = getCredentials('rusprofile');
    if (creds) {
      await loginToRusprofile(page, creds.login, creds.password);
      // После входа повторно перейти на поиск
      await page.goto(`https://www.rusprofile.ru/search?query=${inn}`, { waitUntil: 'domcontentloaded' });
    }

    // Клик по первой ссылке результата (пример селектора, уточните)
    await page.click('.company-item a');
    await page.waitForSelector('.company-card', { timeout: 10000 });

    // Извлечение данных
    const data = await page.evaluate(() => {
      const name = document.querySelector('.company-name')?.textContent?.trim();
      const inn = document.querySelector('.company-info__item:has(.label:contains("ИНН")) .value')?.textContent?.trim();
      // ... аналогично для других полей
      return {
        name: name || '',
        inn: inn || '',
        ogrn: '',
        address: '',
        director: '',
      };
    });

    return data;
  } catch (error) {
    console.error('Rusprofile scraping failed:', error);
    return null;
  } finally {
    await page.close();
  }
}

async function loginToRusprofile(page: Page, login: string, password: string): Promise<void> {
  await page.goto('https://www.rusprofile.ru/login');
  await page.fill('#login', login);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
}