// src/main/services/osint/scrapers/rusprofile/details/person/ip.ts
import { Page } from 'playwright';
import { collectSummary } from '../../collectSummary';
import { collectConnections } from '../../collectTiles';
import { collectConnectionsDetails } from '../connections';
import { collectHistoryDetails } from '../history';
import { collectOkvedDetails } from '../okved';

export async function collectPersonIpDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор ИП для ФЛ ${slug}...`);

  // 1. Открываем карточку ФЛ и ищем ссылку на ИП
  const personUrl = `https://www.rusprofile.ru/person/${slug}`;
  await page.goto(personUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1000);

  const ipLink = await page.evaluate(() => {
    const link = document.querySelector('.tiles__item[data-name="ip"] a.list-element__title') as HTMLAnchorElement | null;
    return link ? link.href : '';
  });

  if (!ipLink) {
    console.log('Ссылка на ИП не найдена');
    return { ip: null };
  }

  console.log(`DEBUG person/ip: переход на страницу ИП ${ipLink}`);
  await page.goto(ipLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  const ipIdMatch = ipLink.match(/\/ip\/(\d+)/);
  const ipId = ipIdMatch ? parseInt(ipIdMatch[1]) : 0;

  // 2. Собираем доступные для ИП разделы
  const data: any = {
    ip_id: ipId,
    ip_url: ipLink,
    summary: await collectSummary(page),
    connections: await collectConnections(page),
  };

  // 3. Детальные разделы (только те, что применимы для ИП)
  try {
    data.connections_details = await collectConnectionsDetails(page, ipId);
  } catch (e) {
    console.warn('Не удалось собрать детальные связи ИП:', e);
  }

  try {
    data.history_details = await collectHistoryDetails(page, ipId, { maxPages: 1, maxTotalCases: 100 });
  } catch (e) {
    console.warn('Не удалось собрать историю ИП:', e);
  }

  // Учредители у ИП не собираются — пропускаем

  try {
    data.okved_details = await collectOkvedDetails(page, ipId);
  } catch (e) {
    console.warn('Не удалось собрать ОКВЭД ИП:', e);
  }

  console.log(`Собрано ИП (ФЛ): ID ${ipId}, связей: ${data.connections_details?.connections?.length || 0}`);
  return data;
}