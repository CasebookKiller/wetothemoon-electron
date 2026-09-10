// src/main/services/osint/scrapers/rusprofile/collectSummary.ts

import { Page } from 'playwright';

async function collectTabs(page: Page): Promise<Array<{ key: string; title: string; url: string }>> {
  return page.evaluate(() => {
    const result: Array<{ key: string; title: string; url: string }> = [];
    const seen = new Set<string>();

    const addTab = (key: string, title: string, url: string) => {
      if (!key || !url || seen.has(key)) return;
      seen.add(key);
      result.push({ key, title, url });
    };

    // 1. Плитки с ссылками в заголовке
    document.querySelectorAll(
      '.tiles__aside .tiles__item[data-name], .tiles__main .tiles__item[data-name], .tiles__row .tiles__item[data-name]'
    ).forEach((el) => {
      const key = el.getAttribute('data-name') || '';
      if (!key) return;
      const linkEl = el.querySelector('.tile-item__title a') as HTMLAnchorElement | null;
      if (!linkEl) return;
      addTab(key, linkEl.textContent?.trim() || '', linkEl.href || '');
    });

    // 2. Санкции — ссылка внутри блока "Риски сотрудничества"
    const sanctionsLink = document.querySelector('a[href*="/sanctions/"]') as HTMLAnchorElement | null;
    if (sanctionsLink) {
      addTab('sanctions', 'Санкции', sanctionsLink.href);
    }

    // 3. Выписка ЕГРЮЛ/ЕГРИП — кнопка в шапке карточки
    const egrulLink = document.querySelector('a[href*="/egrul"], a[href*="/egrip"]') as HTMLAnchorElement | null;
    if (egrulLink) {
      addTab('egrul', 'Выписка ЕГРЮЛ/ЕГРИП', egrulLink.href);
    }

    return result;
  });
}

export async function collectSummary(page: Page): Promise<any> {
  const summary = await page.evaluate(() => {
    const getTextByCss = (selector: string): string => {
      const el = document.querySelector(selector);
      return el ? el.textContent?.trim() || '' : '';
    };

    const getTextByXPath = (xpath: string): string => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const node = result.singleNodeValue as HTMLElement | null;
      return node ? node.textContent?.trim() || '' : '';
    };

    const getTextsByXPath = (xpath: string): string[] => {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
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

    const data: any = {};
    data.entity_type = entityType;

    // Название
    data.name = getTextByCss('#clip_name') || getTextByCss('h1') || '';

    // ОГРН или ОГРНИП
    if (isCompany) {
      data.ogrn = getTextByCss('#clip_ogrn');
      data.ogrn_date = getTextByXPath("//*[@id='clip_ogrn']/ancestor::dl/dd[contains(@class,'padding-top')]");
    } else if (isEntrepreneur) {
      data.ogrnip = getTextByCss('#clip_ogrnip');
      // Дата ОГРНИП
      const ogrnipDate = getTextByXPath("//*[@id='clip_ogrnip']/ancestor::dl//dd[contains(@class,'company-info__text')][2]");
      data.ogrn_date = ogrnipDate.replace(/от\s*/i, '').trim();
    } else {
      data.ogrn = '';
      data.ogrnip = '';
      data.ogrn_date = '';
    }

    // ИНН и КПП
    data.inn = getTextByCss('#clip_inn');
    data.kpp = isCompany ? getTextByCss('#clip_kpp') : '';

    // Дата регистрации
    data.registration_date = getTextByXPath("//dt[contains(.,'Дата регистрации')]/following-sibling::dd[1]");

    // Уставный капитал (только ЮЛ)
    data.capital = isCompany ? getTextByXPath("//dt[contains(.,'Уставный капитал')]/following-sibling::dd[1]") : '';

    // Адрес
    data.address = getTextByCss('#clip_address') || getTextByXPath("//dt[contains(.,'Регион')]/following-sibling::dd[1]") || '';

    // Руководитель
    if (isCompany) {
      data.manager = {
        position: getTextByXPath("//span[contains(@class,'chief-title') and (contains(.,'ПРЕЗИДЕНТ') or contains(.,'ДИРЕКТОР') or contains(.,'ГЕНЕРАЛЬНЫЙ'))]"),
        name: getTextByXPath("//div[contains(@class,'company-row') and .//span[contains(@class,'company-info__title') and contains(.,'Руководитель')]]//a[contains(@href,'/person/')]"),
        since: getTextByXPath("//div[contains(@class,'company-row') and .//span[contains(@class,'company-info__title') and contains(.,'Руководитель')]]//span[contains(@class,'chief-title') and starts-with(normalize-space(),'с ')]")
      };
    } else if (isEntrepreneur) {
      data.manager = {
        position: 'Индивидуальный предприниматель',
        name: data.name,
        since: ''
      };
    } else {
      data.manager = { position: '', name: '', since: '' };
    }

    // Держатель реестра акционеров (только ЮЛ)
    data.registry_holder = isCompany
      ? getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Держатель реестра')]/following-sibling::span[1]//a")
      : '';

    // Среднесписочная численность, зарплата, налоговый режим, реестр МСП, правопредшественник
    data.average_employees = getTextByXPath("//dt[contains(.,'Среднесписочная численность')]/following-sibling::dd[1]");
    data.average_salary = getTextByXPath("//dt[contains(.,'Среднемесячная зарплата')]/following-sibling::dd[1]");
    data.tax_regime = getTextByXPath("//dt[contains(.,'Специальный налоговый режим')]/following-sibling::dd[1]");
    data.sme_registry = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Реестр МСП')]/following-sibling::span[1]");
    data.predecessor = isCompany
      ? getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Правопредшественник')]/following-sibling::div[1]")
      : '';

    // Основной вид деятельности
    if (isCompany) {
      data.main_activity = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Основной вид деятельности')]/following-sibling::span[1]");
    } else if (isEntrepreneur) {
      // Из плитки ОКВЭД или реквизитов
      data.main_activity = getTextByXPath("//div[contains(@class,'okved-tile')]//div[contains(@class,'tile-item__text-title') and contains(.,'Основной')]/following-sibling::p[1]");
      // Если не нашли, попробуем из краткой справки
      if (!data.main_activity) {
        const resumeText = getTextByXPath("//div[contains(@class,'resume-tile')]//p[1]");
        const match = resumeText.match(/Основным видом деятельности является «([^»]+)»/);
        if (match) data.main_activity = match[1];
      }
    } else {
      data.main_activity = '';
    }

    // Налоговый орган
    data.tax_authority = '';
    if (isCompany) {
      data.tax_authority = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Налоговый орган')]/following-sibling::span[1]");
    } else if (isEntrepreneur) {
      // Из реквизитов: dt "Наименование налогового органа"
      data.tax_authority = getTextByXPath("//div[contains(@class,'requisites-ip')]//dt[contains(.,'Наименование налогового органа')]/following-sibling::dd[1]");
    }

    data.tax_authority_since = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Налоговый орган')]/following-sibling::span[contains(@class,'chief-title')]");

    // Коды статистики
    if (isCompany) {
      data.stat_codes = {
        okpo: getTextByCss('#clip_okpo'),
        okato: getTextByCss('#clip_okato'),
        oktmo: getTextByCss('#clip_oktmo'),
        okfs: getTextByCss('#clip_okfs'),
        okogu: getTextByCss('#clip_okogu'),
        okopf: getTextByCss('#clip_okopf')
      };
    } else if (isEntrepreneur) {
      data.stat_codes = {
        okpo: getTextByCss('#req_okpo'),
        okato: getTextByCss('#req_okato'),
        oktmo: getTextByCss('#req_oktmo'),
        okfs: '',
        okogu: '',
        okopf: ''
      };
    } else {
      data.stat_codes = { okpo: '', okato: '', oktmo: '', okfs: '', okogu: '', okopf: '' };
    }

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

    // Для ИП: дополнительные поля из реквизитов
    if (isEntrepreneur) {
      const getRequisite = (dtText: string) => getTextByXPath(`//div[contains(@class,'requisites-ip')]//dt[contains(.,'${dtText}')]/following-sibling::dd[1]`);

      data.gender = getTextByXPath("//dt[contains(.,'Пол')]/following-sibling::dd[1]");
      data.citizenship = getTextByXPath("//dt[contains(.,'Гражданство')]/following-sibling::dd[1]");
      data.registrar = getRequisite('Регистратор');
      data.pension_reg_number = getRequisite('Регистрационный номер');
      data.pension_reg_date = getTextByXPath("//div[contains(@class,'requisites-ip')]//dt[contains(.,'Дата регистрации')]/following-sibling::dd[1]");
      data.pension_authority = getRequisite('Наименование территориального органа');
      data.special_tax_regime = getRequisite('Применяется');
      data.msp_category = getTextByXPath("//div[contains(@class,'requisites-ip')]//dt[contains(.,'Категория субъекта')]/following-sibling::dd[1]");
    }

    return data;
  });

  // Дополнительно собираем список доступных вкладок (с ссылками)
  try {
    const tabs = await collectTabs(page);
    summary.available_tabs = tabs;
  } catch (e) {
    console.warn('Не удалось собрать список вкладок:', e);
    summary.available_tabs = [];
  }

  return summary;
}