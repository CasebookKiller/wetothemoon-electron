// src/main/services/osint/scrapers/rusprofile.ts

import { Page } from 'playwright';
import { getBrowser, launchBrowserWithSession, getPage, } from '../playwrightService';
import { getCredentials } from '../credentials';
import { CompanyFullData } from './rusprofile/types';
import { startModalWatcher } from './rusprofile/helpers';
import { login } from './rusprofile/login';
import { collectSummary } from './rusprofile/collectSummary';
import {
  collectFssp,
  collectTrademarks,
  collectSou,
  collectArbitrTile,
  collectReesters,
  collectConnections,
  collectFacts,
  collectGz,
  collectLeasing,
  collectPledges,
  collectLicenses,
  collectCompetitors,
  collectInspections,
  collectFinance,
  collectRisks,
  collectFounders,
  collectTaxes,
  collectReliability,
  collectTopOkved,
  collectBranches,
  collectSimilar,
  collectReports,
  collectEvents,
  collectResume,
} from './rusprofile/collectTiles';
import { collectArbitrDetails } from './rusprofile/details/arbitr';
import { collectConnectionsDetails } from './rusprofile/details/connections';
import { collectSouDetails } from './rusprofile/details/sou';
import { collectTrademarksDetails } from './rusprofile/details/trademarks';
import { collectLeasingDetails } from './rusprofile/details/leasing';
import { collectPledgesDetails } from './rusprofile/details/pledges';
import { collectFactsDetails } from './rusprofile/details/facts';
import { collectBankruptcyDetails } from './rusprofile/details/bankruptcy';
import { collectFoundersDetails } from './rusprofile/details/founders';
import { collectReliabilityDetails } from './rusprofile/details/reliability';
import { collectSanctionsDetails } from './rusprofile/details/sanctions';
import { collectGzDetails } from './rusprofile/details/gz';
import { collectFsspDetails } from './rusprofile/details/fssp';
import { collectInspectionsDetails } from './rusprofile/details/inspections';
import { collectLicensesDetails } from './rusprofile/details/licenses';
import { collectBranchesDetails } from './rusprofile/details/branches';
import { collectHistoryDetails } from './rusprofile/details/history';
import { collectRequisitesDetails } from './rusprofile/details/requisites';
import { collectOkvedDetails } from './rusprofile/details/okved';
import { collectEgrulDetails } from './rusprofile/details/egrul';



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

async function getEntityIdByInn(page: Page, inn: string): Promise<{ id: number; type: 'company' | 'entrepreneur' | 'person' }> {
  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const searchInput = page.locator('input#autocomplete-main-search');
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });
  await searchInput.fill(inn);
  await searchInput.press('Enter');
  await page.waitForTimeout(3000);

  // Проверяем, перешли ли сразу на карточку (любого типа)
  const url = page.url();
  const match = url.match(/\/(id|ip|person)\/(\d+)/);
  if (match) {
    return { id: parseInt(match[2]), type: match[1] as any };
  }

  // Иначе кликаем первую подходящую ссылку
  const firstLink = page.locator("a[href*='/id/'], a[href*='/ip/'], a[href*='/person/']").first();
  await firstLink.click();
  await page.waitForTimeout(5000);
  const newUrl = page.url();
  const newMatch = newUrl.match(/\/(id|ip|person)\/(\d+)/);
  if (newMatch) {
    return { id: parseInt(newMatch[2]), type: newMatch[1] as any };
  }

  throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
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
    bankruptcyDetails?: boolean;
    bankruptcyFilters?: any;
    foundersDetails?: boolean;
    foundersFilters?: any;
    reliabilityDetails?: boolean;
    sanctionsDetails?: boolean;
    gzDetails?: boolean;
    gzFilters?: any;
    fsspDetails?: boolean;
    fsspFilters?: any;
    inspectionsDetails?: boolean;
    inspectionsFilters?: any;
    licensesDetails?: boolean;
    licensesFilters?: any;
    branchesDetails?: boolean;
    historyDetails?: boolean;
    historyFilters?: any;
    requisitesDetails?: boolean;
    okvedDetails?: boolean;
    egrulDetails?: boolean;
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
    const entityInfo = await getEntityIdByInn(page, inn);
    const companyId = entityInfo.id;
    const entityType = entityInfo.type;
    const companyUrl = `https://www.rusprofile.ru/${entityType}/${companyId}`;
    await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Перешли на карточку компании, запускаем наблюдатель модальных окон...');
    startModalWatcher(page);
    await page.waitForTimeout(2000);

    const result = {} as CompanyFullData & { company_id?: number; entity_type?: string };
    result.company_id = companyId;
    result.entity_type = entityType;

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

    if (options?.bankruptcyDetails) {
      console.log('Сбор детального банкротства...');
      result.bankruptcy_details = await timed('bankruptcy_details', () =>
        collectBankruptcyDetails(page, companyId, {
          maxPages: options.bankruptcyFilters?.maxPages || 1,
          maxTotalCases: options.bankruptcyFilters?.maxTotalCases || 100,
          search: options.bankruptcyFilters?.search,
        })
      );
    }

    if (options?.foundersDetails) {
      console.log('Сбор детальных учредителей...');
      result.founders_details = await timed('founders_details', () =>
        collectFoundersDetails(page, companyId, {
          maxPages: options.foundersFilters?.maxPages || 1,
          maxTotalCases: options.foundersFilters?.maxTotalCases || 100,
          filters: options.foundersFilters,
        })
      );
    }

    if (options?.reliabilityDetails) {
      console.log('Сбор детальной надёжности...');
      result.reliability_details = await timed('reliability_details', () =>
        collectReliabilityDetails(page, companyId)
      );
    }

    if (options?.sanctionsDetails) {
      console.log('Сбор детальных санкций...');
      result.sanctions_details = await timed('sanctions_details', () =>
        collectSanctionsDetails(page, companyId)
      );
    }

    if (options?.gzDetails) {
      console.log('Сбор детальных госзакупок...');
      result.gz_details = await timed('gz_details', () =>
        collectGzDetails(page, companyId, {
          maxPages: options.gzFilters?.maxPages || 1,
          maxTotalCases: options.gzFilters?.maxTotalCases || 100,
          filters: options.gzFilters,
        })
      );
    }

    if (options?.fsspDetails) {
      console.log('Сбор детальных исполнительных производств...');
      result.fssp_details = await timed('fssp_details', () =>
        collectFsspDetails(page, companyId, {
          maxPages: options.fsspFilters?.maxPages || 1,
          maxTotalCases: options.fsspFilters?.maxTotalCases || 100,
          filters: options.fsspFilters,
        })
      );
    }

    if (options?.inspectionsDetails) {
      console.log('Сбор детальных проверок...');
      result.inspections_details = await timed('inspections_details', () =>
        collectInspectionsDetails(page, companyId, {
          maxPages: options.inspectionsFilters?.maxPages || 1,
          maxTotalCases: options.inspectionsFilters?.maxTotalCases || 100,
          filters: options.inspectionsFilters,
        })
      );
    }

    if (options?.licensesDetails) {
      console.log('Сбор детальных лицензий...');
      result.licenses_details = await timed('licenses_details', () =>
        collectLicensesDetails(page, companyId, {
          maxPages: options.licensesFilters?.maxPages || 1,
          maxTotalCases: options.licensesFilters?.maxTotalCases || 100,
          filters: options.licensesFilters,
        })
      );
    }

    if (options?.branchesDetails) {
      console.log('Сбор детальных филиалов и представительств...');
      result.branches_details = await timed('branches_details', () =>
        collectBranchesDetails(page, companyId)
      );
    }

    if (options?.historyDetails) {
      console.log('Сбор детальной истории...');
      result.history_details = await timed('history_details', () =>
        collectHistoryDetails(page, companyId, {
          maxPages: options.historyFilters?.maxPages || 1,
          maxTotalCases: options.historyFilters?.maxTotalCases || 100,
          filters: options.historyFilters,
        })
      );
    }

    if (options?.requisitesDetails) {
      console.log('Сбор детальных реквизитов...');
      result.requisites_details = await timed('requisites_details', () =>
        collectRequisitesDetails(page, companyId)
      );
    }

    if (options?.okvedDetails) {
      console.log('Сбор детальных видов деятельности...');
      result.okved_details = await timed('okved_details', () =>
        collectOkvedDetails(page, companyId)
      );
    }

    if (options?.egrulDetails) {
      console.log('Сбор выписки из ЕГРЮЛ...');
      result.egrul_details = await timed('egrul_details', () =>
        collectEgrulDetails(page, companyId)
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