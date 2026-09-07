// src/main/services/osint/scrapers/rusprofile/types.ts

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
  bankruptcy_details?: any;
  founders_details?: any;
  reliability_details?: any;
  sanctions_details?: any;
  gz_details?: any;
  fssp_details?: any;
  inspections_details?: any;
  licenses_details?: any;
  branches_details?: any;
  history_details?: any;
  requisites_details?: any;
  okved_details?: any;
  egrul_details?: any;
}