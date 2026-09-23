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
  type: 'company' | 'entrepreneur' | 'person' | 'unknown';
  hidden_data?: boolean;
  rusprofile_id?: string;   // "id:3350222" — из href rusprofile
}

export type KadArbitrCaseType = 'civil' | 'administrative' | 'bankruptcy' | 'other';

export interface KadArbitrCase {
  case_number: string;
  case_uuid: string;
  case_type: 'civil' | 'administrative' | 'bankruptcy' | 'other';
  filing_date: string;
  court: string;
  judge?: string;
  plaintiffs: KadArbitrCounterparty[];
  respondents: KadArbitrCounterparty[];
  third_parties?: KadArbitrCounterparty[];               // НОВОЕ
  hidden_plaintiffs_count?: number;
  hidden_respondents_count?: number;
  extra_observations?: Array<{ attribute: string; value: string }>;   // НОВОЕ
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

// ============ Card API (карточка дела) ============

export type KadArbitrEventType =
  | 'filing'     // Заявление, исковое заявление
  | 'hearing'    // Судебное заседание
  | 'decision'   // Решение
  | 'ruling'     // Определение
  | 'appeal'     // Апелляционная жалоба
  | 'cassation'  // Кассационная жалоба
  | 'other';

export interface KadArbitrCardSide {
  side_uuid: string;      // UUID из /SideCard/{uuid}
  name: string;
  address?: string;
}

export interface KadArbitrCardSides {
  plaintiffs: KadArbitrCardSide[];
  respondents: KadArbitrCardSide[];
  third_parties: KadArbitrCardSide[];
  others: KadArbitrCardSide[];
}

export interface KadArbitrCardEvent {
  event_uuid?: string;         // data-id; может быть пусто (напр., у Заявления)
  event_date: string;          // ISO YYYY-MM-DD
  event_type: KadArbitrEventType;
  event_type_raw: string;      // "Определение", "Заявление", ...
  content?: string;
  document_url?: string;
  publish_date?: string;       // "11.09.2026 г. 17:14:31 МСК"
  publish_url?: string;
  judge?: string;              // ФИО (только если есть js-judges-rolloverHtml)
  judge_role?: string;         // "Судья-докладчик"
  judge_panel?: string;        // "Судебный состав № 3"
  additional_info?: string;    // "Заявление № б/н от 04.09.2026 . Сумма исковых требований 544070,23"
  amount?: string;             // из additional_info
  declarer?: string;           // заявитель, если это не судья
  // НОВОЕ — извлекается из .case-subject (определения об отложении и т.п.)
  hearing_date?: string;       // ISO YYYY-MM-DD
  hearing_time?: string;       // "HH:MM"
  hearing_place?: string;      // "зал 304" или "комн. 201"
  hearing_judges?: string[];
}

export interface KadArbitrCardInstance {
  instance_uuid: string;       // data-id
  case_number: string;         // .b-case-instance-number
  court_name: string;          // .instantion-name a
  court_href?: string;
  court_tag?: string;          // data-court ("MSK", "ASMO", ...)
  level: string;               // "Первая инстанция", "Апелляционная инстанция", ...
  judges?: string[];           // из #gr_case_judges (только у первой инстанции в SSR)
  events: KadArbitrCardEvent[];
}

export interface KadArbitrCard {
  case_uuid: string;
  case_number: string;
  case_type: KadArbitrCaseType;
  category?: string;           // "экономические споры по гражданским правоотношениям"
  status?: string;             // "Рассматривается в первой инстанции"
  duration_days?: number;      // 18
  filing_date?: string;        // ISO
  sides: KadArbitrCardSides;
  instances: KadArbitrCardInstance[];
  collected_at: string;
  source_url: string;
}

export interface KadArbitrCardOptions {
  expandAllInstances?: boolean;   // default true — раскрывать хронологию
  rateDelayMs?: number;           // default 2000 — пауза после клика
}