// ============ Suggest API (судьи) ============

export interface JudgeSuggestion {
  CourtTag: string;
  CourtName: string;
  Post: string;
  Id: string;      // UUID
  Name: string;    // 'Соловцов С. Н.'
}

export interface JudgeSuggestResponse {
  Result: {
    Items: JudgeSuggestion[];
    Count: number;
  };
  Message: string;
  Success: boolean;
  ServerDate: string;
}

export interface JudgesDirectoryOptions {
  ratePerSecond?: number;   // default 1
  maxRequests?: number;     // default 10000 (страховка)
  onProgress?: (info: JudgesProgressInfo) => void;
  signal?: AbortSignal;     // для отмены
}

export interface JudgesProgressInfo {
  prefix: string;
  status: 'pending' | 'in_progress' | 'done' | 'error';
  itemsFound: number;
  totalDone: number;
  totalPending: number;
  judgesTotal: number;
  courtsTotal: number;
  lastError?: string;
}

// ============ Search API (дела) ============

export interface KadArbitrCounterparty {
  name: string;
  inn?: string;
  address?: string;
  type: 'company' | 'person' | 'unknown';
  hidden_data?: boolean;   // «Данные скрыты» — физлицо без ИНН
}

export type KadArbitrCaseType = 'civil' | 'administrative' | 'bankruptcy' | 'other';

export interface KadArbitrCase {
  case_number: string;       // 'А40-283283/2026'
  case_uuid: string;         // UUID для ссылки на карточку
  case_type: KadArbitrCaseType;
  filing_date: string;       // ISO
  court: string;             // 'АС города Москвы'
  judge?: string;            // 'Романенкова С. В.'
  plaintiffs: KadArbitrCounterparty[];
  respondents: KadArbitrCounterparty[];
  hidden_plaintiffs_count?: number;
  hidden_respondents_count?: number;
}

export interface KadArbitrSearchOptions {
  maxPages?: number;         // default 5
  maxTotalCases?: number;    // default 500
  roles?: Array<'plaintiff' | 'defendant' | 'third_party' | 'any'>;
  dateFrom?: string | null;  // ISO
  dateTo?: string | null;
}

export interface KadArbitrSearchPayload {
  Page: number;
  Count: number;
  Courts: string[];
  DateFrom: string | null;
  DateTo: string | null;
  Judges: string[];
  CaseNumbers: string[];
  Sides: Array<{ Name: string; Type: number; ExactMatch: boolean }>;
  WithVKSInstances: boolean;
}

export interface KadArbitrData {
  entity_inn: string;
  collected_at: string;
  source_url: string;
  search_params: {
    date_from: string | null;
    date_to: string | null;
    roles: string[];
  };
  totals: {
    cases_found: number;
    cases_collected: number;
    pages_count: number;
  };
  cases: KadArbitrCase[];
}