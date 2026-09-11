// src/main/services/osint/scrapers/rusprofile/details/connections.ts
import { Page } from 'playwright';

export async function collectConnectionsDetails(page: Page, companyId: number | string): Promise<any> {
  console.log(`Сбор детальных связей для компании ID ${companyId}...`);
  const data: any = { total_organizations: '', connections: [] };

  const connectionsUrl = `https://www.rusprofile.ru/connections/${companyId}`;
  await page.goto(connectionsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000); // увеличенная пауза для полной загрузки

  // === Всегда кликаем по кнопке "Скрыть схему" (data-show="table") ===
  const tableButton = page.locator('span[data-show="table"]');
  if (await tableButton.count() > 0) {
    console.log('Кликаем по кнопке «Скрыть схему» для отображения списка');
    try {
      await tableButton.first().click({ force: true });
    } catch (e) {
      console.warn('Обычный клик не удался, пробуем JavaScript-клик');
      await page.evaluate(() => {
        const btn = document.querySelector('span[data-show="table"]');
        if (btn instanceof HTMLElement) btn.click();
      });
    }
    await page.waitForTimeout(2000);
  } else {
    console.warn('Кнопка переключения на таблицу не найдена');
  }

  // === Ждём появления элементов списка (li.similar-item) в DOM ===
  await page.waitForFunction(() => {
    const container = document.querySelector('ul.similar-table-container.active');
    if (!container) return false;
    const items = container.querySelectorAll('li.similar-item');
    return items.length > 0;
  }, { timeout: 15000 }).catch(() => {
    console.log('Элементы связей не появились, продолжаем с пустым результатом');
  });

  // === Раскрываем все кнопки «Показать ещё» ===
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    const buttons = page.locator('ul.similar-table-container.active .similar-more-btn:not(.hidden)');
    const count = await buttons.count();
    if (count === 0) break;

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      try {
        if (await btn.isVisible()) {
          await btn.click();
          console.log(`Нажата кнопка «Показать ещё» (попытка ${attempts + 1}, кнопка ${i + 1})`);
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.warn('Не удалось нажать «Показать ещё»:', e);
      }
    }
    attempts++;
  }

  // === Извлечение данных ===
  const parsed = await page.evaluate(() => {
    const getText = (el: Element | null, selector: string): string => {
      const node = el ? el.querySelector(selector) : null;
      return node ? node.textContent?.trim() || '' : '';
    };

    const cleanText = (text: string, prefix: string): string => {
      return text.startsWith(prefix) ? text.substring(prefix.length).trim() : text.trim();
    };

    const container = document.querySelector('ul.similar-table-container.active');
    if (!container) return { total_organizations: '', connections: [] };

    // Если есть только сообщение об отсутствии связей
    if (container.querySelectorAll('li.similar-item').length === 0 && container.querySelector('li.similar-item-empty')) {
      return { total_organizations: '', connections: [] };
    }

    const totalEl = document.querySelector('.export-data__text span');
    const totalText = totalEl ? totalEl.textContent?.trim() || '' : '';

    const connections: any[] = [];
    const similarItems = container.querySelectorAll('li.similar-item');

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