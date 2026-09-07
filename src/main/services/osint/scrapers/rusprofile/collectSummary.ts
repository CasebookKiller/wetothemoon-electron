// src/main/services/osint/scrapers/rusprofile/collectSummary.ts

import { Page } from 'playwright';

export async function collectSummary(page: Page): Promise<any> {
  // Выполняем все извлечение данных в контексте страницы за один раз
  return page.evaluate(() => {
    // Вспомогательные функции для работы внутри браузера
    const getTextByCss = (selector: string): string => {
      const el = document.querySelector(selector);
      return el ? el.textContent?.trim() || '' : '';
    };

    const getTextByXPath = (xpath: string): string => {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const node = result.singleNodeValue as HTMLElement | null;
      return node ? node.textContent?.trim() || '' : '';
    };

    const getTextsByXPath = (xpath: string): string[] => {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      const texts: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i) as HTMLElement | null;
        if (node && node.textContent) {
          const text = node.textContent.trim();
          if (text) texts.push(text);
        }
      }
      return texts;
    };

    // Определяем тип страницы
    const isCompany = !!document.querySelector('#clip_ogrn');
    const isEntrepreneur = !!document.querySelector('#clip_ogrnip');
    const isPerson = !isCompany && !isEntrepreneur;
    const entityType = isCompany ? 'company' : isEntrepreneur ? 'entrepreneur' : 'person';

    // Извлечение данных
    const data: any = {};
    data.entity_type = entityType;

    // Название
    data.name = getTextByCss('h1');

    // ОГРН или ОГРНИП
    if (isCompany) {
      data.ogrn = getTextByCss('#clip_ogrn');
      data.ogrn_date = getTextByXPath("//*[@id='clip_ogrn']/ancestor::dl/dd[contains(@class,'padding-top')]");
    } else if (isEntrepreneur) {
      data.ogrnip = getTextByCss('#clip_ogrnip');
      data.ogrn_date = getTextByXPath("//*[@id='clip_ogrnip']/ancestor::dl/dd[contains(@class,'padding-top')]");
    } else {
      data.ogrn = '';
      data.ogrnip = '';
      data.ogrn_date = '';
    }

    // ИНН и КПП
    data.inn = getTextByCss('#clip_inn');
    data.kpp = isCompany ? getTextByCss('#clip_kpp') : '';

    // Дата регистрации (универсально)
    data.registration_date = getTextByXPath("//dt[contains(.,'Дата регистрации')]/following-sibling::dd[1]");

    // Уставный капитал (только для ЮЛ)
    data.capital = isCompany ? getTextByXPath("//dt[contains(.,'Уставный капитал')]/following-sibling::dd[1]") : '';

    // Юридический адрес (или адрес регистрации)
    data.address = getTextByCss('#clip_address');

    // Руководитель (для ЮЛ) или сам ИП; для ФЛ может отсутствовать
    if (isCompany) {
      data.manager = {
        position: getTextByXPath("//span[contains(@class,'chief-title') and (contains(.,'ПРЕЗИДЕНТ') or contains(.,'ДИРЕКТОР') or contains(.,'ГЕНЕРАЛЬНЫЙ'))]"),
        name: getTextByXPath("//div[contains(@class,'company-row') and .//span[contains(@class,'company-info__title') and contains(.,'Руководитель')]]//a[contains(@href,'/person/')]"),
        since: getTextByXPath("//div[contains(@class,'company-row') and .//span[contains(@class,'company-info__title') and contains(.,'Руководитель')]]//span[contains(@class,'chief-title') and starts-with(normalize-space(),'с ')]")
      };
    } else if (isEntrepreneur) {
      data.manager = {
        position: 'Индивидуальный предприниматель',
        name: data.name, // ИП является руководителем сам себе
        since: ''
      };
    } else {
      data.manager = { position: '', name: '', since: '' };
    }

    // Держатель реестра акционеров (только ЮЛ)
    data.registry_holder = isCompany
      ? getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Держатель реестра')]/following-sibling::span[1]//a")
      : '';

    // Среднесписочная численность
    data.average_employees = getTextByXPath("//dt[contains(.,'Среднесписочная численность')]/following-sibling::dd[1]");

    // Среднемесячная зарплата
    data.average_salary = getTextByXPath("//dt[contains(.,'Среднемесячная зарплата')]/following-sibling::dd[1]");

    // Специальный налоговый режим
    data.tax_regime = getTextByXPath("//dt[contains(.,'Специальный налоговый режим')]/following-sibling::dd[1]");

    // Реестр МСП
    data.sme_registry = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Реестр МСП')]/following-sibling::span[1]");

    // Правопредшественник (только ЮЛ)
    data.predecessor = isCompany
      ? getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Правопредшественник')]/following-sibling::div[1]")
      : '';

    // Основной вид деятельности
    data.main_activity = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Основной вид деятельности')]/following-sibling::span[1]");

    // Налоговый орган
    data.tax_authority = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Налоговый орган')]/following-sibling::span[1]");
    data.tax_authority_since = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Налоговый орган')]/following-sibling::span[contains(@class,'chief-title')]");

    // Коды статистики
    data.stat_codes = {
      okpo: getTextByCss('#clip_okpo'),
      okato: getTextByCss('#clip_okato'),
      oktmo: getTextByCss('#clip_oktmo'),
      okfs: getTextByCss('#clip_okfs'),
      okogu: getTextByCss('#clip_okogu'),
      okopf: getTextByCss('#clip_okopf')
    };

    // Контакты
    const phones = getTextsByXPath("//div[contains(@class,'company-info__contact') and contains(@class,'phone')]//a[starts-with(@href,'tel:')]");
    const emails = getTextsByXPath("//div[contains(@class,'company-info__contact') and contains(@class,'mail')]//a[starts-with(@href,'mailto:')]");
    const sites = getTextsByXPath("//div[contains(@class,'company-info__contact') and contains(@class,'site')]//a[contains(@href,'http')]");
    data.contacts = { phones, emails, sites };

    // Актуально на дату
    const actualElem = document.querySelector("div[class*='anketa-actual']");
    data.updated = actualElem ? actualElem.textContent!.replace('Актуально на', '').trim() : '';

    // Полное описание
    data.detailed_description = getTextByCss('div.anketa-bottom');

    return data;
  });
}