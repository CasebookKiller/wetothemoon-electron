// src/main/services/osint/scrapers/rusprofile/details/egrul.ts
import { Page } from 'playwright';

export async function collectEgrulDetails(
  page: Page,
  companyId: number | string,
  options: { maxTotalCases?: number; entityType?: string; ogrn?: string } = {}
): Promise<any> {
  const entityType = options.entityType || 'company';
  console.log(`Сбор выписки ЕГРЮЛ/ЕГРИП для ID ${companyId}, тип: ${entityType}`);
  const data: any = { basic_info: {}, sections: [] };

  if (entityType === 'person') {
    console.log('Для физических лиц выписка ЕГРЮЛ/ЕГРИП не предусмотрена.');
    return data;
  }

  const isEntrepreneur = entityType === 'entrepreneur' || entityType === 'ip';
  console.log(`DEBUG egrul: isEntrepreneur = ${isEntrepreneur}`);

  // === ОГРН/ОГРНИП: берём из опций, если передан, иначе — с карточки ===
  let ogrn = options.ogrn || '';

  if (!ogrn) {
    const cardUrlPath = isEntrepreneur ? 'ip' : 'id';
    const ogrnSelector = isEntrepreneur ? '#clip_ogrnip' : '#clip_ogrn';

    console.log(`DEBUG egrul: cardUrl = https://www.rusprofile.ru/${cardUrlPath}/${companyId}`);

    await page.goto(`https://www.rusprofile.ru/${cardUrlPath}/${companyId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    try {
      await page.waitForSelector(ogrnSelector, { timeout: 15000 });
    } catch {
      console.warn('Не удалось найти ОГРН/ОГРНИП на карточке, выписка пропущена');
      return data;
    }

    ogrn = await page.locator(ogrnSelector).first().innerText().catch(() => '');
    if (!ogrn) {
      console.warn('Пустой ОГРН/ОГРНИП, выписка пропущена');
      return data;
    }
  } else {
    console.log(`DEBUG egrul: ОГРН/ОГРНИП получен из опций: ${ogrn}`);
  }

  // === Формируем URL выписки ===
  const extractUrl = isEntrepreneur
    ? `https://www.rusprofile.ru/egrip?ogrnip=${ogrn}`
    : `https://www.rusprofile.ru/egrul?ogrn=${ogrn}`;

  console.log(`DEBUG egrul: переход на ${extractUrl}`);

  let response: any = null;
  try {
    response = await page.goto(extractUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть страницу выписки:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница выписки недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('.tiles-content, .tiles', { timeout: 15000 });
  } catch {
    console.log('Контейнер выписки не найден');
    return data;
  }
  await page.waitForTimeout(500);

  // === Извлекаем данные ===
  const parsed = await page.evaluate(() => {
    const result: any = { basic_info: {}, sections: [] };

    const headerTile = document.querySelector('.tile-item.button-tile');
    if (headerTile) {
      const desc = headerTile.querySelector('.statement-description')?.textContent?.trim() || '';
      const name = headerTile.querySelector('.statement-name')?.textContent?.trim() || '';
      const headerRows: any = {};
      headerTile.querySelectorAll('table.info-table tbody tr').forEach((tr) => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 3) {
          const label = cells[1]?.textContent?.trim() || '';
          const value = cells[2]?.textContent?.trim() || '';
          if (label) headerRows[label] = value;
        }
      });
      result.basic_info = { description: desc, name, ...headerRows };
    }

    const tiles = document.querySelectorAll('.tiles-content .tile-item.striped-table');
    tiles.forEach((tile) => {
      if (tile.classList.contains('button-tile')) return;

      const title = tile.querySelector('.tile-item__title')?.textContent?.trim() || '';
      if (!title) return;

      const items: any[] = [];
      const children = Array.from(tile.children);
      for (const child of children) {
        const el = child as HTMLElement;

        if (el.classList.contains('tile-item__info')) {
          items.push({ type: 'info', text: el.textContent?.trim() || '' });
          continue;
        }
        if (el.classList.contains('table-title')) {
          items.push({ type: 'subtitle', text: el.textContent?.trim() || '' });
          continue;
        }
        if (el.classList.contains('add-statement-num')) {
          items.push({ type: 'number', text: el.textContent?.trim() || '' });
          continue;
        }
        if (el.tagName === 'TABLE' && el.classList.contains('info-table')) {
          el.querySelectorAll('tbody tr').forEach((tr) => {
            const cells = tr.querySelectorAll('td');
            if (cells.length < 2) return;
            const num = cells[0]?.textContent?.trim() || '';
            const label = cells[1]?.textContent?.trim() || '';
            const value = cells[2]?.textContent?.trim() || '';
            if (!num && !label && !value) return;
            items.push({ number: num, label, value });
          });
        }
      }

      if (items.length > 0) {
        result.sections.push({ title, items });
      }
    });

    return result;
  });

  data.basic_info = parsed.basic_info;
  data.sections = parsed.sections;

  console.log(`Собрано секций выписки: ${data.sections.length}`);
  return data;
}