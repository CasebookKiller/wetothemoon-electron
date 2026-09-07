import { Page } from 'playwright';

export async function collectFssp(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.fssp-tile');
    if (!tile) return {};

    // Вспомогательная функция для получения текста по XPath относительно tile
    const getTextByXPath = (xpath: string): string => {
      const result = document.evaluate(
        xpath,
        tile,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const node = result.singleNodeValue as HTMLElement | null;
      return node ? node.textContent?.trim() || '' : '';
    };

    return {
      total_productions: getTextByXPath(".//a[contains(@class,'num') and contains(@class,'gtm_fs_all')]"),
      fines: getTextByXPath(".//div[contains(@class,'connexion-col__title') and contains(.,'Штрафы:')]"),
      collections: getTextByXPath(".//div[contains(@class,'connexion-col__title') and contains(.,'Взыскания:')]"),
      other: getTextByXPath(".//div[contains(@class,'connexion-col__title') and contains(.,'Прочее:')]"),
      total_amount: getTextByXPath(".//div[contains(@class,'connexion-col__title') and contains(.,'На сумму')]/following-sibling::div[contains(@class,'connexion-col__num')][1]"),
      remaining_debt: getTextByXPath(".//div[contains(@class,'connexion-col__title') and contains(.,'Остаток задолженности')]/following-sibling::div[contains(@class,'connexion-col__num')][1]")
    };
  });
}

export async function collectTrademarks(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.trademarks-tile');
    if (!tile) return {};

    // Вспомогательные функции внутри браузера
    const getTextByXPath = (xpath: string): string => {
      const result = document.evaluate(
        xpath,
        tile,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const node = result.singleNodeValue as HTMLElement | null;
      return node ? node.textContent?.trim() || '' : '';
    };

    const getTextByCss = (selector: string): string => {
      const el = tile.querySelector(selector);
      return el ? el.textContent?.trim() || '' : '';
    };

    // Общие значения
    const total = getTextByXPath(".//div[contains(@class,'connexion-col') and contains(.,'Всего')]//a");
    const active = getTextByXPath(".//div[contains(@class,'connexion-col') and contains(.,'Действующие')]//a");

    // Данные последнего товарного знака
    const id = getTextByCss('a.tm_item__link');
    const status = getTextByCss('.tm_status');
    const type = getTextByXPath(".//dl[contains(.,'Тип')]//dd");
    const registration_date = getTextByXPath(".//dl[contains(.,'Дата регистрации')]//dd");
    const expires = getTextByXPath(".//dl[contains(.,'Истекает')]//dd");
    const other_trademarks_text = getTextByCss('dl.trademarks-tile__info dd');

    return {
      total,
      active,
      last_trademark: {
        id,
        status,
        type,
        registration_date,
        expires,
      },
      other_trademarks_text,
    };
  });
}

export async function collectSou(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.sou-tile');
    if (!tile) return { total_cases: '', top_categories: [] };

    const activeTab = tile.querySelector('.tab-item.active');
    if (!activeTab) return { total_cases: '', top_categories: [] };

    // Общее количество дел
    const totalEl = activeTab.querySelector('.connexion-col__num a.num');
    let total_cases = '';
    if (totalEl) {
      const text = totalEl.textContent?.trim() || '';
      const m = text.match(/[\d\s]+/);
      if (m) total_cases = m[0].replace(/\s/g, '');
    }

    // Категории
    const top_categories: any[] = [];
    const items = activeTab.querySelectorAll('ul.unstyled li');
    items.forEach((li) => {
      const nameEl = li.querySelector('span.hoverUnderline.colon');
      const countEl = li.querySelector('span.text-blue');
      const percentEl = li.querySelector('span.percentWrp');

      const name = nameEl ? nameEl.textContent?.trim() || '' : '';
      const count = countEl ? countEl.textContent?.trim() || '' : '';
      let percent = '';
      if (percentEl) {
        percent = (percentEl.textContent || '').trim().replace(/[()%]/g, '');
      }

      if (name || count) {
        top_categories.push({ name, count, percent });
      }
    });

    return { total_cases, top_categories };
  });
}

export async function collectArbitrTile(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.arbitr-tile');
    if (!tile) return { total_cases: '', total_amount: '', outcomes: [], dynamics: [], categories: [] };

    const activeRole = tile.querySelector('.tab-item.active');
    if (!activeRole) return { total_cases: '', total_amount: '', outcomes: [], dynamics: [], categories: [] };

    const activeSubtab = activeRole.querySelector('.tab-item.active') || activeRole;

    // Итоговое количество дел и сумма
    const totalBlockEl = activeSubtab.querySelector('.connexion-col__num');
    const totalBlock = totalBlockEl ? totalBlockEl.textContent?.trim() || '' : '';
    let total_cases = '';
    let total_amount = '';
    if (totalBlock) {
      const mCases = totalBlock.match(/([\d\s]+?)\s*дел/);
      if (mCases) total_cases = mCases[1].replace(/\s/g, '');
      if (totalBlock.includes('на сумму')) {
        total_amount = totalBlock.split('на сумму')[1].trim();
      }
    }

    // Исходы
    const outcomes: any[] = [];
    const outcomeItems = activeSubtab.querySelectorAll('ul.unstyled li');
    outcomeItems.forEach((li) => {
      const nameEl = li.querySelector('span.hoverUnderline.colon');
      const countEl = li.querySelector('span.text-blue');
      const percentEl = li.querySelector('span.percentWrp');

      const name = nameEl ? nameEl.textContent?.trim() || '' : '';
      const count = countEl ? countEl.textContent?.trim() || '' : '';
      let percent = '';
      if (percentEl) {
        percent = (percentEl.textContent || '').trim().replace(/[()%]/g, '');
      }
      if (name || count) outcomes.push({ name, count, percent });
    });

    // Динамика по годам
    const dynamics: any[] = [];
    const dynamicRows = activeSubtab.querySelectorAll('table.arbitr-table tbody tr td.text-darkest-grey');
    dynamicRows.forEach((td) => {
      const text = td.textContent?.trim() || '';
      const m = text.match(/(\d{4}):\s*([\d\s]+?)\s*дел.*?на\s*(.*?)(?:\s*руб\.)?$/);
      if (m) {
        dynamics.push({
          year: m[1],
          cases: m[2].replace(/\s/g, ''),
          amount: m[3].trim(),
        });
      }
    });

    // Категории
    const categories: any[] = [];
    const catLinks = activeSubtab.querySelectorAll('.arbitr-case-categories .badge-list a.badge-status');
    catLinks.forEach((link) => {
      const name = link.childNodes[0]?.textContent?.trim() || '';
      const countEl = link.querySelector('span');
      const count = countEl ? countEl.textContent?.trim() || '' : '';
      if (name || count) categories.push({ name, count });
    });

    return { total_cases, total_amount, outcomes, dynamics, categories };
  });
}

export async function collectReesters(page: Page): Promise<any[]> {
  return page.evaluate(() => {
    const tile = document.querySelector('.reesters-tile');
    if (!tile) return [];

    const items = tile.querySelectorAll('ul.reesters-tile__list li');
    const result: any[] = [];

    items.forEach((li) => {
      const flagEl = li.querySelector('span.flag');
      const status = flagEl ? flagEl.textContent?.trim() || '' : '';
      const fullText = li.textContent?.trim() || '';

      let category = '';
      if (status && fullText.startsWith(status)) {
        category = fullText.substring(status.length).trim();
      } else {
        category = fullText;
      }

      if (category || status) {
        result.push({ status, category });
      }
    });

    return result;
  });
}

export async function collectConnections(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.connections-tile');
    if (!tile) return {};

    const tabNames: Record<string, string> = { conn_1: 'actual', conn_2: 'historical', conn_3: 'all' };
    const tabs = tile.querySelectorAll('div.tab-item[data-tab_name]');
    const result: any = {};

    tabs.forEach((tab) => {
      const dataTabName = (tab as HTMLElement).getAttribute('data-tab_name') || '';
      const label = tabNames[dataTabName] || dataTabName;

      // Описание
      const descriptionEl = tab.querySelector('p.tile-item__text.margin-bottom');
      const description = descriptionEl ? descriptionEl.textContent?.trim() || '' : '';

      // Счётчики
      const counts: any = {};
      const cols = tab.querySelectorAll('div.connexion-col');
      cols.forEach((col) => {
        const titleEl = col.querySelector('div.connexion-col__title');
        const valueEl = col.querySelector('div.connexion-col__num');
        const title = titleEl ? titleEl.textContent?.trim() || '' : '';
        const value = valueEl ? valueEl.textContent?.trim() || '' : '';
        if (title) counts[title] = value;
      });

      result[label] = { description, counts };
    });

    return result;
  });
}

export async function collectFacts(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.facts-tile');
    if (!tile) return { counts: {}, last_messages: [] };

    // Счётчики
    const counts: any = {};
    const cols = tile.querySelectorAll('div.responsive-cols__item');
    cols.forEach((col) => {
      const titleEl = col.querySelector('div.connexion-col__title');
      const valueEl = col.querySelector('div.connexion-col__num');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';
      const value = valueEl ? valueEl.textContent?.trim() || '' : '';
      if (title) counts[title] = value;
    });

    // Последние сообщения
    const last_messages: any[] = [];
    const msgs = tile.querySelectorAll('div.history-tile__item');
    msgs.forEach((msg) => {
      const dateEl = msg.querySelector('div.history-tile__item__title');
      const descEl = msg.querySelector('div.history-tile__item__description');
      const date = dateEl ? dateEl.textContent?.trim() || '' : '';
      const desc = descEl ? descEl.textContent?.trim() || '' : '';
      if (date || desc) last_messages.push({ date, description: desc });
    });

    return { counts, last_messages };
  });
}

export async function collectGz(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const tile = document.querySelector('.gz-tile');
    if (!tile) return { supplier: {}, customer: {} };

    const collectActiveRoleData = (): any => {
      const activeTab = tile.querySelector('.tab-item.active');
      if (!activeTab) return {};

      const roleData: any = {};

      // Закупки
      const purchaseLabelEl = activeTab.querySelector('.connexion-col__num');
      const purchaseLabel = purchaseLabelEl ? purchaseLabelEl.textContent?.trim() || '' : '';
      const mPurchases = purchaseLabel.match(/([\d\s]+?)\s*закупок/);
      if (mPurchases) roleData.purchases_count = mPurchases[1].replace(/\s/g, '');
      if (purchaseLabel.includes('на сумму')) roleData.purchases_amount = purchaseLabel.split('на сумму')[1].trim();

      // Контракты
      const contractBlockEls = activeTab.querySelectorAll('.connexion-col__num');
      const contractBlockEl = contractBlockEls[1];
      const contractBlock = contractBlockEl ? contractBlockEl.textContent?.trim() || '' : '';
      const mContracts = contractBlock.match(/([\d\s]+?)\s*контракта/);
      if (mContracts) roleData.contracts_count = mContracts[1].replace(/\s/g, '');
      if (contractBlock.includes('на сумму')) roleData.contracts_amount = contractBlock.split('на сумму')[1].trim();

      // Статусы
      roleData.statuses = [];
      const statusItems = activeTab.querySelectorAll('ul.statuses-table li');
      statusItems.forEach((li) => {
        const nameEl = li.querySelector('span.hoverUnderline.colon');
        const countEl = li.querySelector('span.text-blue');
        const percentEl = li.querySelector('span.percentWrp');
        const name = nameEl ? nameEl.textContent?.trim() || '' : '';
        const count = countEl ? countEl.textContent?.trim() || '' : '';
        let percent = '';
        if (percentEl) percent = (percentEl.textContent || '').trim().replace(/[()%]/g, '');
        if (name || count) roleData.statuses.push({ name, count, percent });
      });

      // Топ-3
      roleData.top_3 = [];
      const founderItems = activeTab.querySelectorAll('div.founder-item');
      founderItems.forEach((item) => {
        const top: any = {};
        const nameEl = item.querySelector('div.founder-item__title a span');
        const purchasesEl = item.querySelector('dl.founder-item__dl dt a');
        const amountEl = item.querySelector('dl.founder-item__dl dd');
        top.name = nameEl ? nameEl.textContent?.trim() || '' : '';
        top.purchases = purchasesEl ? purchasesEl.textContent?.trim() || '' : '';
        top.amount = amountEl ? amountEl.textContent?.trim() || '' : '';
        if (top.name) roleData.top_3.push(top);
      });

      // Категории
      roleData.categories = [];
      const catLinks = activeTab.querySelectorAll('.gz-case-categories .badge-list a.badge-status');
      catLinks.forEach((link) => {
        const cat: any = {};
        cat.name = link.childNodes[0]?.textContent?.trim() || '';
        const countEl = link.querySelector('span');
        cat.count = countEl ? countEl.textContent?.trim() || '' : '';
        if (cat.name || cat.count) roleData.categories.push(cat);
      });

      return roleData;
    };

    // Сбор данных для поставщика (активная вкладка по умолчанию)
    const supplier = collectActiveRoleData();

    // Переключение на заказчика
    const tabCustomer = Array.from(tile.querySelectorAll('span.tab-opener')).find(el =>
      el.textContent?.includes('Заказчика')
    ) as HTMLElement | undefined;

    let customer = {};
    if (tabCustomer) {
      tabCustomer.click();
      // Ждём обновления DOM после клика
      await new Promise(resolve => setTimeout(resolve, 500));
      customer = collectActiveRoleData();
    }

    return { supplier, customer };
  });
}

export async function collectLeasing(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.leasing-tile');
    if (!tile) return {};

    const tabs = tile.querySelectorAll('div.tab-item[data-tab_name]');
    const result: any = {};

    tabs.forEach((tab) => {
      const tabName = (tab as HTMLElement).getAttribute('data-tab_name') || '';
      let label = tabName;
      if (tabName === 'leasing_all') label = 'all';
      else if (tabName === 'leasing_lessee') label = 'lessee';

      const entry: any = { contracts_count: '', subjects: [] };

      // Количество контрактов
      const countEl = tab.querySelector('div.connexion-col__num a.num');
      entry.contracts_count = countEl ? countEl.textContent?.trim() || '' : '';

      // Субъекты лизинга
      const subjectLinks = tab.querySelectorAll('.badge-list a.badge-status');
      subjectLinks.forEach((link) => {
        const subject: any = {};
        subject.name = link.childNodes[0]?.textContent?.trim() || '';
        const countSpan = link.querySelector('span');
        subject.count = countSpan ? countSpan.textContent?.trim() || '' : '';
        if (subject.name || subject.count) entry.subjects.push(subject);
      });

      result[label] = entry;
    });

    return result;
  });
}

export async function collectPledges(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.pledge-tile');
    if (!tile) return {};

    const tabs = tile.querySelectorAll('div.tab-item[data-tab_name]');
    const result: any = {};

    tabs.forEach((tab) => {
      const tabName = (tab as HTMLElement).getAttribute('data-tab_name') || '';
      let label = tabName;
      if (tabName === 'pledge_all') label = 'all';
      else if (tabName === 'pledge_mortgagee') label = 'mortgagee';
      else if (tabName === 'pledge_mortgagor') label = 'mortgagor';

      const entry: any = { contracts_count: '', subjects: [] };

      // Количество сообщений
      const countEl = tab.querySelector('div.connexion-col__num a.num');
      entry.contracts_count = countEl ? countEl.textContent?.trim() || '' : '';

      // Типы заложенного имущества
      const subjectLinks = tab.querySelectorAll('.badge-list a.badge-status');
      subjectLinks.forEach((link) => {
        const subject: any = {};
        subject.name = link.childNodes[0]?.textContent?.trim() || '';
        const countSpan = link.querySelector('span');
        subject.count = countSpan ? countSpan.textContent?.trim() || '' : '';
        if (subject.name || subject.count) entry.subjects.push(subject);
      });

      result[label] = entry;
    });

    return result;
  });
}

export async function collectLicenses(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.licenses-tile');
    if (!tile) return { total_licenses: '', total_activity_types: '', by_source: {} };

    // Общий текст с числами лицензий и видов деятельности
    const textEl = tile.querySelector('p.tile-item__text');
    const text = textEl ? textEl.textContent?.trim() || '' : '';
    const mLic = text.match(/(\d+)\s*лицензи/);
    const mAct = text.match(/(\d+)\s*видам/);

    // Источники (название и значение)
    const by_source: any = {};
    const cols = tile.querySelectorAll('div.connexion-col');
    cols.forEach((col) => {
      const titleEl = col.querySelector('div.connexion-col__title');
      const valueEl = col.querySelector('div.connexion-col__num');
      const source = titleEl ? titleEl.textContent?.trim() || '' : '';
      const value = valueEl ? valueEl.textContent?.trim() || '' : '';
      if (source) by_source[source] = value;
    });

    return {
      total_licenses: mLic ? mLic[1] : '',
      total_activity_types: mAct ? mAct[1] : '',
      by_source,
    };
  });
}

export async function collectCompetitors(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.competitor-tile');
    if (!tile) return { total_competitors: '', competitors: [] };

    // Общее количество конкурентов
    let total_competitors = '';
    const allLink = tile.querySelector('a.see-details');
    if (allLink) {
      const text = allLink.textContent?.trim() || '';
      const m = text.match(/Все\s+([\d\s]+)\s+конкурент/);
      if (m) total_competitors = m[1].replace(/\s/g, '');
    }

    // Список конкурентов
    const competitors: any[] = [];
    const items = tile.querySelectorAll('div.founder-item');
    items.forEach((item) => {
      const competitor: any = {};

      // Название компании
      const nameEl = item.querySelector('div.founder-item__title a span');
      competitor.name = nameEl ? nameEl.textContent?.trim() || '' : '';

      // Выручка (последняя строка первого dl.founder-item__dl)
      const firstDl = item.querySelector('dl.founder-item__dl');
      if (firstDl) {
        const revenueText = firstDl.textContent?.trim() || '';
        const lines = revenueText.split('\n').map(l => l.trim()).filter(Boolean);
        competitor.revenue = lines[lines.length - 1] || '';
      } else {
        competitor.revenue = '';
      }

      // Госконтракты (второй dl.founder-item__dl)
      const dls = item.querySelectorAll('dl.founder-item__dl');
      const contractsDl = dls[1];
      if (contractsDl) {
        const dtEl = contractsDl.querySelector('dt');
        const ddEl = contractsDl.querySelector('dd');
        const dtText = dtEl ? dtEl.textContent?.trim() || '' : '';
        const mContr = dtText.match(/([\d\s]+?)\s*госконтрактов/);
        competitor.contracts_count = mContr ? mContr[1].replace(/\s/g, '') : '';
        competitor.contracts_amount = ddEl ? ddEl.textContent?.trim() || '' : '';
      } else {
        competitor.contracts_count = '';
        competitor.contracts_amount = '';
      }

      if (competitor.name) competitors.push(competitor);
    });

    return { total_competitors, competitors };
  });
}

export async function collectInspections(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.inspections-tile');
    if (!tile) return { total_inspections: '', total_preventive: '', categories: {} };

    // Общий текст с количеством проверок и профилактических мероприятий
    const textEl = tile.querySelector('p.tile-item__text');
    const text = textEl ? textEl.textContent?.trim() || '' : '';
    const mInsp = text.match(/(\d+)\s*проверок/);
    const mPrev = text.match(/(\d+)\s*профилактических/);

    // Категории проверок (название и значение)
    const categories: any = {};
    const cols = tile.querySelectorAll('div.connexion-col');
    cols.forEach((col) => {
      const titleEl = col.querySelector('div.connexion-col__title');
      const valueEl = col.querySelector('div.connexion-col__num');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';
      const value = valueEl ? valueEl.textContent?.trim() || '' : '';
      if (title) categories[title] = value;
    });

    return {
      total_inspections: mInsp ? mInsp[1] : '',
      total_preventive: mPrev ? mPrev[1] : '',
      categories,
    };
  });
}

export async function collectFinance(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.finance-tile');
    if (!tile) return {};

    const textEl = tile.querySelector('p.tile-item__text');
    const message = textEl ? textEl.textContent?.trim() || '' : '';

    return { message };
  });
}

export async function collectRisks(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.riscs-tile');
    if (!tile) return {};

    const result: any = {};
    const rows = tile.querySelectorAll('div.company-row');

    rows.forEach((row) => {
      const titleEl = row.querySelector('span.company-info__title');
      if (!titleEl) return;

      const title = titleEl.textContent?.trim() || '';
      if (!title) return;

      let fullText = row.textContent?.trim() || '';
      if (fullText.startsWith(title)) {
        fullText = fullText.substring(title.length).trim();
      }
      fullText = fullText.replace(/\s*Проверить\s*$/, '').trim();

      let additional = '';
      const addEl = row.querySelector('div.additional-info');
      if (addEl) {
        additional = addEl.textContent?.trim() || '';
        if (additional && fullText.includes(additional)) {
          fullText = fullText.replace(additional, '').trim();
        }
      }

      result[title] = { text: fullText, additional };
    });

    return result;
  });
}

export async function collectFounders(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.founders-tile');
    if (!tile) return { message: '', founders: [] };

    // Сообщение (может быть "Данные отсутствуют" или список)
    const messageEl = tile.querySelector('p.tile-item__text');
    const message = messageEl ? messageEl.textContent?.trim() || '' : '';

    // Список учредителей
    const founders: any[] = [];
    const items = tile.querySelectorAll('div.founder-item');
    items.forEach((item) => {
      const nameEl = item.querySelector('div.founder-item__title a span');
      const detailsEl = item.querySelector('dl.founder-item__dl');
      const name = nameEl ? nameEl.textContent?.trim() || '' : '';
      const details = detailsEl ? detailsEl.textContent?.trim() || '' : '';

      if (name || details) {
        founders.push({ name, details });
      }
    });

    return { message, founders };
  });
}

export async function collectTaxes(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.taxes-tile');
    if (!tile) return {};

    // Сообщение о налогах
    const messageEl = tile.querySelector('div.tile-item__text');
    const message = messageEl ? messageEl.textContent?.trim() || '' : '';

    // Таблица с налогами (массив строк, каждая строка - массив ячеек)
    const taxes: string[][] = [];
    const rows = tile.querySelectorAll('table tbody tr');
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
      if (cells.length) taxes.push(cells);
    });

    return { message, taxes };
  });
}

export async function collectReliability(page: Page): Promise<any> {
  return page.evaluate(() => {
    // Ищем блок с рисками по разным селекторам
    let tile: Element | null = document.querySelector('div.tile-item.--risks');
    if (!tile) {
      tile = Array.from(document.querySelectorAll('div.tile-item')).find(el =>
        el.querySelector("h2 a[href*='/reliability/']")
      ) || null;
    }
    if (!tile) return {};

    // Заголовок
    const titleEl = tile.querySelector('h2.tile-item__title a');
    const title = titleEl ? titleEl.textContent?.trim() || '' : '';

    // Метка предупреждения
    const labelEl = tile.querySelector('div.tile-item__label');
    const label = labelEl ? labelEl.textContent?.trim() || '' : '';

    // Описание
    const descEl = tile.querySelector('div.tile-item__text');
    const description = descEl ? descEl.textContent?.trim() || '' : '';

    // Ссылка "Подробнее"
    const seeDetails = tile.querySelector('a.see-details');
    const more_facts = seeDetails ? seeDetails.textContent?.trim() || '' : '';
    const url = seeDetails ? (seeDetails as HTMLAnchorElement).getAttribute('href') || '' : '';

    return { title, label, description, more_facts, url };
  });
}

export async function collectTopOkved(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.top_okved-tile');
    if (!tile) return { description: '', region: { title: 'Москва', companies: [] }, country: { title: 'Вся Россия', companies: [] } };

    const description = tile.querySelector('p.tile-item__text.margin-bottom')?.textContent?.trim() || '';

    const parseTab = (tabName: string): any[] => {
      const tab = tile.querySelector(`div.tab-item[data-tab_name='${tabName}']`);
      if (!tab) return [];

      const rows = Array.from(tab.querySelectorAll('table tbody tr'));
      const companies: any[] = [];

      for (const row of rows) {
        // Пропуск строки заголовка (если есть ячейка с текстом "Выручка")
        const firstCell = row.querySelector('td.only-tablet-mob');
        if (firstCell && firstCell.textContent?.includes('Выручка')) continue;

        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 2) continue;

        const position = cells[0]?.textContent?.trim() || '';
        const nameLink = cells[1]?.querySelector('a');
        const name = nameLink?.textContent?.trim() || '';
        const url = nameLink?.getAttribute('href') || '';

        let revenue = '';
        if (cells.length > 2) {
          const revenueDesktop = cells[2]?.querySelector('.hide-less-tablet');
          revenue = revenueDesktop ? revenueDesktop.textContent?.trim() || '' : cells[2]?.textContent?.trim() || '';
        }
        const dynamic = cells.length > 3 ? cells[3]?.textContent?.trim() || '' : '';

        if (name || revenue) companies.push({ position, name, url, revenue, dynamic });
      }
      return companies;
    };

    return {
      description,
      region: { title: 'Москва', companies: parseTab('top_okved_region') },
      country: { title: 'Вся Россия', companies: parseTab('top_okved_country') },
    };
  });
}

export async function collectBranches(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.branches-tile');
    if (!tile) return {};

    const totalEl = tile.querySelector('div.connexion-col__num a.num');
    const descEl = tile.querySelector('p.tile-item__text');
    const urlEl = tile.querySelector('a.see-details');

    return {
      total: totalEl ? totalEl.textContent?.trim() || '' : '',
      description: descEl ? descEl.textContent?.trim() || '' : '',
      url: urlEl ? (urlEl as HTMLAnchorElement).getAttribute('href') || '' : '',
    };
  });
}

export async function collectSimilar(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.similar-tile');
    if (!tile) return { description: '', companies: [] };

    const descEl = tile.querySelector('p.tile-item__text');
    const description = descEl ? descEl.textContent?.trim() || '' : '';

    const items = tile.querySelectorAll('div.similar-item');
    const companies: any[] = [];

    items.forEach((item) => {
      const link = item.querySelector('div.similar-item__title a');
      if (link) {
        const name = link.textContent?.trim() || '';
        const url = (link as HTMLAnchorElement).getAttribute('href') || '';
        if (name) companies.push({ name, url });
      }
    });

    return { description, companies };
  });
}

export async function collectReports(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.reports-tile');
    if (!tile) return { documents: [] };

    const linkEls = tile.querySelectorAll('div.reports-tile__btns a');
    const documents: any[] = [];

    linkEls.forEach((link) => {
      const titleEl = link.querySelector('span.big');
      const fullTextEl = link.querySelector('span.r-part');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';
      const fullText = fullTextEl ? fullTextEl.textContent?.trim() || '' : '';
      let description = fullText;
      if (title && fullText.startsWith(title)) {
        description = fullText.substring(title.length).trim();
      }
      const url = (link as HTMLAnchorElement).getAttribute('href') || '';
      if (title || url) documents.push({ title, description, url });
    });

    return { documents };
  });
}

export async function collectEvents(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.history-tile');
    if (!tile) return { counts: {}, last_changes: [] };

    // Счётчики
    const counts: any = {};
    const cols = tile.querySelectorAll('div.connexion-col');
    cols.forEach((col) => {
      const titleEl = col.querySelector('div.connexion-col__title');
      const valueEl = col.querySelector('div.connexion-col__num');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';
      const value = valueEl ? valueEl.textContent?.trim() || '' : '';
      if (title) counts[title] = value;
    });

    // Последние изменения
    const last_changes: any[] = [];
    const items = tile.querySelectorAll('div.history-tile__item');
    items.forEach((item) => {
      const dateEl = item.querySelector('div.history-tile__item__title');
      const descEl = item.querySelector('div.history-tile__item__description');
      const date = dateEl ? dateEl.textContent?.trim() || '' : '';
      const description = descEl ? descEl.textContent?.trim() || '' : '';
      if (date || description) last_changes.push({ date, description });
    });

    return { counts, last_changes };
  });
}

export async function collectResume(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.resume-tile');
    if (!tile) return {};

    const titleEl = tile.querySelector('h2.tile-item__title');
    const title = titleEl ? titleEl.textContent?.trim() || '' : '';

    const paragraphs: string[] = [];
    const paragraphEls = tile.querySelectorAll('p.resume-tile__text');
    paragraphEls.forEach((p) => {
      const text = p.textContent?.trim() || '';
      if (text) paragraphs.push(text);
    });

    return { title, paragraphs };
  });
}
