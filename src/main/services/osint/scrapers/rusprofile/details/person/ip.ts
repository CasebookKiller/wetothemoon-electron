// src/main/services/osint/scrapers/rusprofile/details/person/ip.ts
import { Page } from 'playwright';

export async function collectPersonIpDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор ИП для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}`;

  const data: any = { ip: null };

  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть карточку ФЛ для сбора ИП:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница ФЛ недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('.tiles', { timeout: 15000 });
  } catch {
    console.log('Структура карточки ФЛ не найдена');
    return data;
  }
  await page.waitForTimeout(500);

  const parsed = await page.evaluate(() => {
    const block = document.querySelector('.tiles__item[data-name="ip"]');
    if (!block) return { ip: null };

    const nameEl = block.querySelector('a.list-element__title');
    const name = nameEl?.textContent?.trim() || '';
    const href = (nameEl as HTMLAnchorElement | null)?.href || '';

    const activity = block.querySelector('.list-element__text')?.textContent?.trim() || '';
    const address = block.querySelector('.list-element__address')?.textContent?.trim() || '';

    let inn = '';
    let ogrnip = '';
    let regDate = '';
    const infoSpans = block.querySelectorAll('.list-element__row-info span');
    if (infoSpans.length >= 3) {
      inn = infoSpans[0].textContent?.replace('ИНН:', '').trim() || '';
      ogrnip = infoSpans[1].textContent?.replace('ОГРНИП:', '').trim() || '';
      regDate = infoSpans[2].textContent?.replace('Дата регистрации:', '').trim() || '';
    }

    if (!name && !inn) return { ip: null };

    return {
      ip: { name, href, activity, address, inn, ogrnip, registration_date: regDate },
    };
  });

  console.log(`Собрано ИП (ФЛ): ${parsed.ip ? 'да' : 'нет'}`);
  return parsed;
}