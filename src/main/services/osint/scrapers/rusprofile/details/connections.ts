// src/main/services/osint/scrapers/rusprofile/details/connections.ts
import { Page } from 'playwright';

// Основная функция сбора связей (детальный список)
export async function collectConnectionsDetails(page: Page, companyId: number): Promise<any> {
  console.log(`Сбор детальных связей для компании ID ${companyId}...`);
  const data: any = { total_organizations: '', connections: [] };

  const connectionsUrl = `https://www.rusprofile.ru/connections/${companyId}`;
  await page.goto(connectionsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000); // даём время на инициализацию

  // --- Переключение на табличный вид ---
  const tableButton = page.locator('span[data-show="table"]');
  if (await tableButton.count() > 0) {
    const container = page.locator('ul.similar-table-container');
    let isActive = await container.count() > 0 && await container.evaluate(el => el.classList.contains('active'));
    if (!isActive) {
      console.log('Переключаемся на табличный вид');
      try {
        // Принудительный клик (может быть перекрыт)
        await tableButton.first().click({ force: true });
      } catch (e) {
        console.warn('Обычный клик не удался, пробуем JavaScript-клик');
        await page.evaluate(() => {
          const btn = document.querySelector('span[data-show="table"]');
          if (btn instanceof HTMLElement) btn.click();
        });
      }
      // Ждём, пока контейнер списка станет активным
      await page.waitForSelector('ul.similar-table-container.active', { timeout: 15000 });
      await page.waitForTimeout(1000);
    } else {
      console.log('Табличный вид уже активен');
    }
  } else {
    console.warn('Кнопка переключения на таблицу не найдена');
  }

  // --- Раскрываем все кнопки «Показать ещё» ---
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    const buttons = page.locator('.btn.similar-more-btn:not(.hidden)');
    const count = await buttons.count();
    if (count === 0) break;

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      try {
        if (await btn.isVisible()) {
          await btn.click();
          console.log(`Нажата кнопка «Показать ещё» (попытка ${attempts + 1}, кнопка ${i + 1})`);
          await page.waitForTimeout(800);
        }
      } catch (e) {
        console.warn('Не удалось нажать «Показать ещё»:', e);
      }
    }
    attempts++;
    await page.waitForTimeout(500);
  }

  // --- Отладочная информация о количестве элементов ---
  const debugCounts = await page.evaluate(() => ({
    similarItems: document.querySelectorAll('li.similar-item').length,
    subItems: document.querySelectorAll('li.similar-item-sub-item').length,
    orgItems: document.querySelectorAll('ul.list-element__row > li.list-element').length,
    totalText: document.querySelector('.export-data__text span')?.textContent?.trim() || ''
  }));
  console.log('Отладка после раскрытия:', debugCounts);

  // --- Извлечение данных ---
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
    const similarItems = document.querySelectorAll('li.similar-item');

    similarItems.forEach((similarItem) => {
      const subItems = similarItem.querySelectorAll('li.similar-item-sub-item');
      subItems.forEach((subItem) => {
        const titleEl = subItem.querySelector('a.title-sub, span.title-sub');
        const title = titleEl ? titleEl.textContent?.trim() || '' : '';

        const descEl = subItem.querySelector('span.description');
        const description = descEl ? descEl.textContent?.replace(/\s+/g, ' ').trim() : '';

        const organizations: any[] = [];
        const orgItems = subItem.querySelectorAll('ul.list-element__row > li.list-element');

        orgItems.forEach((org) => {
          const nameEl = org.querySelector('a.list-element__title');
          const name = nameEl ? nameEl.textContent?.trim() || '' : '';

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

