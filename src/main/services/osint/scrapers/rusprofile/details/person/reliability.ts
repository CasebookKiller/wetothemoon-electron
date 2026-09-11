// src/main/services/osint/scrapers/rusprofile/details/person/reliability.ts
import { Page } from 'playwright';

export async function collectPersonReliabilityDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор факторов риска для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/reliability`;

  const data: any = {
    title: '',
    description: '',
    personal: [],
    related_companies: [],
  };

  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть /reliability:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница /reliability недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('.content-frame__title, .list-factors, .company__list', { timeout: 15000 });
  } catch {
    console.log('Структура страницы /reliability не найдена');
    return data;
  }
  await page.waitForTimeout(500);

  const parsed = await page.evaluate(() => {
    const result: any = {
      title: '',
      description: '',
      personal: [],
      related_companies: [],
    };

    // Заголовок и описание
    result.title = document.querySelector('.content-frame__title')?.textContent?.trim() || '';
    result.description = document.querySelector('.content-frame__description')?.textContent?.replace(/\s+/g, ' ').trim() || '';

    // === Персональные факторы ===
    const personalList = document.querySelector('ul.list-factors.columns');
    if (personalList) {
      personalList.querySelectorAll('li').forEach((li) => {
        // Текст фактора — во внутреннем div (без data-quetip)
        const textDiv = li.querySelector('div');
        const text = textDiv?.textContent?.trim() || '';
        if (!text) return;

        const icon = li.querySelector('i')?.getAttribute('data-ico') || '';
        const level = icon === 'danger' ? 'danger'
                    : icon === 'warning' ? 'warning'
                    : icon === 'success' ? 'success'
                    : 'info';

        result.personal.push({ text, level });
      });
    }

    // === Риски связанных организаций ===
    const companyList = document.querySelector('.company__list');
    if (companyList) {
      companyList.querySelectorAll('.company-item').forEach((item) => {
        const nameEl = item.querySelector('.company-item__title a');
        const name = nameEl?.textContent?.trim() || '';
        const href = (nameEl as HTMLAnchorElement | null)?.href || '';

        const status = item.querySelector('.company-item-status')?.textContent?.trim() || '';

        // Показатели: Надёжность, Негативные факты, Требуют внимания, Благоприятные, Роль
        const metrics: Record<string, string> = {};
        item.querySelectorAll('.company-item-info.row.alt dl').forEach((dl) => {
          const dt = dl.querySelector('dt')?.textContent?.trim() || '';
          if (!dt) return;

          if (dt === 'Надёжность') {
            const badge = dl.querySelector('.badge-status')?.textContent?.trim() || '';
            if (badge) metrics['Надёжность'] = badge;
          } else if (dt === 'Роль') {
            const dd = dl.querySelector('dd')?.textContent?.trim() || '';
            if (dd) metrics['Роль'] = dd;
          } else {
            // Числовые показатели (Негативные факты, Требуют внимания, Благоприятные)
            const num = dl.querySelector('dd.num span')?.textContent?.trim() || '';
            if (num) metrics[dt] = num;
          }
        });

        // Факторы риска (список под .company-item-info.alt)
        const factors: any[] = [];
        item.querySelectorAll('.company-item-info.alt .company-info__list li').forEach((li) => {
          const text = li.querySelector('div')?.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (!text) return;
          const icon = li.querySelector('i')?.getAttribute('data-ico') || '';
          const level = icon === 'danger' ? 'danger'
                      : icon === 'warning' ? 'warning'
                      : icon === 'success' ? 'success'
                      : 'info';
          factors.push({ text, level });
        });

        // Ссылка "Все факты (N)"
        const allFactsLink = item.querySelector('a.see-details');
        const allFactsText = allFactsLink?.textContent?.trim() || '';
        const allFactsHref = (allFactsLink as HTMLAnchorElement | null)?.href || '';

        if (name || href) {
          result.related_companies.push({
            name,
            href,
            status,
            metrics,
            factors,
            all_facts_text: allFactsText,
            all_facts_href: allFactsHref,
          });
        }
      });
    }

    return result;
  });

  data.title = parsed.title;
  data.description = parsed.description;
  data.personal = parsed.personal;
  data.related_companies = parsed.related_companies;

  console.log(`Собрано факторов риска (ФЛ): персональных ${data.personal.length}, связанных организаций ${data.related_companies.length}`);
  return data;
}