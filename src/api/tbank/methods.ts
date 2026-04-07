import { getBondType, IBond, RealExchange, SecurityTradingStatus, TIBond } from './types';

export const getSeverity = (bond: IBond) => {
  switch (bond.tradingStatus) {

    case 'SECURITY_TRADING_STATUS_UNSPECIFIED':
      // Торговый статус не определен. 0
      return 'warning';

    case 'SECURITY_TRADING_STATUS_NOT_AVAILABLE_FOR_TRADING':
      // Недоступен для торгов. 1
      return 'danger';

    case 'SECURITY_TRADING_STATUS_OPENING_PERIOD':
      // Период открытия торгов. 2
      return 'success';

    case 'SECURITY_TRADING_STATUS_CLOSING_PERIOD':
      // Период закрытия торгов.3
      return 'success';

    case 'SECURITY_TRADING_STATUS_BREAK_IN_TRADING':
      // Перерыв в торговле. 4 
      return 'danger';

    case 'SECURITY_TRADING_STATUS_NORMAL_TRADING':
      // Нормальная торговля. 5
      return 'success';

    case 'SECURITY_TRADING_STATUS_CLOSING_AUCTION':
      // Аукцион закрытия. 6
      return 'success';

    case 'SECURITY_TRADING_STATUS_DARK_POOL_AUCTION':
      // Аукцион крупных пакетов. 7 
      return 'warning';

    case 'SECURITY_TRADING_STATUS_DISCRETE_AUCTION':
      // Дискретный аукцион. 8 
      return 'warning';
    
    case 'SECURITY_TRADING_STATUS_OPENING_AUCTION_PERIOD':
      // Аукцион открытия. 9 
      return 'success';

    case 'SECURITY_TRADING_STATUS_TRADING_AT_CLOSING_AUCTION_PRICE':
      // Период торгов по цене аукциона закрытия. 10 
      return 'success';

    case 'SECURITY_TRADING_STATUS_SESSION_ASSIGNED':
      // Сессия назначена. 11 
      return 'warning';

    case 'SECURITY_TRADING_STATUS_SESSION_CLOSE':
      // Сессия закрыта. 12 
      return 'danger';

    case 'SECURITY_TRADING_STATUS_SESSION_OPEN':
      // Сессия открыта. 13 
      return 'success';

    case 'SECURITY_TRADING_STATUS_DEALER_NORMAL_TRADING':
      // Доступна торговля в режиме внутренней ликвидности брокера. 14 
      return 'success';

    case 'SECURITY_TRADING_STATUS_DEALER_BREAK_IN_TRADING':
      // Перерыв торговли в режиме внутренней ликвидности брокера. 15 
      return 'success';

    case 'SECURITY_TRADING_STATUS_DEALER_NOT_AVAILABLE_FOR_TRADING':
      // Недоступна торговля в режиме внутренней ликвидности брокера. 16 
      return 'success';

    default:
      return null;
  }
};

export const getStatus = (bond: IBond) => {
  switch (bond.tradingStatus) {

    case 'SECURITY_TRADING_STATUS_UNSPECIFIED':
      // Торговый статус не определен. 0
      return 'не определен';

    case 'SECURITY_TRADING_STATUS_NOT_AVAILABLE_FOR_TRADING':
      // Недоступен для торгов. 1
      return 'недоступно';

    case 'SECURITY_TRADING_STATUS_OPENING_PERIOD':
      // Период открытия торгов. 2
      return 'период открытия';

    case 'SECURITY_TRADING_STATUS_CLOSING_PERIOD':
      // Период закрытия торгов.3
      return 'период закрытия';

    case 'SECURITY_TRADING_STATUS_BREAK_IN_TRADING':
      // Перерыв в торговле. 4 
      return 'перерыв';

    case 'SECURITY_TRADING_STATUS_NORMAL_TRADING':
      // Нормальная торговля. 5
      return 'доступно для торговли';

    case 'SECURITY_TRADING_STATUS_CLOSING_AUCTION':
      // Аукцион закрытия. 6
      return 'аукцион закрытия';

    case 'SECURITY_TRADING_STATUS_DARK_POOL_AUCTION':
      // Аукцион крупных пакетов. 7 
      return 'аукцион крупных пакетов';

    case 'SECURITY_TRADING_STATUS_DISCRETE_AUCTION':
      // Дискретный аукцион. 8 
      return 'дискретный аукцион';
    
    case 'SECURITY_TRADING_STATUS_OPENING_AUCTION_PERIOD':
      // Аукцион открытия. 9 
      return 'аукцион открытия';

    case 'SECURITY_TRADING_STATUS_TRADING_AT_CLOSING_AUCTION_PRICE':
      // Период торгов по цене аукциона закрытия. 10 
      return 'по цене аукциона закрытия';

    case 'SECURITY_TRADING_STATUS_SESSION_ASSIGNED':
      // Сессия назначена. 11 
      return 'сессия назначена';

    case 'SECURITY_TRADING_STATUS_SESSION_CLOSE':
      // Сессия закрыта. 12 
      return 'сессия закрыта';

    case 'SECURITY_TRADING_STATUS_SESSION_OPEN':
      // Сессия открыта. 13 
      return 'сессия открыта';

    case 'SECURITY_TRADING_STATUS_DEALER_NORMAL_TRADING':
      // Доступна торговля в режиме внутренней ликвидности брокера. 14 
      return 'режим внутренней ликвидности';

    case 'SECURITY_TRADING_STATUS_DEALER_BREAK_IN_TRADING':
      // Перерыв торговли в режиме внутренней ликвидности брокера. 15 
      return 'перерыв режима внутренней ликвидности';

    case 'SECURITY_TRADING_STATUS_DEALER_NOT_AVAILABLE_FOR_TRADING':
      // Недоступна торговля в режиме внутренней ликвидности брокера. 16 
      return 'режим внутренней леквидности недоступен';

    default:
      return null;
  }
};

export function getTradingStatus(code: number) {
 
  return SecurityTradingStatus[code];
}

// Уровень риска облигации.
export enum RiskLevel {
  // Не указан.
  RISK_LEVEL_UNSPECIFIED = 0,
  // Низкий уровень риска.
  RISK_LEVEL_LOW = 1,
  // Средний уровень риска.
  RISK_LEVEL_MODERATE = 2,
  // Высокий уровень риска.
  RISK_LEVEL_HIGH = 3
}

export const getRiskLevel = (bond: IBond) => {
  switch (bond.riskLevel) {

    case 'RISK_LEVEL_UNSPECIFIED':
      // Не указан. 0
      return 0;

    case 'RISK_LEVEL_LOW':
      // Низкий уровень риска. 1
      return 3;

    case 'RISK_LEVEL_MODERATE':
      // Средний уровень риска. 2
      return 2;

    case 'RISK_LEVEL_HIGH':
      // Высокий уровень риска. 3
      return 1;

    default:
      return null;
  }
};

export const getRiskLevelText = (bond: IBond) => {
  switch (bond.riskLevel) {

    case 'RISK_LEVEL_UNSPECIFIED':
      // Не указан. 0
      return 'не указан';

    case 'RISK_LEVEL_LOW':
      // Низкий уровень риска. 1
      return 'низкий риск';

    case 'RISK_LEVEL_MODERATE':
      // Средний уровень риска. 2
      return 'средний риск';

    case 'RISK_LEVEL_HIGH':
      // Высокий уровень риска. 3
      return 'высокий риск';

    default:
      return null;
  }
};

export function getRealExchange(code: number) {
  return RealExchange[code];
}

export function convertTIBond(bond: TIBond): IBond {
  const bondType = getBondType(bond.bondType); //console.log(bondType);
  
  let result: IBond = {
    // FIGI-идентификатор инструмента. 1
    figi: bond.figi,
    // Тикер инструмента. 2
    ticker: bond.ticker,
    // Класс-код (секция торгов). 3
    classCode: bond.classCode,
    // ISIN-код инструмента. 4
    isin: bond.isin,
    // Лотность инструмента. Возможно совершение операций только на количества ценной бумаги, кратные параметру `lot`. [Подробнее](./glossary#lot). 5
    lot: bond.lot,
    // Валюта расчетов. 6
    currency: bond.currency,
    // Признак доступности для операций в шорт. 13
    shortEnabledFlag: bond.shortEnabledFlag,
    // Название инструмента. 14
    name: bond.name,
    // Tорговая площадка (секция биржи). 16
    exchange: bond.exchange,
    // Количество выплат по купонам в год. 17
    couponQuantityPerYear: bond.couponQuantityPerYear,
    // Дата погашения облигации по UTC. 18
    maturityDate: bond.maturityDate,
    // Номинал облигации. 19
    nominal: {
      currency: bond.nominal?.currency,
      units: String(bond.nominal?.units),
      nano: bond.nominal?.nano
    },
    // Первоначальный номинал облигации. 20
    initialNominal: {
      currency: bond.initialNominal?.currency,
      units: String(bond.initialNominal?.units),
      nano: bond.initialNominal?.nano
    },
    // Дата выпуска облигации по UTC. 21
    stateRegDate: bond.stateRegDate,
    // Дата размещения по UTC. 22
    placementDate: bond.placementDate,
    // Цена размещения. 23
    placementPrice: {
      currency: bond.placementPrice?.currency,
      units: String(bond.placementPrice?.units),
      nano: bond.placementPrice?.nano
    },
    // Значение НКД (накопленного купонного дохода) на дату. 24
    aciValue: {
      currency: bond.aciValue?.currency,
      units: String(bond.aciValue?.units),
      nano: bond.aciValue?.nano
    },
    // Код страны риска — то есть страны, в которой компания ведет основной бизнес. 25
    countryOfRisk: bond.countryOfRisk,
    // Наименование страны риска — то есть страны, в которой компания ведет основной бизнес. 26
    countryOfRiskName: bond.countryOfRiskName,
    // Сектор экономики. 27
    sector: bond.sector,
    // Форма выпуска. Возможные значения: <br/>**documentary** — документарная; <br/>**non_documentary** — бездокументарная. 28
    issueKind: bond.issueKind,
    // Размер выпуска. 29
    issueSize: String(bond.issueSize),
    // Плановый размер выпуска. 30
    issueSizePlan: String(bond.issueSizePlan),
    // Текущий режим торгов инструмента. 31
    tradingStatus: SecurityTradingStatus[bond.tradingStatus],
    // Флаг, используемый ранее для определения внебиржевых инструментов. На данный момент не используется для торгуемых через API инструментов. Может использоваться как фильтр для операций, совершавшихся некоторое время назад на ОТС площадке. 32
    otcFlag: bond.otcFlag,
    // Признак доступности для покупки. 33
    buyAvailableFlag: bond.buyAvailableFlag,
    // Признак доступности для продажи. 34
    sellAvailableFlag: bond.sellAvailableFlag,
    // Признак облигации с плавающим купоном. 35
    floatingCouponFlag: bond.floatingCouponFlag,
    // Признак бессрочной облигации. 36
    perpetualFlag: bond.perpetualFlag,
    // Признак облигации с амортизацией долга. 37
    amortizationFlag: bond.amortizationFlag,
    // Шаг цены. 38
    minPriceIncrement: {
      units: String(bond?.minPriceIncrement?.units) || '0',
      nano: bond?.minPriceIncrement?.nano || 0,
    },
    // Параметр указывает на возможность торговать инструментом через API. 39
    apiTradeAvailableFlag: bond.apiTradeAvailableFlag,
    // Уникальный идентификатор инструмента. 40
    uid: bond.uid,
    // Реальная площадка исполнения расчетов. (биржа) 41
    realExchange: RealExchange[bond.realExchange],
    // Уникальный идентификатор позиции инструмента. 42
    positionUid: bond.positionUid,
    // Уникальный идентификатор актива. 43
    assetUid: bond.assetUid,
    // Тесты, которые необходимо пройти клиенту, чтобы совершать сделки по инструменту. 44
    requiredTests: bond.requiredTests,
    // Признак доступности для ИИС. 51
    forIisFlag: bond.forIisFlag,
    // Флаг, отображающий доступность торговли инструментом только для квалифицированных инвесторов. 52
    forQualInvestorFlag: bond.forQualInvestorFlag,
    // Флаг, отображающий доступность торговли инструментом по выходным. 53
    weekendFlag: bond.weekendFlag,
    // Флаг заблокированного ТКС. 54
    blockedTcaFlag: bond.blockedTcaFlag,
    // Признак субординированной облигации. 55
    subordinatedFlag: bond.subordinatedFlag,
    // Флаг достаточной ликвидности. 56
    liquidityFlag: bond.liquidityFlag,
    // Дата первой минутной свечи. 61
    first1minCandleDate: bond.first1dayCandleDate,
    // Дата первой дневной свечи. 62
    first1dayCandleDate: bond.first1dayCandleDate,
    // Уровень риска. 63
    riskLevel: RiskLevel[bond.riskLevel],
    // Информация о бренде. 64
    brand: {
      logoName: 'https://invest-brands.cdn-tinkoff.ru/' + bond.brand?.logoName.replace('.png','') + 'x160.png', // подмена пути
      logoBaseColor: bond.brand?.logoBaseColor,
      textColor: bond.brand?.textColor,
    },
    // Тип облигации. 65
    bondType: bondType,
  }
  return result;
}
