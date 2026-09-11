// src/main/services/osint/scrapers/rusprofile/details/sanctions.ts
import { Page } from 'playwright';

// Основная функция сбора для санкций (детальный список)
export async function collectSanctionsDetails(
  page: Page,
  companyId: number | string,
  options: { maxTotalCases?: number } = {}
): Promise<any> {
  console.log(`Сбор санкций для компании ID ${companyId}...`);
  const data: any = { title: '', risk_groups: [], related_organizations: [] };

  const url = `https://www.rusprofile.ru/sanctions/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.facts', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // === Раскрываем все аккордеоны ===
  const headers = page.locator('.accordion__header');
  const headerCount = await headers.count();
  for (let i = 0; i < headerCount; i++) {
    try {
      await headers.nth(i).click({ force: true });
      await page.waitForTimeout(300);
    } catch (e) {
      console.warn(`Не удалось раскрыть аккордеон #${i}:`, e);
    }
  }
  await page.waitForTimeout(500); // ждём полного раскрытия

  // === Извлекаем данные ===
  const result = await page.evaluate(() => {
    // Заголовок (например, "Санкционные риски: есть")
    const factsTitle = document.querySelector('.facts__title');
    const title = factsTitle ? factsTitle.textContent?.trim() || '' : '';

    // Группа рисков (аккордеоны внутри .facts__item)
    const risk_groups: any[] = [];
    const factItems = document.querySelectorAll('.facts__item');
    factItems.forEach((factItem) => {
      const groupTitleEl = factItem.querySelector('.facts__title');
      const groupTitle = groupTitleEl ? groupTitleEl.textContent?.trim() || '' : '';

      const accordions = factItem.querySelectorAll('.accordion__item');
      accordions.forEach((acc) => {
        const header = acc.querySelector('.accordion__header');
        const titleEl = acc.querySelector('.accordion__title');
        const bodyEl = acc.querySelector('.accordion__body');
        const type = acc.getAttribute('type') || '';

        const headerText = titleEl ? titleEl.textContent?.trim() || '' : '';
        const bodyText = bodyEl ? bodyEl.textContent?.trim() || '' : '';

        // Извлекаем отдельные элементы (например, список стран)
        const countries: string[] = [];
        bodyEl?.querySelectorAll('.content-frame__description.list-type').forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text) countries.push(text);
        });

        risk_groups.push({
          group_title: groupTitle,
          header: headerText,
          body: bodyText,
          countries,
          type,
        });
      });
    });

    // Связанные организации
    const related: any[] = [];
    const orgItems = document.querySelectorAll('.sanctions-page__list .list-element');
    orgItems.forEach((org) => {
      const nameEl = org.querySelector('a.list-element__title');
      const name = nameEl ? nameEl.textContent?.trim() || '' : '';
      const href = nameEl ? (nameEl as HTMLAnchorElement).href || '' : '';

      // Статус (например, "Организация в процессе реорганизации")
      let status = '';
      const statusEl = org.querySelector('.attention-text, .warning-text');
      if (statusEl) status = statusEl.textContent?.trim() || '';

      // Учредитель
      let founder = '';
      const founderEl = org.querySelector('.list-element__info-box-item span');
      if (founderEl && founderEl.textContent?.includes('Учредитель')) {
        const mark = founderEl.parentElement?.querySelector('mark');
        founder = mark ? mark.textContent?.trim() || '' : '';
      }

      // Риски
      let risks = '';
      const riskItems = org.querySelectorAll('.list-element__info-box-item');
      riskItems.forEach(item => {
        const label = item.querySelector('span')?.textContent?.trim() || '';
        if (label === 'Риски:') {
          const riskSpan = item.querySelectorAll('span')[1];
          risks = riskSpan ? riskSpan.textContent?.trim() || '' : '';
        }
      });

      // Вид деятельности (первый .list-element__text)
      const activity = org.querySelector('.list-element__text')?.textContent?.trim() || '';
      // Руководитель (второй .list-element__text, если есть)
      const textEls = org.querySelectorAll('.list-element__text');
      const director = textEls.length > 1 ? textEls[1].textContent?.trim() || '' : '';

      const address = org.querySelector('.list-element__address')?.textContent?.trim() || '';

      const infoSpans = org.querySelectorAll('.list-element__row-info span');
      let inn = '';
      let ogrn = '';
      let regDate = '';
      if (infoSpans.length >= 3) {
        inn = infoSpans[0].textContent?.replace('ИНН:', '').trim() || '';
        ogrn = infoSpans[1].textContent?.replace('ОГРН:', '').trim() || '';
        regDate = infoSpans[2].textContent?.replace('Дата регистрации:', '').trim() || '';
      }

      related.push({ name, href, status, founder, risks, activity, director, address, inn, ogrn, registration_date: regDate });
    });

    return { title, risk_groups, related };
  });

  data.title = result.title;
  data.risk_groups = result.risk_groups;
  data.related_organizations = result.related;

  console.log(`Собрано групп рисков: ${data.risk_groups.length}, связанных организаций: ${data.related_organizations.length}`);
  return data;
}