// src/main/services/osint/scrapers/rusprofile/details/person/connections.ts
import { Page } from 'playwright';

export async function collectPersonConnectionsDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор связей для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/connections`;

  const data: any = {
    total_organizations: '',
    connections: [],
  };

  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть /connections:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница /connections недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('.filters-results, .content-frame, .tiles', { timeout: 15000 });
  } catch {
    console.log('Структура страницы /connections не найдена');
    return data;
  }
  await page.waitForTimeout(1000);

  const parsed = await page.evaluate(() => {
    const result: any = { total_organizations: '', connections: [] };

    // Общее количество
    const totalEl = document.querySelector('.export-data__text span');
    if (totalEl) result.total_organizations = totalEl.textContent?.trim() || '';

    // Собираем секции
    const sections = document.querySelectorAll('.similar-item');
    sections.forEach((section) => {
      const titleEl = section.querySelector('.title-sub, .similar-item-sub-head .title-sub');
      const title = titleEl?.textContent?.trim() || '';

      const descriptionEl = section.querySelector('.description');
      const description = descriptionEl?.textContent?.replace(/\s+/g, ' ').trim() || '';

      const organizations: any[] = [];
      section.querySelectorAll('.list-element').forEach((org) => {
        const nameEl = org.querySelector('a.list-element__title');
        const name = nameEl?.textContent?.trim() || '';
        const href = (nameEl as HTMLAnchorElement | null)?.href || '';

        let status = '';
        const statusEl = org.querySelector('.warning-text, .liquidated.danger, .reorganizing.warning');
        if (statusEl) status = statusEl.textContent?.trim() || '';

        const activity = org.querySelector('.list-element__text')?.textContent?.trim() || '';
        const address = org.querySelector('.list-element__address')?.textContent?.trim() || '';

        let inn = '';
        let ogrn = '';
        let regDate = '';
        const infoSpans = org.querySelectorAll('.list-element__row-info span');
        if (infoSpans.length >= 3) {
          inn = infoSpans[0].textContent?.replace('ИНН:', '').trim() || '';
          ogrn = infoSpans[1].textContent?.replace('ОГРН:', '').trim() || '';
          regDate = infoSpans[2].textContent?.replace('Дата регистрации:', '').trim() || '';
        }

        const roles: any[] = [];
        org.querySelectorAll('.list-element__info-box-item').forEach((item) => {
          const roleEl = item.querySelector('span');
          const participantEl = item.querySelector('mark');
          const periodEl = item.querySelector('.time');
          const role = roleEl?.textContent?.trim() || '';
          const participant = participantEl?.textContent?.trim() || '';
          const period = periodEl?.textContent?.trim() || '';
          if (role || participant) roles.push({ role, participant, period });
        });

        if (name || inn) {
          organizations.push({ name, href, status, activity, address, inn, ogrn, registration_date: regDate, roles });
        }
      });

      if (title || organizations.length > 0) {
        result.connections.push({ title, description, organizations });
      }
    });

    return result;
  });

  console.log(`Собрано связей (ФЛ): ${parsed.connections.length}, всего: ${parsed.total_organizations}`);
  return parsed;
}