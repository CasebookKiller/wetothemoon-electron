// src/main/services/osint/scrapers/rusprofile.ts

import { Page, Locator } from 'playwright';
import { getBrowser, launchBrowser, launchBrowserWithSession, getPage, getStorageStatePath, launchBrowserWithRusprofile } from '../playwrightService';
import { getCredentials } from '../credentials';

export interface CompanySummary {
  name: string;
  inn: string;
  ogrn: string;
  address: string;
  ogrn_date: string;
  kpp: string;
  registration_date: string;
  capital: string;
  manager: {
    position: string;
    name: string;
    since: string;
  };
  registry_holder: string;
  average_employees: string;
  average_salary: string;
  tax_regime: string;
  sme_registry: string;
  predecessor: string;
  main_activity: string;
  tax_authority: string;
  tax_authority_since: string;
  stat_codes: {
    okpo: string;
    okato: string;
    oktmo: string;
    okfs: string;
    okogu: string;
    okopf: string;
  };
  contacts: {
    phones: string[];
    emails: string[];
    sites: string[];
  };
  updated: string;
  detailed_description: string;
}

export interface CompanyFullData {
  summary?: any;
  fssp?: any;
  trademarks?: any;
  sou?: any;
  arbitration_tile?: any;
  fns_registries?: any;
  connections?: any;
  facts?: any;
  government_procurement?: any;
  leasing?: any;
  pledges?: any;
  licenses?: any;
  competitors?: any;
  inspections?: any;
  finance?: any;
  risks?: any;
  founders?: any;
  taxes?: any;
  reliability?: any;
  top_okved?: any;
  branches?: any;
  similar?: any;
  reports?: any;
  events?: any;
  resume?: any;
  arbitration_details?: any;
  connections_details?: any;
  sou_details?: any;

  // === НОВЫЕ ПОЛЯ ===
  startedAt?: string;
  timings?: Record<string, number>;
  totalDurationMs?: number;

  trademarks_details?: any;
  leasing_details?: any;
  pledges_details?: any;
  facts_details?: any;
}

async function closeModalIfPresent(page: Page): Promise<void> {
  const closeButton = page.locator('button.modal-close.modal-company-description__close');
  try {
    // Ожидаем до 15 секунд — модальное окно может появляться с задержкой
    await closeButton.waitFor({ state: 'visible', timeout: 15000 });
    await closeButton.click({ force: true }); // force на случай перекрытия
    console.log('Модальное окно закрыто');
  } catch (e) {
    console.log('Модальное окно не появилось или уже закрыто');
  }
}

async function closeAllModals(page: Page): Promise<void> {
  if (page.isClosed()) return;
  await closeModalIfPresent(page);

  const selectors = [
    "button:has-text('Продолжить работу')",
    "a:has-text('Продолжить работу')",
    "button:has-text('Понятно')",
    "a:has-text('Понятно')",
  ];

  for (const selector of selectors) {
    const elements = page.locator(selector);
    if (await elements.count() > 0) {
      try {
        await elements.first().click({ timeout: 3000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`Не удалось закрыть модальное окно с селектором ${selector}:`, e);
      }
    }
  }
}

async function waitAndCloseModal(page: Page, maxAttempts = 8, delayMs = 2000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const closeButton = page.locator('button.modal-close.modal-company-description__close');
    if (await closeButton.count() > 0) {
      try {
        await closeButton.click({ force: true });
        console.log(`Модальное окно закрыто (попытка ${i + 1})`);
        return;
      } catch (e) {
        console.log(`Не удалось закрыть модальное окно на попытке ${i + 1}:`, e);
      }
    }
    await page.waitForTimeout(delayMs);
  }
  console.log('Модальное окно не появилось или не закрылось за отведённое время');
}

function startModalWatcher(page: Page): void {
  // Запускаем без await, чтобы не блокировать основной поток
  (async () => {
    while (true) {
      const closeButton = page.locator('button.modal-close.modal-company-description__close');
      try {
        // Ждём появления кнопки (до 30 секунд)
        await closeButton.waitFor({ state: 'visible', timeout: 30000 });
        await closeButton.click({ force: true });
        console.log('Модальное окно закрыто фоновым наблюдателем');
        // После закрытия ждём некоторое время перед следующей проверкой
        await page.waitForTimeout(2000);
      } catch (e) {
        // Если за 30 секунд окно не появилось — выходим из цикла
        console.log('Модальное окно не появилось в течение 30 секунд, наблюдатель завершён');
        break;
      }
    }
  })();
}

async function login(page: Page, login: string, password: string): Promise<void> {
  console.log('Выполняем вход на rusprofile...');
  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Ждём появления кнопки "Войти" в шапке
  const loginTrigger = page.locator('#menu-personal-trigger');
  await loginTrigger.waitFor({ state: 'visible', timeout: 15000 });

  const triggerText = await loginTrigger.innerText().catch(() => '');
  if (!triggerText.includes('Войти')) {
    console.log('Уже авторизованы, вход не требуется');
    return;
  }

  await loginTrigger.click();
  console.log('Клик по кнопке Войти выполнен');

  // Ожидание поля email
  const emailField = page.locator('input[name="email"]');
  try {
    await emailField.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Поле email найдено');
  } catch (e) {
    console.error('Поле email не появилось после клика. Пробуем альтернативный клик по тексту "Войти"');
    const textLogin = page.getByText('Войти', { exact: true }).first();
    if (await textLogin.count() > 0) {
      await textLogin.click();
      await page.waitForTimeout(2000);
    }
    await emailField.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Поле email найдено (после альтернативного клика)');
  }

  // Заполняем email
  await emailField.fill(login);
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.waitForTimeout(2000);

  // Ждём поле пароля
  const passwordField = page.locator('input[name="current-password"]');
  await passwordField.waitFor({ state: 'visible', timeout: 10000 });
  await passwordField.fill(password);

  // Нажимаем кнопку "Войти" в форме
  await page.getByRole('button', { name: 'Войти' }).click();
  console.log('Кнопка Войти в форме нажата');
  await page.waitForTimeout(8000);

  // Закрываем модальные окна
  await closeAllModals(page);

  // Проверяем, что вход успешен
  const loginTriggerAfter = page.locator('#menu-personal-trigger');
  await loginTriggerAfter.waitFor({ state: 'visible', timeout: 10000 });
  const textAfter = await loginTriggerAfter.innerText().catch(() => '');
  if (textAfter.includes('Войти')) {
    console.warn('Вход возможно не выполнен, кнопка всё ещё "Войти"');
  } else {
    console.log('Вход выполнен, кнопка теперь:', textAfter);
    // Сохраняем сессию после успешного входа
    try {
      await page.context().storageState({ path: getStorageStatePath('rusprofile') });
      console.log('Сессия сохранена.');
    } catch (e) {
      console.warn('Не удалось сохранить сессию:', e);
    }
  }
}

async function getCompanyIdByInn(page: Page, inn: string): Promise<number> {
  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const searchInput = page.locator('input#autocomplete-main-search');
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  await searchInput.fill(inn);
  await searchInput.press('Enter');
  await page.waitForTimeout(3000);

  // Проверяем, перешли ли сразу на карточку
  const url = page.url();
  const match = url.match(/\/id\/(\d+)/);
  if (match) return parseInt(match[1]);

  // Иначе кликаем первую ссылку
  const firstLink = page.locator("a[href*='/id/']").first();
  await firstLink.click();
  await page.waitForTimeout(5000);
  const newUrl = page.url();
  const newMatch = newUrl.match(/\/id\/(\d+)/);
  if (newMatch) return parseInt(newMatch[1]);

  throw new Error(`Не удалось найти ID компании по ИНН ${inn}`);
}

// Функции для сбора сводки
async function collectSummary(page: Page): Promise<any> {
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

    // Извлечение данных
    const data: any = {};

    // Название
    data.name = getTextByCss('h1');

    // ОГРН и дата
    data.ogrn = getTextByCss('#clip_ogrn');
    data.ogrn_date = getTextByXPath("//*[@id='clip_ogrn']/ancestor::dl/dd[contains(@class,'padding-top')]");

    // ИНН и КПП
    data.inn = getTextByCss('#clip_inn');
    data.kpp = getTextByCss('#clip_kpp');

    // Дата регистрации
    data.registration_date = getTextByXPath("//dt[contains(.,'Дата регистрации')]/following-sibling::dd[1]");

    // Уставный капитал
    data.capital = getTextByXPath("//dt[contains(.,'Уставный капитал')]/following-sibling::dd[1]");

    // Юридический адрес
    data.address = getTextByCss('#clip_address');

    // Руководитель
    data.manager = {
      position: getTextByXPath("//span[contains(@class,'chief-title') and (contains(.,'ПРЕЗИДЕНТ') or contains(.,'ДИРЕКТОР') or contains(.,'ГЕНЕРАЛЬНЫЙ'))]"),
      name: getTextByXPath("//div[contains(@class,'company-row') and .//span[contains(@class,'company-info__title') and contains(.,'Руководитель')]]//a[contains(@href,'/person/')]"),
      since: getTextByXPath("//div[contains(@class,'company-row') and .//span[contains(@class,'company-info__title') and contains(.,'Руководитель')]]//span[contains(@class,'chief-title') and starts-with(normalize-space(),'с ')]")
    };

    // Держатель реестра акционеров
    data.registry_holder = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Держатель реестра')]/following-sibling::span[1]//a");

    // Среднесписочная численность
    data.average_employees = getTextByXPath("//dt[contains(.,'Среднесписочная численность')]/following-sibling::dd[1]");

    // Среднемесячная зарплата
    data.average_salary = getTextByXPath("//dt[contains(.,'Среднемесячная зарплата')]/following-sibling::dd[1]");

    // Специальный налоговый режим
    data.tax_regime = getTextByXPath("//dt[contains(.,'Специальный налоговый режим')]/following-sibling::dd[1]");

    // Реестр МСП
    data.sme_registry = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Реестр МСП')]/following-sibling::span[1]");

    // Правопредшественник
    data.predecessor = getTextByXPath("//span[contains(@class,'company-info__title') and contains(.,'Правопредшественник')]/following-sibling::div[1]");

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

async function collectFssp(page: Page): Promise<any> {
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

async function collectTrademarks(page: Page): Promise<any> {
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

async function collectSou(page: Page): Promise<any> {
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

async function collectArbitrTile(page: Page): Promise<any> {
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

async function collectReesters(page: Page): Promise<any[]> {
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

async function collectConnections(page: Page): Promise<any> {
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

async function collectFacts(page: Page): Promise<any> {
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

async function collectGz(page: Page): Promise<any> {
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

async function collectLeasing(page: Page): Promise<any> {
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

async function collectPledges(page: Page): Promise<any> {
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

async function collectLicenses(page: Page): Promise<any> {
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

async function collectCompetitors(page: Page): Promise<any> {
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

async function collectInspections(page: Page): Promise<any> {
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

async function collectFinance(page: Page): Promise<any> {
  return page.evaluate(() => {
    const tile = document.querySelector('.finance-tile');
    if (!tile) return {};

    const textEl = tile.querySelector('p.tile-item__text');
    const message = textEl ? textEl.textContent?.trim() || '' : '';

    return { message };
  });
}

async function collectRisks(page: Page): Promise<any> {
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

async function collectFounders(page: Page): Promise<any> {
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

async function collectTaxes(page: Page): Promise<any> {
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

async function collectReliability(page: Page): Promise<any> {
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

async function collectTopOkved(page: Page): Promise<any> {
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

async function collectBranches(page: Page): Promise<any> {
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

async function collectSimilar(page: Page): Promise<any> {
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

async function collectReports(page: Page): Promise<any> {
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

async function collectEvents(page: Page): Promise<any> {
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

async function collectResume(page: Page): Promise<any> {
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

// Применение фильтров для арбитражных дел
async function applyArbitrFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Роль (sides)
  if (filters.sides && Array.isArray(filters.sides) && filters.sides.length > 0) {
    const sideValues = filters.sides
      .map((s: string) => {
        switch (s) {
          case 'defendant': return '1';
          case 'plaintiff': return '0';
          case 'third': return '2';
          default: return null;
        }
      })
      .filter(Boolean);

    for (const value of sideValues) {
      const checkbox = page.locator(`input[name="sides"][value="${value}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(500); // даём странице обновиться
      }
    }
  }

  // Статус
  if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
    const statusValues = filters.status
      .map((s: string) => {
        switch (s) {
          case 'in_progress': return '0';
          case 'completed': return '1';
          default: return null;
        }
      })
      .filter(Boolean);

    for (const value of statusValues) {
      const checkbox = page.locator(`input[name="status"][value="${value}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(500);
      }
    }
  }

  // Исходы (пока не реализованы, но можно добавить)
  if (filters.outcomes && Array.isArray(filters.outcomes) && filters.outcomes.length > 0) {
    for (const outcome of filters.outcomes) {
      const checkbox = page.locator(`input[name="outcomes"][value="${outcome}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(500);
      }
    }
  }

  // Категории (если будут переданы)
  if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
    for (const category of filters.categories) {
      const checkbox = page.locator(`input[name="categories"][value="${category}"]`);
      if (await checkbox.count() === 0) {
        // Попытка найти по тексту
        const label = page.locator(`label.choice-input:has-text("${category}") input[name="categories"]`);
        if (await label.count() > 0) {
          await label.check();
          await page.waitForTimeout(500);
        }
      } else {
        await checkbox.check();
        await page.waitForTimeout(500);
      }
    }
  }

  // Поиск (номер дела или ИНН)
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }

  // Период (не реализован из-за сложности datepicker, можно добавить позже)
}

// Основная функция сбора арбитражных дел (детальный список)
async function collectArbitrDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  const data: any = { total_cases: '', total_amount: '', cases: [] };

  const arbitrUrl = `https://www.rusprofile.ru/arbitr/${companyId}`;
  await page.goto(arbitrUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Применяем фильтры, если заданы
  await applyArbitrFilters(page, options.filters);

  // Ждём обновления списка после фильтров
  await page.waitForTimeout(2000);

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const mCases = headText.match(/Найдено\s*([\d\s]+)\s*дел/);
    if (mCases) data.total_cases = mCases[1].replace(/\s/g, '');
    const mAmount = headText.match(/на сумму\s*(.*?)(?:₽|руб)/);
    if (mAmount) data.total_amount = mAmount[1].trim();
  } catch (e) {
    console.log('Не удалось получить заголовок арбитража:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collectedCases = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collectedCases < maxTotalCases) {
    const items = page.locator('li.filters-results__list-item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collectedCases < maxTotalCases; i++) {
      const item = items.nth(i);
      const caseData: any = {};

      // Основные данные
      const basicInfo = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value.--title');

        const fields: any = {};
        const dl = li.querySelector('dl.snippet__block');
        if (dl) {
          const rows = dl.querySelectorAll('.snippet__row');
          rows.forEach((row) => {
            const keyEl = row.querySelector('dt.snippet__row-key');
            const valueEl = row.querySelector('dd.snippet__row-value');
            const key = keyEl ? keyEl.textContent?.trim() || '' : '';
            let value = valueEl ? valueEl.textContent?.trim() || '' : '';
            const link = valueEl?.querySelector('a.snippet__link');
            if (link) {
              value = link.textContent?.trim() || value;
              fields[key] = {
                text: value,
                href: (link as HTMLAnchorElement).href || ''
              };
            } else {
              fields[key] = value;
            }
          });
        }

        const kadLink = li.querySelector("a.snippet__link[href*='kad.arbitr.ru']");
        const kad_url = kadLink ? (kadLink as HTMLAnchorElement).href || '' : '';

        return { status, title, fields, kad_url };
      });

      caseData.status = basicInfo.status;
      caseData.fields = basicInfo.fields;
      caseData.kad_url = basicInfo.kad_url;

      const m = basicInfo.title.match(/№\s*([\w\-/]+)\s*от\s*([\d.]+)/);
      if (m) {
        caseData.case_number = m[1];
        caseData.case_date = m[2];
      } else {
        caseData.case_number = basicInfo.title;
        caseData.case_date = '';
      }

      // Раскрываем все инстанции и события
      const moreButton = item.locator('button.snippet__more');
      if (await moreButton.count() > 0) {
        try {
          await moreButton.click();
          await page.waitForTimeout(1000);
        } catch (e) {
          console.warn('Не удалось нажать "Показать все инстанции"', e);
        }
      }

      // Извлекаем все инстанции/события после раскрытия
      const events = await item.evaluate((li) => {
        const blocks = li.querySelectorAll('div.snippet__block');
        // Ищем блок, содержащий кнопку snippet__more или заголовок --bold
        let targetBlock: Element | null = null;
        for (const block of blocks) {
          if (block.querySelector('button.snippet__more') || block.querySelector('.snippet__row-value--bold')) {
            targetBlock = block;
            break;
          }
        }
        if (!targetBlock) return [];

        const result: any[] = [];
        const rows = targetBlock.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const timeEl = row.querySelector('time.snippet__row-key');
          const valueEl = row.querySelector('div.snippet__row-value');
          const date = timeEl ? timeEl.textContent?.trim() || '' : '';
          let valueText = valueEl ? valueEl.textContent?.trim() || '' : '';
          let linkHref = '';
          const link = valueEl?.querySelector('a.snippet__link');
          if (link) {
            linkHref = (link as HTMLAnchorElement).href || '';
            valueText = link.textContent?.trim() || valueText;
          }
          let instanceName = '';
          const boldEl = valueEl?.querySelector('.snippet__row-value--bold') || (valueEl && valueEl.classList.contains('snippet__row-value--bold') ? valueEl : null);
          if (boldEl) {
            instanceName = boldEl.textContent?.trim() || '';
          }
          if (date || valueText || instanceName) {
            result.push({
              date,
              text: valueText,
              link: linkHref,
              instance: instanceName
            });
          }
        });
        return result;
      });

      caseData.events = events;

      // Если не удалось извлечь события, оставляем пустой массив
      if (!caseData.events) caseData.events = [];

      if (caseData.case_number || caseData.status) {
        data.cases.push(caseData);
        collectedCases++;
      }
    }

    if (currentPage >= maxPages || collectedCases >= maxTotalCases) break;

    // Переход на следующую страницу
    const showMore = page.locator("button:has-text('Показать ещё')").first();
    if (await showMore.count() > 0 && await showMore.isEnabled()) {
      await showMore.click();
      await page.waitForTimeout(3000);
      currentPage++;
    } else {
      const nextBtn = page.locator('button.filters-pagination__nav.--next').first();
      if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        currentPage++;
      } else {
        break;
      }
    }
  }

  return data;
}

// Основная функция сбора связей (детальный список)
async function collectConnectionsDetails(page: Page, companyId: number): Promise<any> {
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

// Применение фильтров для судов общей юрисдикции
async function applySouFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Роль (radio)
  if (filters.role && filters.role !== 'all') {
    const radio = page.locator(`input[name="role"][value="${filters.role}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Судопроизводство (checkbox types)
  if (filters.types && Array.isArray(filters.types) && filters.types.length > 0) {
    for (const type of filters.types) {
      const checkbox = page.locator(`input[name="types"][value="${type}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Категория (checkbox categories)
  if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
    for (const cat of filters.categories) {
      const checkbox = page.locator(`input[name="categories"][value="${cat}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Регион (checkbox regions)
  if (filters.regions && Array.isArray(filters.regions) && filters.regions.length > 0) {
    for (const region of filters.regions) {
      const checkbox = page.locator(`input[name="regions"][value="${region}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Статус дела (checkbox results)
  if (filters.results && Array.isArray(filters.results) && filters.results.length > 0) {
    for (const result of filters.results) {
      const checkbox = page.locator(`input[name="results"][value="${result}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Точность совпадения (checkbox match_level)
  if (filters.matchLevel && Array.isArray(filters.matchLevel) && filters.matchLevel.length > 0) {
    for (const level of filters.matchLevel) {
      const checkbox = page.locator(`input[name="match_level"][value="${level}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Поиск (номер дела)
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основная функция сбора для судов общей юрисдикции (детальный список)
async function collectSouDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных судов общей юрисдикции для компании ID ${companyId}...`);
  const data: any = { total_cases: '', cases: [] };

  const souUrl = `https://www.rusprofile.ru/sou/${companyId}`;
  await page.goto(souUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Применяем фильтры (аналогично арбитражу)
  if (options.filters) {
    await applySouFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const mCases = headText.match(/Найдено\s*([\d\s]+)\s*дел/);
    if (mCases) data.total_cases = mCases[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить заголовок судов:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collectedCases = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collectedCases < maxTotalCases) {
    const items = page.locator('li.filters-results__list-item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collectedCases < maxTotalCases; i++) {
      const item = items.nth(i);
      const caseData: any = {};

      // Основные данные
      const basicInfo = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value.--title');

        const fields: any = {};
        const dl = li.querySelector('dl.snippet__block');
        if (dl) {
          const rows = dl.querySelectorAll('.snippet__row');
          rows.forEach((row) => {
            const keyEl = row.querySelector('dt.snippet__row-key');
            const valueEl = row.querySelector('dd.snippet__row-value');
            const key = keyEl ? keyEl.textContent?.trim() || '' : '';
            let value = valueEl ? valueEl.textContent?.trim() || '' : '';
            const link = valueEl?.querySelector('a.snippet__link');
            if (link) {
              value = link.textContent?.trim() || value;
              fields[key] = {
                text: value,
                href: (link as HTMLAnchorElement).href || ''
              };
            } else {
              fields[key] = value;
            }
          });
        }

        // Ссылка на сайт суда
        const sourceLink = li.querySelector("a.snippet__link[href*='mos-gorsud.ru'], a.snippet__link[href*='sudrf.ru']");
        const source_url = sourceLink ? (sourceLink as HTMLAnchorElement).href || '' : '';

        return { status, title, fields, source_url };
      });

      caseData.status = basicInfo.status;
      caseData.fields = basicInfo.fields;
      caseData.source_url = basicInfo.source_url;

      // Парсим номер дела и дату
      const m = basicInfo.title.match(/№\s*([\w\-/]+)\s*от\s*([\d.]+)/);
      if (m) {
        caseData.case_number = m[1];
        caseData.case_date = m[2];
      } else {
        caseData.case_number = basicInfo.title;
        caseData.case_date = '';
      }

      // Раскрываем все инстанции и события
      const moreButton = item.locator('button.snippet__more');
      if (await moreButton.count() > 0) {
        try {
          await moreButton.click();
          await page.waitForTimeout(1000);
        } catch (e) {
          console.warn('Не удалось нажать "Показать все" в судах:', e);
        }
      }

      // Извлекаем события после раскрытия
      const events = await item.evaluate((li) => {
        const blocks = li.querySelectorAll('div.snippet__block');
        let targetBlock: Element | null = null;
        for (const block of blocks) {
          if (block.querySelector('button.snippet__more') || block.querySelector('.snippet__row-value--bold')) {
            targetBlock = block;
            break;
          }
        }
        if (!targetBlock) return [];

        const result: any[] = [];
        const rows = targetBlock.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const timeEl = row.querySelector('time.snippet__row-key');
          const valueEl = row.querySelector('div.snippet__row-value');
          const date = timeEl ? timeEl.textContent?.trim() || '' : '';
          let valueText = valueEl ? valueEl.textContent?.trim() || '' : '';
          let linkHref = '';
          const link = valueEl?.querySelector('a.snippet__link');
          if (link) {
            linkHref = (link as HTMLAnchorElement).href || '';
            valueText = link.textContent?.trim() || valueText;
          }
          let instanceName = '';
          const boldEl = valueEl?.querySelector('.snippet__row-value--bold') || (valueEl && valueEl.classList.contains('snippet__row-value--bold') ? valueEl : null);
          if (boldEl) {
            instanceName = boldEl.textContent?.trim() || '';
          }
          if (date || valueText || instanceName) {
            result.push({ date, text: valueText, link: linkHref, instance: instanceName });
          }
        });
        return result;
      });

      caseData.events = events;

      if (caseData.case_number || caseData.status) {
        data.cases.push(caseData);
        collectedCases++;
      }
    }

    if (currentPage >= maxPages || collectedCases >= maxTotalCases) break;

    // Пагинация
    const showMore = page.locator("button:has-text('Показать ещё')").first();
    if (await showMore.count() > 0 && await showMore.isEnabled()) {
      await showMore.click();
      await page.waitForTimeout(3000);
      currentPage++;
    } else {
      const nextBtn = page.locator('button.filters-pagination__nav.--next').first();
      if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        currentPage++;
      } else {
        break;
      }
    }
  }

  console.log(`Собрано дел судов: ${data.cases.length}, всего: ${data.total_cases}`);
  return data;
}

// Применение фильтров для товарных знаков
async function applyTrademarksFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Только действующие
  if (filters.onlyActual) {
    const checkbox = page.locator('input[name="status"][value="actual"]');
    if (await checkbox.count() > 0) {
      await checkbox.check();
      await page.waitForTimeout(500);
    }
  }

  // Тип товарного знака (radio)
  if (filters.type && filters.type !== 'all') {
    const radio = page.locator(`input[name="type"][value="${filters.type}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Поиск по номеру регистрации
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основная функция сбора для товарных знаков (детальный список)
async function collectTrademarksDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных товарных знаков для компании ID ${companyId}...`);
  const data: any = { total_trademarks: '', trademarks: [] };

  const url = `https://www.rusprofile.ru/trademarks/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list, .trademarks-list, .similar-table-container', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Применяем фильтры
  if (options.filters) {
    await applyTrademarksFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*товарных знаков?/i) || headText.match(/Найдено\s*([\d\s]+)/);
    if (m) data.total_trademarks = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество товарных знаков:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collected = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collected < maxTotalCases) {
    // Здесь предполагаем, что каждый товарный знак находится в li.filters-results__list-item
    // Если структура другая, замените селектор
    const items = page.locator('li.filters-results__list-item, .trademark-item, .tm_item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collected < maxTotalCases; i++) {
      const item = items.nth(i);
      const trademark: any = {};

      // Извлекаем данные через evaluate
      const details = await item.evaluate((el) => {
        const getText = (selector: string) => {
          const node = el.querySelector(selector);
          return node ? node.textContent?.trim() || '' : '';
        };

        const id = getText('.tm_item__link, .trademark-item__number, .snippet__row-value--title');
        const status = getText('.tm_status, .snippet__status');
        const type = getText("dl:has-text('Тип') dd, .trademark-item__type");
        const regDate = getText("dl:has-text('Дата регистрации') dd, .trademark-item__date");
        const expires = getText("dl:has-text('Истекает') dd, .trademark-item__expires");
        const classes = getText('.tm_classes, .trademark-item__classes');

        return { id, status, type, regDate, expires, classes };
      });

      trademark.id = details.id;
      trademark.status = details.status;
      trademark.type = details.type;
      trademark.registration_date = details.regDate;
      trademark.expires = details.expires;
      trademark.classes = details.classes;

      if (trademark.id || trademark.status) {
        data.trademarks.push(trademark);
        collected++;
      }
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

    // Пагинация (если есть)
    const showMore = page.locator("button:has-text('Показать ещё')").first();
    if (await showMore.count() > 0 && await showMore.isEnabled()) {
      await showMore.click();
      await page.waitForTimeout(3000);
      currentPage++;
    } else {
      const nextBtn = page.locator('button.filters-pagination__nav.--next').first();
      if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        currentPage++;
      } else {
        break;
      }
    }
  }

  console.log(`Собрано товарных знаков: ${data.trademarks.length}, всего: ${data.total_trademarks}`);
  return data;
}

// Применение фильтров для лизинга
async function applyLeasingFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Роль (radio)
  if (filters.role && filters.role !== 'all') {
    const radio = page.locator(`input[name="role"][value="${filters.role}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Статус (radio)
  if (filters.status && filters.status !== 'all') {
    const radio = page.locator(`input[name="status"][value="${filters.status}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Предмет аренды (radio)
  if (filters.code && filters.code !== 'all') {
    const radio = page.locator(`input[name="code"][value="${filters.code}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Поиск
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основая функция сбора для лизинга (детальный списрк)
async function collectLeasingDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детального лизинга для компании ID ${companyId}...`);
  const data: any = { total_contracts: '', contracts: [] };

  const url = `https://www.rusprofile.ru/leasing/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyLeasingFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*договоров? лизинга/);
    if (m) data.total_contracts = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество договоров лизинга:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collected = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collected < maxTotalCases) {
    const items = page.locator('li.filters-results__list-item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collected < maxTotalCases; i++) {
      const item = items.nth(i);
      const contract: any = {};

      // === Раскрываем связанные сообщения (исправлено) ===
      const triggerLinks = item.locator('.leasing-changes-trigger__link');
      const triggerCount = await triggerLinks.count();
      for (let j = 0; j < triggerCount; j++) {
        const link = triggerLinks.nth(j);
        try {
          const parentTrigger = link.locator('..'); // .leasing-changes-trigger
          const container = parentTrigger.locator('.leasing-changes-container');
          if (await container.count() === 0) {
            // Кликаем по текстовой части
            await link.click({ force: true });
            await page.waitForTimeout(500);
            // Если контейнер не появился, кликаем по родительскому триггеру
            if (await container.count() === 0) {
              await parentTrigger.click({ force: true });
              await page.waitForTimeout(500);
            }
          }
        } catch (e) {
          console.warn(`Не удалось раскрыть сообщение #${j}:`, e);
        }
      }
      await page.waitForTimeout(500); // даём время на полное раскрытие всех контейнеров

      // === Извлекаем данные ===
      const basic = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value.--title');

        // Основные поля карточки
        const fields: any = {};
        const rows = li.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          const value = valueEl.textContent?.trim() || '';
          if (key && !key.includes('--subtitle')) {
            fields[key] = value;
          }
        });

        // Предметы финансовой аренды (вложенные блоки)
        const leaseItems: any[] = [];
        const blocks = li.querySelectorAll('div.snippet__block');
        blocks.forEach((block) => {
          const innerRows = block.querySelectorAll('.snippet__row');
          if (innerRows.length > 0) {
            const hasLeaseFields = Array.from(innerRows).some(row => {
              const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
              return ['Идентификатор', 'Классификация', 'Описание'].includes(key);
            });
            if (hasLeaseFields) {
              const leaseItem: any = {};
              innerRows.forEach(row => {
                const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
                const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
                if (key) leaseItem[key] = value;
              });
              leaseItems.push(leaseItem);
            }
          }
        });

        // Связанные сообщения с раскрытыми контейнерами
        const changes: any[] = [];
        const changeItems = li.querySelectorAll('.leasing-changes-item');
        changeItems.forEach((changeItem) => {
          const date = changeItem.querySelector('.leasing-changes-trigger__date')?.textContent?.trim() || '';
          const text = changeItem.querySelector('.leasing-changes-trigger__text')?.textContent?.trim() || '';

          // Ищем контейнер с деталями
          const container = changeItem.querySelector('.leasing-changes-container');
          const details: any[] = [];
          if (container) {
            const detailRows = container.querySelectorAll('.snippet__row');
            detailRows.forEach(row => {
              const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
              const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
              if (key) {
                details.push({ key, value });
              }
            });

            const relatedBlocks = container.querySelectorAll('.snippet__block-related');
            relatedBlocks.forEach(block => {
              const related: any[] = [];
              block.querySelectorAll('.snippet__row').forEach(row => {
                const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
                const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
                if (key) related.push({ key, value });
              });
              if (related.length) details.push({ related });
            });
          }

          changes.push({ date, text, details });
        });

        return { status, title, fields, leaseItems, changes };
      });

      contract.status = basic.status;
      const m = basic.title.match(/№\s*([\w\-/]+)\s*от\s*([\d.]+)/);
      if (m) {
        contract.contract_number = m[1];
        contract.contract_date = m[2];
      } else {
        contract.contract_number = basic.title;
        contract.contract_date = '';
      }
      contract.fields = basic.fields;
      contract.lease_subjects = basic.leaseItems;
      contract.related_messages = basic.changes;

      if (contract.contract_number || contract.status) {
        data.contracts.push(contract);
        collected++;
      }
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

    const showMore = page.locator("button:has-text('Показать ещё')").first();
    if (await showMore.count() > 0 && await showMore.isEnabled()) {
      await showMore.click();
      await page.waitForTimeout(3000);
      currentPage++;
    } else {
      const nextBtn = page.locator('button.filters-pagination__nav.--next').first();
      if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        currentPage++;
      } else {
        break;
      }
    }
  }

  console.log(`Собрано договоров лизинга: ${data.contracts.length}, всего: ${data.total_contracts}`);
  return data;
}

// Применение фильтров для залога
async function applyPledgeFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  if (filters.role && filters.role !== 'all') {
    const radio = page.locator(`input[name="role"][value="${filters.role}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  if (filters.status && filters.status !== 'all') {
    const radio = page.locator(`input[name="status"][value="${filters.status}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  if (filters.code && filters.code !== 'all') {
    const radio = page.locator(`input[name="code"][value="${filters.code}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }
}

// Основная функция сбора для залогов (детальный список)
async function collectPledgesDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных залогов для компании ID ${companyId}...`);
  const data: any = { total_messages: '', pledges: [] };

  const url = `https://www.rusprofile.ru/pledge/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyPledgeFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*сообщений о залогах/);
    if (m) data.total_messages = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество сообщений о залогах:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collected = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collected < maxTotalCases) {
    const items = page.locator('li.filters-results__list-item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collected < maxTotalCases; i++) {
      const item = items.nth(i);
      const pledge: any = {};

      // === Раскрываем все "Показать полностью" и "Показать ещё" ===
      const showMoreButtons = item.locator('.show-more-link');
      const buttonCount = await showMoreButtons.count();
      for (let j = 0; j < buttonCount; j++) {
        try {
          await showMoreButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Показать" #${j}:`, e);
        }
      }
      await page.waitForTimeout(500); // даём время на раскрытие

      // === Раскрываем связанные сообщения (если есть) ===
      const pledgeTriggers = item.locator('.pledge-changes-trigger');
      const triggerCount = await pledgeTriggers.count();
      for (let j = 0; j < triggerCount; j++) {
        try {
          await pledgeTriggers.nth(j).click({ force: true });
          await page.waitForTimeout(500);
        } catch (e) {
          console.warn(`Не удалось раскрыть связанное сообщение #${j}:`, e);
        }
      }
      await page.waitForTimeout(500);

      // === Извлекаем данные ===
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value.--title');

        // Основные поля
        const fields: any = {};
        const rows = li.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          const value = valueEl.textContent?.trim() || '';
          if (key && !key.includes('--subtitle')) {
            fields[key] = value;
          }
        });

        // Сведения о заложенном имуществе
        const pledgedItems: any[] = [];
        const mortgageBlocks = li.querySelectorAll('.snippet__block-mortaged');
        mortgageBlocks.forEach((block) => {
          const item: any = {};
          block.querySelectorAll('.snippet__row').forEach(row => {
            const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
            const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
            if (key) item[key] = value;
          });
          if (Object.keys(item).length) pledgedItems.push(item);
        });

        // Документы
        const documents: string[] = [];
        const docLinks = li.querySelectorAll('a.snippet__link--document');
        docLinks.forEach(link => {
          const text = link.textContent?.trim() || '';
          if (text) documents.push(text);
        });

        // Связанные сообщения
        const changes: any[] = [];
        const changeItems = li.querySelectorAll('.pledge-changes-item');
        changeItems.forEach((changeItem) => {
          const date = changeItem.querySelector('.pledge-changes-trigger__date')?.textContent?.trim() || '';
          const text = changeItem.querySelector('.pledge-changes-trigger__text')?.textContent?.trim() || '';

          // Детали из раскрытого контейнера
          const details: any[] = [];
          const container = changeItem.querySelector('.pledge-changes-container');
          if (container) {
            container.querySelectorAll('.snippet__row').forEach(row => {
              const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
              const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
              if (key) details.push({ key, value });
            });
          }

          changes.push({ date, text, details });
        });

        return { status, title, fields, pledgedItems, documents, changes };
      });

      pledge.status = parsed.status;
      const m = parsed.title.match(/№\s*(\d+)\s*от\s*([\d.]+)/);
      if (m) {
        pledge.message_number = m[1];
        pledge.message_date = m[2];
      } else {
        pledge.message_number = parsed.title;
        pledge.message_date = '';
      }
      pledge.fields = parsed.fields;
      pledge.pledged_items = parsed.pledgedItems;
      pledge.documents = parsed.documents;
      pledge.related_messages = parsed.changes;

      if (pledge.message_number || pledge.status) {
        data.pledges.push(pledge);
        collected++;
      }
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

    const showMore = page.locator("button:has-text('Показать ещё')").first();
    if (await showMore.count() > 0 && await showMore.isEnabled()) {
      await showMore.click();
      await page.waitForTimeout(3000);
      currentPage++;
    } else {
      const nextBtn = page.locator('button.filters-pagination__nav.--next').first();
      if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        currentPage++;
      } else {
        break;
      }
    }
  }

  console.log(`Собрано сообщений о залогах: ${data.pledges.length}, всего: ${data.total_messages}`);
  return data;
}

// Применение фильтров для существенных фактов
async function applyFactsFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Категория (radio name="group")
  if (filters.group && filters.group !== 'all') {
    const radio = page.locator(`input[name="group"][value="${filters.group}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Аннулированные сообщения (checkbox)
  if (filters.withAnnulled) {
    const checkbox = page.locator('input[name="with_annulled"][value="1"]');
    if (await checkbox.count() > 0) {
      await checkbox.check();
      await page.waitForTimeout(500);
    }
  }
}

// Основная функция сбора для существенных фактов (детальный список) 
async function collectFactsDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор существенных фактов для компании ID ${companyId}...`);
  const data: any = { total_messages: '', facts: [] };

  const url = `https://www.rusprofile.ru/facts/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyFactsFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  try {
    const headText = await page.locator('div.export-data__text, .filters-results__head').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*сообщений?/);
    if (m) data.total_messages = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество сообщений:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collected = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collected < maxTotalCases) {
    const items = page.locator('li.filters-results__list-item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collected < maxTotalCases; i++) {
      const item = items.nth(i);
      const fact: any = {};

      // === Раскрываем все скрытые блоки ===
      // Кнопки "Показать полностью" (текст комментария)
      const moreButtons = item.locator('a.snippet__more:not(.snippet__more--force)');
      const moreCount = await moreButtons.count();
      for (let j = 0; j < moreCount; j++) {
        try {
          await moreButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Показать полностью" #${j}:`, e);
        }
      }

      // Кнопки "Показать всех" (список кредиторов)
      const forceButtons = item.locator('a.snippet__more--force');
      const forceCount = await forceButtons.count();
      for (let j = 0; j < forceCount; j++) {
        try {
          await forceButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Показать всех" #${j}:`, e);
        }
      }

      await page.waitForTimeout(500); // ждём полного раскрытия

      // === Извлекаем данные ===
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        // Заголовок (тип сообщения)
        const title = getText('.snippet__row-value--title');

        // Сообщение (номер и дата)
        const message = getText('.snippet__row-value span');
        // Публикатор
        const publisherLink = li.querySelector('a.snipper__link');
        const publisher = publisherLink ? publisherLink.textContent?.trim() || '' : '';
        const publisherHref = publisherLink ? (publisherLink as HTMLAnchorElement).href || '' : '';

        // Должник/Кредитор (находим все строки)
        const fields: any = {};
        const rows = li.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          const value = valueEl.textContent?.trim() || '';
          if (key && !key.includes('--subtitle') && key !== 'Комментарий публикатора') {
            fields[key] = value;
          }
        });

        // Полный текст комментария
        let comment = '';
        const commentBlock = li.querySelector('.snippet__row--comment .truncate-text');
        if (commentBlock) comment = commentBlock.textContent?.trim() || '';

        // Список кредиторов (если есть)
        const creditors: any[] = [];
        const creditorsContainer = li.querySelector('.creditors-list');
        if (creditorsContainer) {
          const creditorLinks = creditorsContainer.querySelectorAll('a.snipper__link');
          creditorLinks.forEach(link => {
            creditors.push({
              name: link.textContent?.trim() || '',
              href: (link as HTMLAnchorElement).href || ''
            });
          });
          // Также могут быть span без ссылок (иностранные организации)
          creditorsContainer.querySelectorAll('span').forEach(span => {
            const text = span.textContent?.trim() || '';
            if (text && !span.querySelector('a')) {
              creditors.push({ name: text, href: '' });
            }
          });
        }

        // Документы
        const documents: any[] = [];
        const docItems = li.querySelectorAll('.docs-item');
        docItems.forEach(doc => {
          const text = doc.textContent?.trim() || '';
          const guid = (doc as HTMLElement).getAttribute('data-file-guid') || '';
          if (text || guid) documents.push({ name: text, guid });
        });

        return { title, message, publisher, publisherHref, fields, comment, creditors, documents };
      });

      fact.title = parsed.title;
      fact.message = parsed.message;
      fact.publisher = parsed.publisher;
      fact.publisher_href = parsed.publisherHref;
      fact.fields = parsed.fields;
      fact.comment = parsed.comment;
      fact.creditors = parsed.creditors;
      fact.documents = parsed.documents;

      if (fact.title || fact.message) {
        data.facts.push(fact);
        collected++;
      }
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

    const showMore = page.locator("button:has-text('Показать ещё')").first();
    if (await showMore.count() > 0 && await showMore.isEnabled()) {
      await showMore.click();
      await page.waitForTimeout(3000);
      currentPage++;
    } else {
      const nextBtn = page.locator('button.filters-pagination__nav.--next').first();
      if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        currentPage++;
      } else {
        break;
      }
    }
  }

  console.log(`Собрано фактов: ${data.facts.length}, всего: ${data.total_messages}`);
  return data;
}

export async function scrapeRusprofile(
  inn: string,
  options?: {
    arbitrDetails?: boolean;
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;        // фильтры арбитража
    connectionsDetails?: boolean;
    souDetails?: boolean;
    souFilters?: any;     // фильтры судов (включая лимиты)
    trademarksDetails?: boolean;
    trademarksFilters?: any;
    leasingDetails?: boolean;
    leasingFilters?: any;
    pledgesDetails?: boolean;
    pledgesFilters?: any;
    factsDetails?: boolean;
    factsFilters?: any;
  }
): Promise<CompanyFullData | null> {

  let browser = getBrowser();
  if (!browser) {
    await launchBrowserWithSession('rusprofile'); // <-- используем новую функцию
    browser = getBrowser();
  }
  if (!browser) throw new Error('Не удалось запустить браузер');

  let page = getPage();
  if (!page) {
    page = await browser.newPage();
  }

  try {
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    const timed = async (name: string, fn: () => Promise<any>) => {
      const t0 = Date.now();
      const data = await fn();
      timings[name] = Date.now() - t0;
      return data;
    };

    // Проверяем, авторизованы ли мы уже
    const loginTrigger = page.locator('#menu-personal-trigger');
    await loginTrigger.waitFor({ state: 'visible', timeout: 15000 });
    const loginText = await loginTrigger.innerText().catch(() => '');

    if (loginText.includes('Войти')) {
      console.log('Требуется вход. Получаем учётные данные...');
      let creds = getCredentials('rusprofile');
      if (!creds) {
        const envLogin = process.env.VITE_RUSPROFILE_LOGIN;
        const envPassword = process.env.VITE_RUSPROFILE_PASSWORD;
        if (envLogin && envPassword) {
          creds = { login: envLogin, password: envPassword };
        }
      }
      if (!creds) {
        throw new Error('Нет учётных данных для rusprofile. Добавьте их в .env (VITE_RUSPROFILE_LOGIN, VITE_RUSPROFILE_PASSWORD) или сохраните через интерфейс OSINT.');
      }
      await login(page, creds.login, creds.password);
    } else {
      console.log('Сессия восстановлена, вход не требуется.');
    }

    // Найти ID компании
    const companyId = await getCompanyIdByInn(page, inn);
    const companyUrl = `https://www.rusprofile.ru/id/${companyId}`;
    await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Перешли на карточку компании, запускаем наблюдатель модальных окон...');
    startModalWatcher(page);
    await page.waitForTimeout(2000);

    const result = {} as CompanyFullData;

    console.log('Сбор сводки...');
    result.summary = await timed('summary', () => collectSummary(page));

    console.log('Сбор ФССП...');
    result.fssp = await timed('fssp', () => collectFssp(page));

    console.log('Сбор товарных знаков...');
    result.trademarks = await timed('trademarks', () => collectTrademarks(page));

    console.log('Сбор судов общей юрисдикции...');
    result.sou = await timed('sou', () => collectSou(page));

    console.log('Сбор арбитражных дел (сводка)...');
    result.arbitration_tile = await timed('arbitration_tile', () => collectArbitrTile(page));

    console.log('Сбор реестров ФНС...');
    result.fns_registries = await timed('fns_registries', () => collectReesters(page));

    console.log('Сбор связей...');
    result.connections = await timed('connections', () => collectConnections(page));

    console.log('Сбор сообщений о сущфактах...');
    result.facts = await timed('facts', () => collectFacts(page));

    console.log('Сбор госзакупок...');
    result.government_procurement = await timed('government_procurement', () => collectGz(page));

    console.log('Сбор лизинга...');
    result.leasing = await timed('leasing', () => collectLeasing(page));

    console.log('Сбор залогов...');
    result.pledges = await timed('pledges', () => collectPledges(page));

    console.log('Сбор лицензий...');
    result.licenses = await timed('licenses', () => collectLicenses(page));

    console.log('Сбор конкурентов...');
    result.competitors = await timed('competitors', () => collectCompetitors(page));

    console.log('Сбор проверок...');
    result.inspections = await timed('inspections', () => collectInspections(page));

    console.log('Сбор финансов...');
    result.finance = await timed('finance', () => collectFinance(page));

    console.log('Сбор рисков сотрудничества...');
    result.risks = await timed('risks', () => collectRisks(page));

    console.log('Сбор учредителей...');
    result.founders = await timed('founders', () => collectFounders(page));

    console.log('Сбор налогов и сборов...');
    result.taxes = await timed('taxes', () => collectTaxes(page));

    console.log('Сбор надёжности...');
    result.reliability = await timed('reliability', () => collectReliability(page));

    console.log('Сбор топа компаний отрасли...');
    result.top_okved = await timed('top_okved', () => collectTopOkved(page));

    console.log('Сбор филиалов и представительств...');
    result.branches = await timed('branches', () => collectBranches(page));

    console.log('Сбор похожих организаций...');
    result.similar = await timed('similar', () => collectSimilar(page));

    console.log('Сбор отчётов и документов...');
    result.reports = await timed('reports', () => collectReports(page));

    console.log('Сбор событий...');
    result.events = await timed('events', () => collectEvents(page));

    console.log('Сбор краткой справки...');
    result.resume = await timed('resume', () => collectResume(page));
    console.log('Сбор сводки завершен.');

    // Если запрошены детальные арбитражные дела
    if (options?.arbitrDetails) {
      console.log('Сбор детального арбитража...');
      result.arbitration_details = await timed('arbitration_details', () =>
        collectArbitrDetails(page, companyId, {
          maxPages: options.maxPages,
          maxTotalCases: options.maxTotalCases,
          filters: options.filters,
        })
      );
    }

    if (options?.connectionsDetails) {
      console.log('Сбор детальных связей...');
      result.connections_details = await timed('connections_details', () =>
        collectConnectionsDetails(page, companyId)
      );
    }

    if (options?.souDetails) {
      console.log('Сбор детальных судов общей юрисдикции...');
      result.sou_details = await timed('sou_details', () =>
        collectSouDetails(page, companyId, {
          maxPages: options.souFilters?.maxPages || 1,
          maxTotalCases: options.souFilters?.maxTotalCases || 100,
          filters: options.souFilters, // передаём весь объект фильтров
        })
      );
    }

    if (options?.trademarksDetails) {
      console.log('Сбор детальных товарных знаков...');
      result.trademarks_details = await timed('trademarks_details', () =>
        collectTrademarksDetails(page, companyId, {
          maxPages: options.trademarksFilters?.maxPages || 1,
          maxTotalCases: options.trademarksFilters?.maxTotalCases || 100,
          filters: options.trademarksFilters,
        })
      );
    }

    if (options?.leasingDetails) {
      console.log('Сбор детального лизинга...');
      result.leasing_details = await timed('leasing_details', () =>
        collectLeasingDetails(page, companyId, {
          maxPages: options.leasingFilters?.maxPages || 1,
          maxTotalCases: options.leasingFilters?.maxTotalCases || 100,
          filters: options.leasingFilters,
        })
      );
    }

    if (options?.pledgesDetails) {
      console.log('Сбор детальных залогов...');
      result.pledges_details = await timed('pledges_details', () =>
        collectPledgesDetails(page, companyId, {
          maxPages: options.pledgesFilters?.maxPages || 1,
          maxTotalCases: options.pledgesFilters?.maxTotalCases || 100,
          filters: options.pledgesFilters,
        })
      );
    }

    if (options?.factsDetails) {
      console.log('Сбор детальных существенных фактов...');
      result.facts_details = await timed('facts_details', () =>
        collectFactsDetails(page, companyId, {
          maxPages: options.factsFilters?.maxPages || 1,
          maxTotalCases: options.factsFilters?.maxTotalCases || 100,
          filters: options.factsFilters,
        })
      );
    }

    result.startedAt = new Date(startTime).toISOString();
    result.timings = timings;
    result.totalDurationMs = Date.now() - startTime;

    return result;
  } catch (error) {
    console.error('Rusprofile scraping error:', error);
    return null;
  }
}