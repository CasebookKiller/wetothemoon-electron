import * as RU from '@/locale/ru.json';

import { FC, useEffect, useState } from 'react';

import { addLocale, locale as Locale  } from 'primereact/api';
import { Rating } from 'primereact/rating';
import { FloatLabel } from 'primereact/floatlabel';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { DataScroller } from 'primereact/datascroller';

import { IBond, TIBond } from '@/api/tbank/types';
import { convertTIBond, getRiskLevel, getRiskLevelText, getSeverity, getStatus } from '@/api/tbank/methods';

import { useAuth } from '@/hooks/useAuth';
import { useBonds } from '@/hooks/useBonds';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import { fetchBond, fetchBonds } from '@/shared/utils/common';

import { Link } from '@/components/COMMON/Link/Link';
import { BookmarkButton } from '@/components/BONDS/BookmarkButton/BookmarkButton';

import { fetchBonds as Bonds } from '@root/api/public';

import './BondsScroller.css';
import { ProgressSpinner } from 'primereact/progressspinner';
import { parseTokens } from '@root/api/methods';
import { Avatar } from 'primereact/avatar';


const HOST = import.meta.env.VITE_HOST;
const PORT = import.meta.env.VITE_PORT;

interface IBondsScrollerProps {
  bonds?: IBond[];
}

export const BondsScroller:FC<IBondsScrollerProps> = (_props) =>{
  // _props пока не используется, если его передавать в параметрах, то внутри не должно быть загрузки
  const {bonds, setBonds, filteredData, setFilteredData, searchTerm, setSearchTerm} = useBonds();

  const { user } = useAuth();
  const { getItem } = useLocalStorage();
    
  const [
    //fullaccess
    , setFullAccess] = useState<string>();
  const [
    //readonly
    , setReadOnly] = useState<string>();
  const [
    //sandbox
    , setSandBox] = useState<string>();

  const [bondDialog, setBondDialog] = useState<boolean>(false);
  const [bond, setBond] = useState<IBond | null>(null);
        
  useEffect(() => {
    const data = getItem('tokens');
    const ttoken = parseTokens(data);

    // Получение облигаций через сервер
    false && getBonds(ttoken);

    // Получение списка облигаций через web
    Bonds(ttoken).then(res => {
      let bonds: IBond[] = [];
      res.forEach((bond: any) => {
        bonds.push(convertTIBond(bond));
      });
      console.log('...bonds: ', bonds);
      setBonds(bonds);
    });
    
  }, []);

  // Получение облигаций через сервер
  function getBonds(ttoken: string) {
    if (!user?.token) return;
    if (ttoken !== '') fetchBonds(`http://${HOST}:${PORT}/getBonds`, ttoken, user?.token)
    .then(res => {
      return res.json();
    }).then(res => {
      let bonds: IBond[] = [];
      res.forEach((bond: TIBond) => {
        bonds.push(convertTIBond(bond));
      })
      console.log('bonds', bonds);
      setBonds(bonds);
    });
  }

  async function getBond(ticker: string, classcode: string) {
    const data = getItem('tokens');
    const tokens = typeof data === 'string' ? JSON.parse(data || '{}') : data; 
    
    if (data) {
      if (tokens.fullaccess) setFullAccess(tokens.fullaccess);
      if (tokens.readonly) setReadOnly(tokens.readonly);
      if (tokens.sandbox) setSandBox(tokens.sandbox);
      
    }
    if (tokens.readonly === '' && tokens.fullaccess === '' && tokens.sandbox === '') return;
    const ttoken = tokens.readonly !== '' ? tokens.readonly : tokens.fullaccess !== '' ? tokens.fullaccess : tokens.sandbox !== '' ? tokens.sandbox : '';
      
    if (!user?.token) return;
    console.log('next fetchBonds()');
    console.log('ttoken', ttoken);
    console.log('user?.token', user?.token);
    if (ttoken === '' || ticker === '' || classcode === '') return;
    
    const res = await fetchBond(`http://${HOST}:${PORT}/getBond`, ticker, classcode, ttoken, user?.token)
    if (!res.ok) return;
    const ibond: IBond = convertTIBond(await res.json());
    console.log(ibond);
    setBond(ibond);
  }

  // Фильтрация данных по полю name
  useEffect(() => {
    if (!bonds) return;
    if (!searchTerm.trim()) return setFilteredData(bonds);
      
    const filteredItems = bonds.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredData(filteredItems);
  }, [searchTerm, bonds]);

  useEffect(() => {
    //BondsService.getProducts(props.bonds).then((data) => setBonds(data));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const BondTemplate = (bond: IBond) => {
    
    return (
      <div
        id={bond.isin}
        className='col-12'
      >
        <div className='flex flex-column md:flex-row md:align-items-start gap-1' style={{minWidth: '300px'}}>
          <div className='flex overflow-hidden flex-column sm:flex-row justify-content-between align-items-top md:align-items-start sm:flex-1 gap-1'>
            <Link to={`/catalog/bond/${bond.classCode}/${bond.isin}`}>
              <div
                onClick={()=>{
                  //setBond(bond);
                  //setBondDialog(true);
                }}
                className='flex flex-column align-items-center sm:align-items-start gap-1'
              >
                <div className='flex align-items-center'>
                  <div className='flex-shrink-0'>
                    <Avatar shape='circle' image={bond.brand.logoName} />
                  </div>
                  <div className='ml-2 flex-grow-1'>
                    <div className='font-bold text-md'>{bond.name}</div>
                    <div className=''>{bond.isin}</div>
                    <div className='flex-grow-1 align-items-center gap-1'>
                      <Rating
                        className={'bonds'}
                        value={getRiskLevel(bond) ?? 0}
                        alt={getRiskLevelText(bond) ?? ''}
                        readOnly
                        cancel={false}
                        stars={3}
                      />
                    </div>
                  </div>
                  
                </div>
                {/*<div className='flex flex-column gap-1'>
                  <div className='text-md font-bold'>{bond.name}</div>
                  <div className=''>{bond.isin}</div>
                </div>
                <div className='flex flex-column gap-1'>
                  <span className='flex align-items-center gap-1'>
                    <Rating
                      className={'bonds'}
                      value={getRiskLevel(bond) ?? 0}
                      alt={getRiskLevelText(bond) ?? ''}
                      readOnly
                      cancel={false}
                      stars={3}
                    />
                  </span>
                </div>
                */}
                <div className='flex flex-column gap-1'>
                  <div
                    style={{
                      color:
                        getSeverity(bond) === 'danger' ? 
                          'var(--tg-theme-destructive-text-color)'
                        :
                          getSeverity(bond) === 'warning' ?
                            'var(--tg-theme-hint-color)'
                          : 'var(--tg-theme-accent-text-color)'
                    }}
                  >
                    <div className='flex align-items-center mt-1'>
                      <div className='align-items-center'>
                        <i className={
                          getSeverity(bond) === 'danger' ?
                            'pi pi-ban'
                          : 
                            getSeverity(bond) === 'warning' ?
                              'pi pi-wave-pulse'
                            :
                              'pi pi-check'}
                            />
                      </div>
                      <div className='flex px-1'>
                        {getStatus(bond)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
            <div className='flex w-4 flex-row sm:flex-column align-items-center sm:align-items-end gap-1 md:gap-1'>
              <span className='text-md font-semibold'>{Number(bond.nominal.units).toLocaleString('ru-RU')} ₽</span>
              <BookmarkButton isin={bond.isin} />
              
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lng = 'ru';

  addLocale(lng, RU.ru);
  Locale(lng);

  return (
    <div className='card'>
    <div className='card flex justify-content-center'>
      <Dialog
        header={bond?.name}
        visible={bondDialog}
        maximized
        style={{ width: '100vw', height: '100vh' }}
        onHide={() => {if (!bondDialog) return; setBondDialog(false); }}
        baseZIndex={9000}
        onShow={()=>{
          if (bond) getBond(bond.ticker, bond.classCode);
        }}
      >
        <div className='m-0'>
          {bond && Object.keys(bond).map((key, index) => {
            const ibond: IBond = bond as IBond;
            const keyTyped = key as keyof IBond;
            const value = typeof ibond[keyTyped] === 'object' ? JSON.stringify(ibond[keyTyped]) : ibond[keyTyped];
    
            if (keyTyped === 'figi') return null; //"figi": "BBG00XH4W3N3",
            if (keyTyped === 'ticker') return null; //"ticker": "RU000A101RZ3",
            if (keyTyped === 'classCode') return ( //"classCode": "TQCB",
              <div key={index} className='m-1 border-bottom-1'>
                {'Режим торгов'}: {value?.toString()}<br/>
              </div>
            );
            if (keyTyped === 'isin') return ( //"isin": "RU000A101RZ3",
              <div key={index} className='m-1 border-bottom-1'>
                {'ISIN'}: {value?.toString()}<br/>
              </div>
            );
            if (keyTyped === 'lot') return ( //"lot": 1,
              <div key={index} className='m-1 border-bottom-1'>
                {keyTyped}: {value?.toString()}<br/>
              </div>
            );
            if (keyTyped === 'currency') return ( //"currency": "rub",
              <div key={index} className='m-1 border-bottom-1'>
                {keyTyped}: {value?.toString()}<br/>
              </div>
            ); 
            //"shortEnabledFlag": false,
            //"name": "Казахстан выпуск 11",
            //"exchange": "moex_plus_bonds",
            //"couponQuantityPerYear": 2,
            //"maturityDate": "2030-09-11T00:00:00.000Z",
            //"nominal": { "currency": "rub", "units": "1000", "nano": 0 },
            //"initialNominal": { "currency": "rub", "units": "1000", "nano": 0 },
            //"stateRegDate": "2020-07-16T00:00:00.000Z",
            //"placementDate": "2020-09-23T00:00:00.000Z",
            //"placementPrice": { "currency": "", "units": "0", "nano": 0 },
            //"aciValue": { "currency": "rub", "units": "28", "nano": 0 },
            //"countryOfRisk": "KZ",
            //"countryOfRiskName": "Республика Казахстан",
            //"sector": "government",
            //"issueKind": "non_documentary",
            //"issueSize": "10000000",
            //"issueSizePlan": "10000000",
            //"tradingStatus": "SECURITY_TRADING_STATUS_NOT_AVAILABLE_FOR_TRADING",
            //"otcFlag": false,
            //"buyAvailableFlag": true,
            //"sellAvailableFlag": true,
            //"floatingCouponFlag": false,
            //"perpetualFlag": false,
            //"amortizationFlag": false,
            //"minPriceIncrement": { "units": "0", "nano": 10000000 },
            //"apiTradeAvailableFlag": true,
            //"uid": "2dd3b003-aca2-4920-89ce-8d827c637372",
            //"realExchange": "REAL_EXCHANGE_MOEX",
            //"positionUid": "2c354d2c-98d0-4705-8370-92e604e31ece",
            //"assetUid": "28887b0a-20a8-409d-b895-e9831a56152e",
            //"requiredTests": [],
            //"forIisFlag": false,
            //"forQualInvestorFlag": false,
            //"weekendFlag": false,
            //"blockedTcaFlag": false,
            //"subordinatedFlag": false,
            //"liquidityFlag": true,
            //"first1minCandleDate": "2020-09-23T07:00:00.000Z",
            //"first1dayCandleDate": "2020-09-23T07:00:00.000Z",
            //"riskLevel": "RISK_LEVEL_LOW",
            if (keyTyped === 'brand') return null; //"brand": { "logoName": "RU000A101RP4.png", "logoBaseColor": "#000000", "textColor": "#ffffff" },
            //"bondType": "BOND_TYPE_UNSPECIFIED"

            // общий вывод
            return (
              <div key={index} className='m-1 border-bottom-1'>
                {keyTyped}: {value?.toString()}<br/>
              </div>
            );
          })}
        </div>    
      </Dialog>
      </div>
      {
        bonds && bonds.length > 0 ?
        <div className='p-grid p-dir-col mt-4'>
          <div className='p-col-12 my-2'>
            <FloatLabel>
              <InputText
                type='search'
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='Фильтр...' 
                value={searchTerm}
                className='profile w-full'
                id='bondsfilter'
              />
              <label htmlFor='bondsfilter'>Фильтр...</label>
            </FloatLabel>
          </div>
          <DataScroller
            value={filteredData}
            itemTemplate={BondTemplate}
            rows={10}
            inline
            scrollHeight='500px'
            className='BondsScroller'
          />
        </div>
      :
        <div className='flex align-content-center align-items-center my-3'>
          <ProgressSpinner
            style={{
              //animation: 'p-progress-spinner-rotate 5s linear infinite',
              //width: '75px',
              //height: '75px'
              margin: '0 auto'
            }}
            strokeWidth='1'
            //fill='var(--surface-ground)'
            animationDuration='.75s'
            className='BondsSpinner'
          />
        </div>
      }
    </div>
  );
}

/*
  {
    "figi": "TCS00A107D74",
    "ticker": "RU000A107D74",
    "classCode": "TQCB",
    "isin": "RU000A107D74",
    "lot": 1,
    "currency": "rub",
    "shortEnabledFlag": false,
    "name": "ЭнергоТехСервис 001P-05",
    "exchange": "unknown",
    "couponQuantityPerYear": 12,
    "maturityDate": "2025-12-02T00:00:00.000Z",
    "nominal": {
      "currency": "rub",
      "units": "0",
      "nano": 0
    },
    "initialNominal": {
      "currency": "rub",
      "units": "1000",
      "nano": 0
    },
    "stateRegDate": "2023-12-06T00:00:00.000Z",
    "placementDate": "2023-12-13T00:00:00.000Z",
    "placementPrice": {
      "currency": "rub",
      "units": "1000",
      "nano": 0
    },
    "aciValue": {
      "currency": "rub",
      "units": "0",
      "nano": 0
    },
    "countryOfRisk": "RU",
    "countryOfRiskName": "Российская Федерация",
    "sector": "industrials",
    "issueKind": "non_documentary",
    "issueSize": "1000000",
    "issueSizePlan": "1000000",
    "tradingStatus": "SECURITY_TRADING_STATUS_NOT_AVAILABLE_FOR_TRADING",
    "otcFlag": false,
    "buyAvailableFlag": true,
    "sellAvailableFlag": true,
    "floatingCouponFlag": false,
    "perpetualFlag": false,
    "amortizationFlag": true,
    "minPriceIncrement": {
      "units": "0",
      "nano": 10000000
    },
    "apiTradeAvailableFlag": false,
    "uid": "d0f5de81-daac-4cdf-94b5-90b32cb3418c",
    "realExchange": "REAL_EXCHANGE_MOEX",
    "positionUid": "14882b88-e227-4998-a23f-387d32b46540",
    "assetUid": "c154a399-451f-431b-b41e-d0c21671a2c8",
    "requiredTests": [],
    "forIisFlag": true,
    "forQualInvestorFlag": false,
    "weekendFlag": false,
    "blockedTcaFlag": false,
    "subordinatedFlag": false,
    "liquidityFlag": true,
    "riskLevel": "RISK_LEVEL_MODERATE",
    "brand": {
      "logoName": "RU000A1015S0.png",
      "logoBaseColor": "#8FAAC9",
      "textColor": "#ffffff"
    },
    "bondType": "BOND_TYPE_UNSPECIFIED"
  }
*/

/*
  {
    "classCode": "TQCB",
    "isin": "RU000A101RZ3",
    "lot": 1,
    "currency": "rub",
    "shortEnabledFlag": false,
    "name": "Казахстан выпуск 11",
    "exchange": "moex_plus_bonds",
    "couponQuantityPerYear": 2,
    "maturityDate": "2030-09-11T00:00:00.000Z",
    "nominal": {
      "currency": "rub",
      "units": "1000",
      "nano": 0
    },
    "initialNominal": {
      "currency": "rub",
      "units": "1000",
      "nano": 0
    },
    "stateRegDate": "2020-07-16T00:00:00.000Z",
    "placementDate": "2020-09-23T00:00:00.000Z",
    "placementPrice": {
      "currency": "",
      "units": "0",
      "nano": 0
    },
    "aciValue": {
      "currency": "rub",
      "units": "28",
      "nano": 0
    },
    "countryOfRisk": "KZ",
    "countryOfRiskName": "Республика Казахстан",
    "sector": "government",
    "issueKind": "non_documentary",
    "issueSize": "10000000",
    "issueSizePlan": "10000000",
    "tradingStatus": "SECURITY_TRADING_STATUS_NOT_AVAILABLE_FOR_TRADING",
    "otcFlag": false,
    "buyAvailableFlag": true,
    "sellAvailableFlag": true,
    "floatingCouponFlag": false,
    "perpetualFlag": false,
    "amortizationFlag": false,
    "minPriceIncrement": {
      "units": "0",
      "nano": 10000000
    },
    "apiTradeAvailableFlag": true,
    "uid": "2dd3b003-aca2-4920-89ce-8d827c637372",
    "realExchange": "REAL_EXCHANGE_MOEX",
    "positionUid": "2c354d2c-98d0-4705-8370-92e604e31ece",
    "assetUid": "28887b0a-20a8-409d-b895-e9831a56152e",
    "requiredTests": [],
    "forIisFlag": false,
    "forQualInvestorFlag": false,
    "weekendFlag": false,
    "blockedTcaFlag": false,
    "subordinatedFlag": false,
    "liquidityFlag": true,
    "first1minCandleDate": "2020-09-23T07:00:00.000Z",
    "first1dayCandleDate": "2020-09-23T07:00:00.000Z",
    "riskLevel": "RISK_LEVEL_LOW",
    "brand": {
      "logoName": "RU000A101RP4.png",
      "logoBaseColor": "#000000",
      "textColor": "#ffffff"
    },
    "bondType": "BOND_TYPE_UNSPECIFIED"
  }
*/