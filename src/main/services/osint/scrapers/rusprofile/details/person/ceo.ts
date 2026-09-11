// src/main/services/osint/scrapers/rusprofile/details/person/ceo.ts
import { Page } from 'playwright';

export async function collectPersonCeoDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор руководителя для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/ceo`;

  const data: any = {
    current: [],
    past: [],
  };

  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть /ceo:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница /ceo недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('.content-frame__title, .company__list, .list-element', { timeout: 15000 });
  } catch {
    console.log('Структура страницы /ceo не найдена');
    return data;
  }
  await page.waitForTimeout(500);

  const parsed = await page.evaluate(() => {
    const result: any = { current: [], past: [] };

    /**
     * Парсит один `.list-element` в объект с полями организации.
     */
    const parseListItem = (el: Element) => {
      const nameEl = el.querySelector('a.list-element__title');
      const name = nameEl?.textContent?.trim() || '';
      const href = (nameEl as HTMLAnchorElement | null)?.href || '';

      // Статус: "Организация ликвидирована" и т.п.
      let status = '';
      const statusEl = el.querySelector('.warning-text');
      if (statusEl) status = statusEl.textContent?.trim() || '';

      // Роль и период (второй .list-element__text обычно содержит "ФИО — должность с ... по ...")
      const textEls = el.querySelectorAll('.list-element__text');
      const activity = textEls[0]?.textContent?.trim() || '';
      const roleText = textEls[1]?.textContent?.trim() || '';

      // Извлекаем должность и период из roleText
      let position = '';
      let period = '';
      // Формат: "Иванова Ольга Александровна — генеральный директор с 05.03.2023 по 21.03.2024"
      // или:    "Иванова Ольга Александровна — генеральный директор"
      const warningEl = textEls[1]?.querySelector('.warning');
      if (warningEl) {
        period = warningEl.textContent?.trim() || '';
      }
      // Должность — часть после "—"
      const dashIndex = roleText.indexOf('—');
      if (dashIndex >= 0) {
        let posText = roleText.substring(dashIndex + 1).trim();
        // Убираем период, если он есть в posText
        if (period && posText.endsWith(period)) {
          posText = posText.substring(0, posText.length - period.length).trim();
        }
        position = posText;
      }

      const address = el.querySelector('.list-element__address')?.textContent?.trim() || '';

      // ИНН, ОГРН, дата регистрации
      let inn = '';
      let ogrn = '';
      let regDate = '';
      const infoSpans = el.querySelectorAll('.list-element__row-info span');
      if (infoSpans.length >= 3) {
        inn = infoSpans[0].textContent?.replace('ИНН:', '').trim() || '';
        ogrn = infoSpans[1].textContent?.replace('ОГРН:', '').trim() || '';
        regDate = infoSpans[2].textContent?.replace('Дата регистрации:', '').trim() || '';
      }

      // Финансовые показатели из info-box (надёжность, капитал, выручка, прибыль, арбитраж, долги)
      const financials: Record<string, string> = {};
      el.querySelectorAll('.list-element__info-box dl').forEach((dl) => {
        const dt = dl.querySelector('dt')?.textContent?.trim() || '';
        if (!dt) return;
        if (dt === 'Надёжность') {
          const badge = dl.querySelector('.badge-status')?.textContent?.trim() || '';
          if (badge) financials[dt] = badge;
        } else {
          const dd = dl.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (dd) financials[dt] = dd;
        }
      });

      return {
        name,
        href,
        status,
        activity,
        position,
        period,
        address,
        inn,
        ogrn,
        registration_date: regDate,
        financials,
      };
    };

    // Определяем блоки «Руководитель в настоящее время» и «Руководитель в прошлом»
    // Они разделены подзаголовками .tile-item__subtitle внутри .company__list
    const container = document.querySelector('.company__list');
    if (!container) return result;

    const children = Array.from(container.children);
    let currentSection: 'current' | 'past' | null = null;

    for (const child of children) {
      const el = child as HTMLElement;

      // Заголовок секции
      if (el.classList.contains('tile-item__subtitle')) {
        const text = el.textContent?.trim() || '';
        if (text.includes('в настоящее время')) currentSection = 'current';
        else if (text.includes('в прошлом')) currentSection = 'past';
        continue;
      }

      // Список организаций
      if (el.classList.contains('list-element__row') && currentSection) {
        el.querySelectorAll('.list-element').forEach((item) => {
          const parsed = parseListItem(item);
          if (parsed.name || parsed.inn) {
            result[currentSection!].push(parsed);
          }
        });
      }
    }

    return result;
  });

  data.current = parsed.current;
  data.past = parsed.past;

  console.log(`Собрано руководителя (ФЛ): текущих ${data.current.length}, прошлых ${data.past.length}`);
  return data;
}