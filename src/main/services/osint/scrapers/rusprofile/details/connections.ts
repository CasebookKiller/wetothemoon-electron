// src/main/services/osint/scrapers/rusprofile/details/connections.ts
import { Page } from 'playwright';

export async function collectConnectionsDetails(page: Page, companyId: number): Promise<any> {
  console.log(`Сбор детальных связей для компании ID ${companyId}...`);
  const data: any = { total_organizations: '', connections: [] };

  const connectionsUrl = `https://www.rusprofile.ru/connections/${companyId}`;
  await page.goto(connectionsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  // === Переключение на табличный вид ===
  const tableButton = page.locator('span[data-show="table"]');
  if (await tableButton.count() > 0) {
    const container = page.locator('ul.similar-table-container');
    const isActive = await container.count() > 0 && await container.evaluate(el => el.classList.contains('active'));
    if (!isActive) {
      console.log('Переключаемся на табличный вид');
      try {
        await tableButton.first().click({ force: true });
      } catch (e) {
        console.warn('Обычный клик не удался, пробуем JavaScript-клик');
        await page.evaluate(() => {
          const btn = document.querySelector('span[data-show="table"]');
          if (btn instanceof HTMLElement) btn.click();
        });
      }
      await page.waitForSelector('ul.similar-table-container.active', { timeout: 15000 });
      await page.waitForTimeout(1000);
    } else {
      console.log('Табличный вид уже активен');
    }
  } else {
    console.warn('Кнопка переключения на таблицу не найдена');
  }

  // === Ожидаем появление элементов списка ===
  await page.waitForSelector(
    'ul.similar-table-container.active li.similar-item, ul.similar-table-container.active li.similar-item-empty',
    { timeout: 15000 }
  );
  await page.waitForTimeout(1000);

  // === Отладочная информация ===
  const debugCounts = await page.evaluate(() => ({
    similarItems: document.querySelectorAll('ul.similar-table-container.active li.similar-item').length,
    emptyItems: document.querySelectorAll('ul.similar-table-container.active li.similar-item-empty').length,
    subItems: document.querySelectorAll('ul.similar-table-container.active li.similar-item-sub-item').length,
    orgItems: document.querySelectorAll('ul.similar-table-container.active li.list-element').length,
    totalText: document.querySelector('.export-data__text span')?.textContent?.trim() || ''
  }));
  console.log('Отладка после ожидания:', debugCounts);

  // === Извлечение данных ===
  const parsed = await page.evaluate(() => {
    const getText = (el: Element | null, selector: string): string => {
      const node = el ? el.querySelector(selector) : null;
      return node ? node.textContent?.trim() || '' : '';
    };

    const cleanText = (text: string, prefix: string): string => {
      return text.startsWith(prefix) ? text.substring(prefix.length).trim() : text.trim();
    };

    const totalEl = document.querySelector('.export-data__text span');
    const totalText = totalEl ? totalEl.textContent?.trim() || '' : '';

    const connections: any[] = [];
    // Исправляем порядок: li.similar-item содержит ul.similar-item-sub, внутри li.similar-item-sub-item
    const similarItems = document.querySelectorAll('ul.similar-table-container.active li.similar-item');

    similarItems.forEach((similarItem) => {
      const subItems = similarItem.querySelectorAll(':scope > ul.similar-item-sub > li.similar-item-sub-item');
      subItems.forEach((subItem) => {
        const titleEl = subItem.querySelector('div.similar-item-sub-head a.title-sub, div.similar-item-sub-head span.title-sub');
        const title = titleEl ? titleEl.textContent?.trim() || '' : '';

        const descEl = subItem.querySelector('div.similar-item-sub-head span.description');
        const description = descEl ? descEl.textContent?.replace(/\s+/g, ' ').trim() : '';

        const organizations: any[] = [];
        const orgItems = subItem.querySelectorAll('div.similar-item-sub-content ul.list-element__row > li.list-element');

        orgItems.forEach((org) => {
          const nameEl = org.querySelector('a.list-element__title');
          const name = nameEl ? nameEl.textContent?.trim() || '' : '';
          const href = nameEl ? (nameEl as HTMLAnchorElement).href || '' : '';

          let status = '';
          const statusEl = org.querySelector('.liquidated.danger, .liquidating.warning, .reorganizing.warning');
          if (statusEl) status = statusEl.textContent?.trim() || '';

          const activity = getText(org, '.list-element__text');
          const address = getText(org, '.list-element__address');

          const infoSpans = org.querySelectorAll('.list-element__row-info span');
          let inn = '';
          let ogrn = '';
          let regDate = '';
          if (infoSpans.length >= 3) {
            inn = cleanText(infoSpans[0].textContent?.trim() || '', 'ИНН:');
            ogrn = cleanText(infoSpans[1].textContent?.trim() || '', 'ОГРН:');
            regDate = cleanText(infoSpans[2].textContent?.trim() || '', 'Дата регистрации:');
          }

          // Роли (информация в info-box)
          const roles: any[] = [];
          const infoBox = org.querySelector('.list-element__info-box');
          if (infoBox) {
            const infoItems = infoBox.querySelectorAll('.list-element__info-box-item');
            infoItems.forEach((item) => {
              const roleEl = item.querySelector('span');
              const participantEl = item.querySelector('mark');
              const periodEl = item.querySelector('.time');
              const role = roleEl ? roleEl.textContent?.trim() || '' : '';
              const participant = participantEl ? participantEl.textContent?.trim() || '' : '';
              const period = periodEl ? periodEl.textContent?.trim() || '' : '';
              if (role || participant) {
                roles.push({ role, participant, period });
              }
            });
          }

          if (name || inn) {
            organizations.push({
              name,
              href,
              status,
              activity,
              address,
              inn,
              ogrn,
              registration_date: regDate,
              roles,
            });
          }
        });

        if (title || organizations.length > 0) {
          connections.push({
            title,
            description,
            organizations,
          });
        }
      });
    });

    return {
      total_organizations: totalText,
      connections,
    };
  });

  data.total_organizations = parsed.total_organizations;
  data.connections = parsed.connections;

  console.log(`Собрано связей: ${data.connections.length}, организаций всего: ${data.total_organizations}`);
  return data;
}