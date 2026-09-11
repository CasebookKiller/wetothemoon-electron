// src/main/services/osint/scrapers/rusprofile/index.ts

import { getBrowser, getPage, launchBrowserWithSession } from '../../playwrightService';
import { getCredentials } from '../../credentials';
import { login } from './login';
import { collectSummary } from './collectSummary';
import { startModalWatcher } from './helpers';
import { CompanyFullData } from './types';

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
} from './collectTiles';

import { collectArbitrDetails } from './details/arbitr';
import { collectSouDetails } from './details/sou';
import { collectTrademarksDetails } from './details/trademarks';
import { collectLeasingDetails } from './details/leasing';
import { collectPledgesDetails } from './details/pledges';
import { collectFactsDetails } from './details/facts';
import { collectBankruptcyDetails } from './details/bankruptcy';
import { collectFoundersDetails } from './details/founders';
import { collectReliabilityDetails } from './details/reliability';
import { collectSanctionsDetails } from './details/sanctions';
import { collectGzDetails } from './details/gz';
import { collectFsspDetails } from './details/fssp';
import { collectInspectionsDetails } from './details/inspections';
import { collectLicensesDetails } from './details/licenses';
import { collectBranchesDetails } from './details/branches';
import { collectHistoryDetails } from './details/history';
import { collectRequisitesDetails } from './details/requisites';
import { collectOkvedDetails } from './details/okved';
import { collectEgrulDetails } from './details/egrul';
import { collectConnectionsDetails } from './details/connections';

// === Сборщики для ФЛ ===
import { collectPersonCeoDetails } from './details/person/ceo';
import { collectPersonFounderDetails } from './details/person/founder';
import { collectPersonIpDetails } from './details/person/ip';
import { collectPersonConnectionsDetails } from './details/person/connections';
import { collectPersonReliabilityDetails } from './details/person/reliability';
import { collectPersonHistoryDetails } from './details/person/history';

import { Page } from 'playwright';
import { getEntityIdByInn } from './search';

export async function scrapeRusprofile(
  inn: string,
  options?: {
    arbitrDetails?: boolean;
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
    connectionsDetails?: boolean;
    souDetails?: boolean;
    souFilters?: any;
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
    onlySections?: string[];
    preferredType?: 'company' | 'entrepreneur' | 'person';

    // Разделы ФЛ
    personCeoDetails?: boolean;
    personFounderDetails?: boolean;
    personIpDetails?: boolean;
    personConnectionsDetails?: boolean;
    personReliabilityDetails?: boolean;
    personHistoryDetails?: boolean;
  }
): Promise<CompanyFullData | null> {

  let browser = getBrowser();
  if (!browser) {
    await launchBrowserWithSession('rusprofile');
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

    // === Автовключение флагов по onlySections ===
    if (options?.onlySections && options.onlySections.length > 0) {
      const detailFlagMap: Record<string, string> = {
        // ЮЛ/ИП
        'arbitration_details': 'arbitrDetails',
        'connections_details': 'connectionsDetails',
        'sou_details': 'souDetails',
        'trademarks_details': 'trademarksDetails',
        'leasing_details': 'leasingDetails',
        'pledges_details': 'pledgesDetails',
        'facts_details': 'factsDetails',
        'bankruptcy_details': 'bankruptcyDetails',
        'founders_details': 'foundersDetails',
        'reliability_details': 'reliabilityDetails',
        'sanctions_details': 'sanctionsDetails',
        'gz_details': 'gzDetails',
        'fssp_details': 'fsspDetails',
        'inspections_details': 'inspectionsDetails',
        'licenses_details': 'licensesDetails',
        'branches_details': 'branchesDetails',
        'history_details': 'historyDetails',
        'requisites_details': 'requisitesDetails',
        'okved_details': 'okvedDetails',
        'egrul_details': 'egrulDetails',
        // ФЛ
        'person_ceo_details': 'personCeoDetails',
        'person_founder_details': 'personFounderDetails',
        'person_connections_details': 'personConnectionsDetails',
        'person_reliability_details': 'personReliabilityDetails',
        'person_history_details': 'personHistoryDetails',
      };

      for (const section of options.onlySections) {
        const flag = detailFlagMap[section];
        if (flag) {
          (options as any)[flag] = true;
        }
      }
    }

    const shouldCollect = (section: string) =>
      !options?.onlySections || options.onlySections.includes(section);

    // Проверяем, авторизованы ли мы
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

    // Определяем ID/тип
    const entityInfo = await getEntityIdByInn(page, inn, options?.preferredType);
    const companyId = entityInfo.id;
    const entityType = entityInfo.type;

    const urlPath = entityType === 'company' ? 'id' : entityType === 'entrepreneur' ? 'ip' : 'person';
    const companyUrl = `https://www.rusprofile.ru/${urlPath}/${companyId}`;
    console.log(`DEBUG index: переход на карточку ${companyUrl}`);
    await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Перешли на карточку, запускаем наблюдатель модальных окон...');
    startModalWatcher(page);
    await page.waitForTimeout(2000);

    const result = {} as CompanyFullData & { company_id?: number | string; entity_type?: string };
    result.company_id = companyId;
    result.entity_type = entityType;

    // ============ СВОДКА (для всех типов) ============
    if (shouldCollect('summary')) {
      console.log('Сбор сводки...');
      result.summary = await timed('summary', () => collectSummary(page));
    }

    // ============ ПЛИТКИ И ДЕТАЛЬНЫЕ РАЗДЕЛЫ ЮЛ/ИП ============
    if (entityType !== 'person') {

      if (shouldCollect('fssp')) {
        console.log('Сбор ФССП...');
        result.fssp = await timed('fssp', () => collectFssp(page));
      }

      if (shouldCollect('trademarks')) {
        console.log('Сбор товарных знаков...');
        result.trademarks = await timed('trademarks', () => collectTrademarks(page));
      }

      if (shouldCollect('sou')) {
        console.log('Сбор судов общей юрисдикции...');
        result.sou = await timed('sou', () => collectSou(page));
      }

      if (shouldCollect('arbitration_tile')) {
        console.log('Сбор арбитражных дел (сводка)...');
        result.arbitration_tile = await timed('arbitration_tile', () => collectArbitrTile(page));
      }

      if (shouldCollect('fns_registries')) {
        console.log('Сбор реестров ФНС...');
        result.fns_registries = await timed('fns_registries', () => collectReesters(page));
      }

      if (shouldCollect('connections')) {
        console.log('Сбор связей...');
        result.connections = await timed('connections', () => collectConnections(page));
      }

      if (shouldCollect('facts')) {
        console.log('Сбор сообщений о сущфактах...');
        result.facts = await timed('facts', () => collectFacts(page));
      }

      if (shouldCollect('government_procurement')) {
        console.log('Сбор госзакупок...');
        result.government_procurement = await timed('government_procurement', () => collectGz(page));
      }

      if (shouldCollect('leasing')) {
        console.log('Сбор лизинга...');
        result.leasing = await timed('leasing', () => collectLeasing(page));
      }

      if (shouldCollect('pledges')) {
        console.log('Сбор залогов...');
        result.pledges = await timed('pledges', () => collectPledges(page));
      }

      if (shouldCollect('licenses')) {
        console.log('Сбор лицензий...');
        result.licenses = await timed('licenses', () => collectLicenses(page));
      }

      if (shouldCollect('competitors')) {
        console.log('Сбор конкурентов...');
        result.competitors = await timed('competitors', () => collectCompetitors(page));
      }

      if (shouldCollect('inspections')) {
        console.log('Сбор проверок...');
        result.inspections = await timed('inspections', () => collectInspections(page));
      }

      if (shouldCollect('finance')) {
        console.log('Сбор финансов...');
        result.finance = await timed('finance', () => collectFinance(page));
      }

      if (shouldCollect('risks')) {
        console.log('Сбор рисков сотрудничества...');
        result.risks = await timed('risks', () => collectRisks(page));
      }

      if (shouldCollect('founders')) {
        console.log('Сбор учредителей...');
        result.founders = await timed('founders', () => collectFounders(page));
      }

      if (shouldCollect('taxes')) {
        console.log('Сбор налогов и сборов...');
        result.taxes = await timed('taxes', () => collectTaxes(page));
      }

      if (shouldCollect('reliability')) {
        console.log('Сбор надёжности...');
        result.reliability = await timed('reliability', () => collectReliability(page));
      }

      if (shouldCollect('top_okved')) {
        console.log('Сбор топа компаний отрасли...');
        result.top_okved = await timed('top_okved', () => collectTopOkved(page));
      }

      if (shouldCollect('branches')) {
        console.log('Сбор филиалов и представительств...');
        result.branches = await timed('branches', () => collectBranches(page));
      }

      if (shouldCollect('similar')) {
        console.log('Сбор похожих организаций...');
        result.similar = await timed('similar', () => collectSimilar(page));
      }

      if (shouldCollect('reports')) {
        console.log('Сбор отчётов и документов...');
        result.reports = await timed('reports', () => collectReports(page));
      }

      if (shouldCollect('events')) {
        console.log('Сбор событий...');
        result.events = await timed('events', () => collectEvents(page));
      }

      if (shouldCollect('resume')) {
        console.log('Сбор краткой справки...');
        result.resume = await timed('resume', () => collectResume(page));
      }

      // ---------- Детальные ЮЛ/ИП ----------

      if (options?.arbitrDetails && shouldCollect('arbitration_details')) {
        console.log('Сбор детального арбитража...');
        result.arbitration_details = await timed('arbitration_details', () =>
          collectArbitrDetails(page, companyId as number, {
            maxPages: options.maxPages,
            maxTotalCases: options.maxTotalCases,
            filters: options.filters,
          })
        );
      }

      if (options?.connectionsDetails && shouldCollect('connections_details')) {
        console.log('Сбор детальных связей...');
        result.connections_details = await timed('connections_details', () =>
          collectConnectionsDetails(page, companyId as number)
        );
      }

      if (options?.souDetails && shouldCollect('sou_details')) {
        console.log('Сбор детальных судов общей юрисдикции...');
        result.sou_details = await timed('sou_details', () =>
          collectSouDetails(page, companyId as number, {
            maxPages: options.souFilters?.maxPages || 1,
            maxTotalCases: options.souFilters?.maxTotalCases || 100,
            filters: options.souFilters,
          })
        );
      }

      if (options?.trademarksDetails && shouldCollect('trademarks_details')) {
        console.log('Сбор детальных товарных знаков...');
        result.trademarks_details = await timed('trademarks_details', () =>
          collectTrademarksDetails(page, companyId as number, {
            maxPages: options.trademarksFilters?.maxPages || 1,
            maxTotalCases: options.trademarksFilters?.maxTotalCases || 100,
            filters: options.trademarksFilters,
          })
        );
      }

      if (options?.leasingDetails && shouldCollect('leasing_details')) {
        console.log('Сбор детального лизинга...');
        result.leasing_details = await timed('leasing_details', () =>
          collectLeasingDetails(page, companyId as number, {
            maxPages: options.leasingFilters?.maxPages || 1,
            maxTotalCases: options.leasingFilters?.maxTotalCases || 100,
            filters: options.leasingFilters,
          })
        );
      }

      if (options?.pledgesDetails && shouldCollect('pledges_details')) {
        console.log('Сбор детальных залогов...');
        result.pledges_details = await timed('pledges_details', () =>
          collectPledgesDetails(page, companyId as number, {
            maxPages: options.pledgesFilters?.maxPages || 1,
            maxTotalCases: options.pledgesFilters?.maxTotalCases || 100,
            filters: options.pledgesFilters,
          })
        );
      }

      if (options?.factsDetails && shouldCollect('facts_details')) {
        console.log('Сбор детальных существенных фактов...');
        result.facts_details = await timed('facts_details', () =>
          collectFactsDetails(page, companyId as number, {
            maxPages: options.factsFilters?.maxPages || 1,
            maxTotalCases: options.factsFilters?.maxTotalCases || 100,
            filters: options.factsFilters,
          })
        );
      }

      if (options?.bankruptcyDetails && shouldCollect('bankruptcy_details')) {
        console.log('Сбор детального банкротства...');
        result.bankruptcy_details = await timed('bankruptcy_details', () =>
          collectBankruptcyDetails(page, companyId as number, {
            maxPages: options.bankruptcyFilters?.maxPages || 1,
            maxTotalCases: options.bankruptcyFilters?.maxTotalCases || 100,
            search: options.bankruptcyFilters?.search,
          })
        );
      }

      if (options?.foundersDetails && shouldCollect('founders_details')) {
        console.log('Сбор детальных учредителей...');
        result.founders_details = await timed('founders_details', () =>
          collectFoundersDetails(page, companyId as number, {
            maxPages: options.foundersFilters?.maxPages || 1,
            maxTotalCases: options.foundersFilters?.maxTotalCases || 100,
            filters: options.foundersFilters,
          })
        );
      }

      if (options?.reliabilityDetails && shouldCollect('reliability_details')) {
        console.log('Сбор детальной надёжности...');
        result.reliability_details = await timed('reliability_details', () =>
          collectReliabilityDetails(page, companyId as number)
        );
      }

      if (options?.sanctionsDetails && shouldCollect('sanctions_details')) {
        console.log('Сбор детальных санкций...');
        result.sanctions_details = await timed('sanctions_details', () =>
          collectSanctionsDetails(page, companyId as number)
        );
      }

      if (options?.gzDetails && shouldCollect('gz_details')) {
        console.log('Сбор детальных госзакупок...');
        result.gz_details = await timed('gz_details', () =>
          collectGzDetails(page, companyId as number, {
            maxPages: options.gzFilters?.maxPages || 1,
            maxTotalCases: options.gzFilters?.maxTotalCases || 100,
            filters: options.gzFilters,
          })
        );
      }

      if (options?.fsspDetails && shouldCollect('fssp_details')) {
        console.log('Сбор детальных исполнительных производств...');
        result.fssp_details = await timed('fssp_details', () =>
          collectFsspDetails(page, companyId as number, {
            maxPages: options.fsspFilters?.maxPages || 1,
            maxTotalCases: options.fsspFilters?.maxTotalCases || 100,
            filters: options.fsspFilters,
          })
        );
      }

      if (options?.inspectionsDetails && shouldCollect('inspections_details')) {
        console.log('Сбор детальных проверок...');
        result.inspections_details = await timed('inspections_details', () =>
          collectInspectionsDetails(page, companyId as number, {
            maxPages: options.inspectionsFilters?.maxPages || 1,
            maxTotalCases: options.inspectionsFilters?.maxTotalCases || 100,
            filters: options.inspectionsFilters,
          })
        );
      }

      if (options?.licensesDetails && shouldCollect('licenses_details')) {
        console.log('Сбор детальных лицензий...');
        result.licenses_details = await timed('licenses_details', () =>
          collectLicensesDetails(page, companyId as number, {
            maxPages: options.licensesFilters?.maxPages || 1,
            maxTotalCases: options.licensesFilters?.maxTotalCases || 100,
            filters: options.licensesFilters,
          })
        );
      }

      if (options?.branchesDetails && shouldCollect('branches_details')) {
        console.log('Сбор детальных филиалов и представительств...');
        result.branches_details = await timed('branches_details', () =>
          collectBranchesDetails(page, companyId as number)
        );
      }

      if (options?.historyDetails && shouldCollect('history_details')) {
        console.log('Сбор детальной истории...');
        result.history_details = await timed('history_details', () =>
          collectHistoryDetails(page, companyId as number, {
            maxPages: options.historyFilters?.maxPages || 1,
            maxTotalCases: options.historyFilters?.maxTotalCases || 100,
            filters: options.historyFilters,
          })
        );
      }

      if (options?.requisitesDetails && shouldCollect('requisites_details')) {
        console.log('Сбор детальных реквизитов...');
        result.requisites_details = await timed('requisites_details', () =>
          collectRequisitesDetails(page, companyId as number)
        );
      }

      if (options?.okvedDetails && shouldCollect('okved_details')) {
        console.log('Сбор детальных видов деятельности...');
        result.okved_details = await timed('okved_details', () =>
          collectOkvedDetails(page, companyId as number)
        );
      }

      if (options?.egrulDetails && shouldCollect('egrul_details')) {
        console.log('Сбор выписки из ЕГРЮЛ/ЕГРИП...');
        result.egrul_details = await timed('egrul_details', () =>
          collectEgrulDetails(page, companyId as number, {
            entityType,
            ogrn: result.summary?.ogrnip || result.summary?.ogrn || '',
          })
        );
      }
    }

    // ============ ДЕТАЛЬНЫЕ РАЗДЕЛЫ ФЛ ============
    if (entityType === 'person') {
      const slug = String(companyId);

      if (options?.personCeoDetails && shouldCollect('person_ceo_details')) {
        console.log('Сбор руководителя (ФЛ)...');
        result.person_ceo_details = await timed('person_ceo_details', () =>
          collectPersonCeoDetails(page, slug)
        );
      }

      if (options?.personFounderDetails && shouldCollect('person_founder_details')) {
        console.log('Сбор учредителя (ФЛ)...');
        result.person_founder_details = await timed('person_founder_details', () =>
          collectPersonFounderDetails(page, slug)
        );
      }

      if (options?.personConnectionsDetails && shouldCollect('person_connections_details')) {
        console.log('Сбор связей (ФЛ)...');
        result.person_connections_details = await timed('person_connections_details', () =>
          collectPersonConnectionsDetails(page, slug)
        );
      }

      if (options?.personReliabilityDetails && shouldCollect('person_reliability_details')) {
        console.log('Сбор факторов риска (ФЛ)...');
        result.person_reliability_details = await timed('person_reliability_details', () =>
          collectPersonReliabilityDetails(page, slug)
        );
      }

      if (options?.personHistoryDetails && shouldCollect('person_history_details')) {
        console.log('Сбор истории (ФЛ)...');
        result.person_history_details = await timed('person_history_details', () =>
          collectPersonHistoryDetails(page, slug)
        );
      }
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