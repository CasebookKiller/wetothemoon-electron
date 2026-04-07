import { AxiosResponse } from 'axios';

import React, { FC, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Panel } from 'primereact/panel';
import { Tag } from 'primereact/tag';
import { Rating } from 'primereact/rating';
import { Button } from 'primereact/button';

import { classNames } from '@/css/classnames';

import { IBond, IBondEvent } from '@root/api/types';
import { Bond, BondEvents } from '@root/api/public';
import { getRiskLevel, getRiskLevelText, getSeverity, getStatus, parseTokens } from '@root/api/methods';

import { useLocalStorage } from '@/hooks/useLocalStorage';

import './BondDetailPage.css';

interface iedate {
  date: string;
  coupon?: IBondEvent;
  call?: IBondEvent;
  conv?: IBondEvent;
  mty?: IBondEvent;
} 

function SafeBackButton({ fallback = '/' }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <Button
      onClick={goBack}
      className='back-button shadow-5 mx-1'
      style={{
        border: '1px solid var(--tg-theme-hint-color)',
        background: 'var(--tg-theme-section-bg-color)',
        color: 'var(--tg-theme-accent-text-color)'
      }}
    >
      ← Назад
    </Button>
  );
}

export const BondDetailPage: FC = () => {
  const { classcode, isin } = useParams<{classcode: string, isin: string}>();
  const [ bond, setBond ] = useState<IBond | null>(null);
  const [ events, setEvents ] = useState<IBondEvent[]>([]);
  const [ dates, setDates ] = useState<iedate[]>([]);

  const { getItem } = useLocalStorage();

  async function getBond(ticker: string, classcode: string) {
    const stored = getItem('user');
    const user = JSON.parse(stored || '{}');
    
    const data = getItem('tokens');
    const ttoken = parseTokens(data);

    if (!user?.token) return;
    if (ttoken === '' || ticker === '' || classcode === '') return;
   
    const resaxios = await Bond(ticker, classcode, ttoken);
    const response = resaxios as AxiosResponse<any, any, {}>;

    if (response.status !== 200) return;
    const instrument: IBond = response.data.instrument;
    setBond(instrument);
  }

  async function getBondEvents(from: string, to: string, instrumentId: string, type: string) {
    const stored = getItem('user');
    const user = JSON.parse(stored || '{}');
    
    const ttoken = parseTokens(getItem('tokens'));

    if (!user?.token) return;
    if (ttoken === '' || from === '' || to === '' || instrumentId === '' || type === '') return;
    
    const resaxios = await BondEvents(from, to, instrumentId, type, ttoken);
    const response = resaxios as AxiosResponse<any, any, {}>;

    if (response.status !== 200) return;
    const ibevents: IBondEvent[] = response.data.events;

    const edates: iedate[] = [];

    ibevents.forEach((event: IBondEvent) => {
      let ed: iedate = {
        date: event.eventDate,
        coupon: undefined,
        call: undefined,
        conv: undefined,
        mty: undefined
      };
      const finded = edates.find((e: iedate) => e.date === ed.date);
      if (!finded) edates.push(ed);
    });

    ibevents.forEach((event: IBondEvent) => {
      edates.forEach((ed: iedate) => {
        if (ed.date === event.eventDate) {
          if (event.eventType === 'EVENT_TYPE_CPN') ed.coupon = event;
          if (event.eventType === 'EVENT_TYPE_CALL') ed.call = event;
          if (event.eventType === 'EVENT_TYPE_CONV') ed.conv = event;
          if (event.eventType === 'EVENT_TYPE_MTY') ed.mty = event;
        }
      });
    });

    setDates(edates);
    console.log(edates);
    setEvents(ibevents);
    //console.log(ibevents);
    
    //setEvents(events);

    //const res = await fetchBondEvents(`http://${HOST}:${PORT}/getBondEvents`, from, to, instrumentId, type, ttoken, user?.token)
    //if (!res.ok) return;
    //const events = await res.json();
    //console.log(events);
    //setEvents(events);
  }

  useEffect(() => {
    //console.log('events: ', events);
  },[events]);

  useEffect(() => {
    if (isin && classcode) getBond(isin, classcode);
    
  }, []);

  useEffect(() => {
    if (bond) {
      const fromdate = bond.first1dayCandleDate || '';
      const todate = new Date();
      const instrumentId = bond.uid;
      const type = 'EVENT_TYPE_UNSPECIFIED'; //'EVENT_TYPE_CPN';
      console.log(fromdate, todate.toISOString(), instrumentId, type);
      getBondEvents(fromdate, todate.toISOString(), instrumentId, type);
    }
  },[bond]);

  const countryOfRisk = bond?.countryOfRisk ? bond.countryOfRisk + ', ': ''; 
  const classCode = bond?.classCode ? bond.classCode + ', ': '';

  const header = (
    <div>
      <div>{bond?.name}</div>
      <div className='mt-2'>{bond && countryOfRisk + classCode + 'ISIN: ' + bond.isin}</div>
      <div className='mt-2'>{bond && <Rating
        className={'bonds'}
        value={getRiskLevel(bond) ?? 0}
        alt={getRiskLevelText(bond) ?? ''}
        readOnly
        cancel={false}
        stars={3}

      />}
      </div>
      {bond && <div
        className='flex align-items-center mt-2'
        style={{
          color:
            bond && getSeverity(bond) === 'danger' ? 
              'var(--tg-theme-destructive-text-color)'
            :
              bond && getSeverity(bond) === 'warning' ?
                'var(--tg-theme-hint-color)'
              : 'var(--tg-theme-accent-text-color)'
        }}
      >
        <div className='align-items-center'>
          <i className={
            bond && getSeverity(bond) === 'danger' ?
              'pi pi-ban'
            : 
              bond && getSeverity(bond) === 'warning' ?
                'pi pi-wave-pulse'
              :
                'pi pi-check'}
              />
        </div>
        <div className='flex px-1'>
          {bond && getStatus(bond)}
        </div>
      </div>}
    </div>
  );

  const edateslist = dates.map((d: iedate, index: number) => {
    const cpn: IBondEvent|undefined = d.coupon ? {
      instrumentId: d.coupon?.instrumentId,
      eventNumber: d.coupon?.eventNumber,
      eventDate: d.coupon?.eventDate,
      eventType: d.coupon?.eventType,
      eventTotalVol: d.coupon?.eventTotalVol,
      fixDate: d.coupon?.fixDate,
      rateDate: d.coupon?.rateDate,
      defaultDate: d.coupon?.defaultDate,
      realPayDate: d.coupon?.realPayDate,
      payDate: d.coupon?.payDate,
      payOneBond: d.coupon?.payOneBond,
      moneyFlowVal: d.coupon?.moneyFlowVal,
      execution: d.coupon?.execution,
      operationType: d.coupon?.operationType,
      value: d.coupon?.value,
      note: d.coupon?.note,
      convertToFinToolId: d.coupon?.convertToFinToolId,
      couponStartDate: d.coupon?.couponStartDate,
      couponEndDate: d.coupon?.couponEndDate,
      couponPeriod: d.coupon?.couponPeriod,
      couponInterestRate: d.coupon?.couponInterestRate, 
    } : undefined;
    const call: IBondEvent|undefined = d.call ? {
      instrumentId: d.call?.instrumentId,
      eventNumber: d.call?.eventNumber,
      eventDate: d.call?.eventDate,
      eventType: d.call?.eventType,
      eventTotalVol: d.call?.eventTotalVol,
      fixDate: d.call?.fixDate,
      rateDate: d.call?.rateDate,
      defaultDate: d.call?.defaultDate,
      realPayDate: d.call?.realPayDate,
      payDate: d.call?.payDate,
      payOneBond: d.call?.payOneBond,
      moneyFlowVal: d.call?.moneyFlowVal,
      execution: d.call?.execution,
      operationType: d.call?.operationType,
      value: d.call?.value,
      note: d.call?.note,
      convertToFinToolId: d.call?.convertToFinToolId,
      couponStartDate: d.call?.couponStartDate,
    } : undefined;
    const conv: IBondEvent|undefined = d.conv ? {
      instrumentId: d.conv?.instrumentId,
      eventNumber: d.conv?.eventNumber,
      eventDate: d.conv?.eventDate,
      eventType: d.conv?.eventType,
      eventTotalVol: d.conv?.eventTotalVol,
      fixDate: d.conv?.fixDate,
      rateDate: d.conv?.rateDate,
      defaultDate: d.conv?.defaultDate,
      realPayDate: d.conv?.realPayDate,
      payDate: d.conv?.payDate,
      payOneBond: d.conv?.payOneBond,
      moneyFlowVal: d.conv?.moneyFlowVal,
      execution: d.conv?.execution,
      operationType: d.conv?.operationType,
      value: d.conv?.value,
      note: d.conv?.note,
      convertToFinToolId: d.conv?.convertToFinToolId,
      couponStartDate: d.conv?.couponStartDate,
    } : undefined;
    const mty: IBondEvent|undefined = d.mty ? {
      instrumentId: d.mty?.instrumentId,
      eventNumber: d.mty?.eventNumber,
      eventDate: d.mty?.eventDate,
      eventType: d.mty?.eventType,
      eventTotalVol: d.mty?.eventTotalVol,
      fixDate: d.mty?.fixDate,
      rateDate: d.mty?.rateDate,
      defaultDate: d.mty?.defaultDate,
      realPayDate: d.mty?.realPayDate,
      payDate: d.mty?.payDate,
      payOneBond: d.mty?.payOneBond,
      moneyFlowVal: d.mty?.moneyFlowVal,
      execution: d.mty?.execution,
      operationType: d.mty?.operationType,
      value: d.mty?.value,
      note: d.mty?.note,
      convertToFinToolId: d.mty?.convertToFinToolId,
      couponStartDate: d.mty?.couponStartDate,
    } : undefined;

    if (cpn && !call && !conv && !mty) {
      // Купон
      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-accent',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {new Date(cpn.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-accent',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(Number(cpn.value.units) + Number(cpn.value.nano / 1000000000)).toFixed(2)} %
          </div>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-accent',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(cpn.payOneBond.units) + Number(cpn.payOneBond.nano / 1000000000)} {cpn.payOneBond.currency === 'rub' ? '₽' : cpn.payOneBond.currency}
          </div>
        </div>
      ); 
    } else if (cpn && call) {
      // Оферта
      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-1',
                'py-1',
                'border-round',
                'border-1'
              )
            }
          >
            {new Date(call.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-1',
                'py-1',
                'border-round',
                'border-1'
              )
            }
          >
            {Number(cpn.value.units) + Number(cpn.value.nano / 1000000000)} %
          </div>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-1',
                'py-1',
                'border-round',
                'border-1'
              )
            }
          >
            {Number(cpn.payOneBond.units) + Number(cpn.payOneBond.nano / 1000000000)} {cpn.payOneBond.currency === 'rub' ? '₽' : cpn.payOneBond.currency}
          </div>

        </div>
      ); 
    } else if (mty && cpn) {
      // Погашение
      console.log('%c Погашение...', 'color: red;');
      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-hint',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {new Date(cpn.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-hint',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(cpn.value.units) + Number(cpn.value.nano / 1000000000)} %
          </div>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-hint',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(cpn.payOneBond.units) + Number(cpn.payOneBond.nano / 1000000000)} {cpn.payOneBond.currency === 'rub' ? '₽' : cpn.payOneBond.currency}
          </div>
        </div>
      ); 
    } else if (conv && cpn) {
      // Конверсия
      console.log('%c Конверсия...', 'color: red;');
      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-negative',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {new Date(cpn.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-negative',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(cpn.value.units) + Number(cpn.value.nano / 1000000000)} %
          </div>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-negative',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(cpn.payOneBond.units) + Number(cpn.payOneBond.nano / 1000000000)} {cpn.payOneBond.currency === 'rub' ? '₽' : cpn.payOneBond.currency}
          </div>
        </div>
      ); 
    } else {
      return null;
    }

  })

  return (
    <React.Fragment>

      <div className='app p-0'/>

      <SafeBackButton/>
      
      <div className='app p-0'/>
      
      <Panel
        className='shadow-5 mx-1'
        header={header}
      >
        {bond && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Идентификаторы
            </span>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                uid: {bond.uid}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                ISIN: {bond.isin}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                FIGI: {bond.figi}
              </span>
            </div>
            
          </div>
        </div>}

        {bond && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Выпуск
            </span>
            {bond.countryOfRiskName && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                {'Страна:'} {bond.countryOfRiskName}
              </span>
            </div>}
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Сектор: {bond.sector?.charAt(0).toUpperCase()}{bond.sector?.slice(1)}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Регистрация: {new Date(bond.stateRegDate).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Погашение: {new Date(bond.maturityDate).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Размер: {bond.issueSize}, План: {bond.issueSizePlan}
              </span>
            </div>
          </div>
        </div>}

        {bond && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Размещение
            </span>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Дата: {new Date(bond.placementDate).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Цена: {Number(bond.placementPrice.units+'.'+bond.placementPrice.nano).toFixed(2)}, 
                Номинал: {Number(bond.initialNominal.units+'.'+bond.initialNominal.nano).toFixed(2)}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Размер лота: {bond.lot}, Валюта: {bond.currency === 'rub' ? 'руб.' : bond.currency}
              </span>
            </div>
          </div>
        </div>}

        {bond && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Купоны
            </span>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Количество в год: {bond.couponQuantityPerYear}
              </span>
            </div>
      
          </div>
        </div>}

        {bond && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Текущая стоимость
            </span>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Номинал: {Number(bond.nominal.units+'.'+bond.nominal.nano).toFixed(2)} {bond.currency === 'rub' ? 'руб.' : bond.currency}
              </span>
            </div>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                НКД: {Number(bond.aciValue.units+'.'+bond.aciValue.nano)} {bond.currency === 'rub' ? 'руб.' : bond.currency}
              </span>
            </div>
            
      
          </div>
        </div>}

        {bond && (bond?.klong||bond?.kshort||bond?.dlong||bond?.dshort||bond?.dlongMin||bond?.dshortMin||bond?.dlongClient||bond?.dshortClient) && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Ставка риска
            </span>
            {bond?.klong && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Коэф. ставки длинной поз.: {Number(bond.klong.units+'.'+bond.klong.nano).toFixed(2)}
              </span>
            </div>}
            {bond?.kshort && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Коэф. ставки короткой поз.: {Number(bond.kshort.units+'.'+bond.kshort.nano).toFixed(2)}
              </span>
            </div>}
            {bond?.dlong && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Ставка нач. маржи КСУР длин. поз.: {Number(bond.dlong.units+'.'+bond.dlong.nano).toFixed(2)}
              </span>
            </div>}
            {bond?.dshort && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Ставка нач. маржи КСУР кор. поз.: {Number(bond.dshort.units+'.'+bond.dshort.nano).toFixed(2)}
              </span>
            </div>}
            {bond?.dlongMin && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Ставка нач. маржи КПУР длин. поз.: {Number(bond.dlongMin.units+'.'+bond.dlongMin.nano).toFixed(2)}
              </span>
            </div>}
            {bond?.dshortMin && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Ставка нач. маржи КПУР кор. поз.: {Number(bond.dshortMin.units+'.'+bond.dshortMin.nano).toFixed(2)}
              </span>
            </div>}
            {bond?.dlongClient && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Ставка с учетом тек. уровня длин. поз.: {Number(bond.dlongClient.units+'.'+bond.dlongClient.nano).toFixed(2)}
              </span>
            </div>}
            {bond?.dshortClient && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                Ставка с учетом тек. уровня кор. поз.: {Number(bond.dshortClient.units+'.'+bond.dshortClient.nano).toFixed(2)}
              </span>
            </div>}
          </div>
        </div>}


        {bond && (bond?.callDate) && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Оферта
            </span>
            {bond?.callDate && <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
               Дата оферты: {new Date(bond.callDate).toLocaleDateString('ru-RU')}
              </span>
            </div>}
            
      
          </div>
        </div>}
        {bond && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Другие свойства
            </span>
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content wrap my-2'
              >
                {bond && Object.keys(bond).map((key, index) => {
                  const ibond: IBond = bond as IBond;
                  const keyTyped = key as keyof IBond;
                  const value: string | undefined = typeof ibond[keyTyped] === 'object' ? JSON.stringify(ibond[keyTyped]) : ibond[keyTyped]?.toString();
          
                  const classes = classNames(['m-1']);

                  if (keyTyped === 'figi') return null; //"figi": "BBG00XH4W3N3",
                  if (keyTyped === 'ticker') return null; //"ticker": "RU000A101RZ3",
                  if (keyTyped === 'classCode') return null;  //"classCode": "TQCB",
                  if (keyTyped === 'isin') return null; //"isin": "RU000A101RZ3",
                  if (keyTyped === 'lot') return null; //"lot": 1,
                  if (keyTyped === 'currency') return null; //"currency": "rub",
                  if (keyTyped === 'klong') return null; //"klong": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'kshort') return null; //"kshort": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'dlong') return null; //"dlong": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'dshort') return null; //"dshort": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'dlongMin') return null; //"dlongMin": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'dshortMin') return null; //"dshortMin": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'shortEnabledFlag') return null; //"shortEnabledFlag": false,
                  if (keyTyped === 'name') return null; //"name": "Казахстан выпуск 11",
                  if (keyTyped === 'exchange') return null; //"exchange": "moex_plus_bonds",
                  if (keyTyped === 'couponQuantityPerYear') return null; //"couponQuantityPerYear": 2,
                  if (keyTyped === 'maturityDate') return null; //"maturityDate": "2030-09-11T00:00:00.000Z",
                  if (keyTyped === 'nominal') return null; //"nominal": { "currency": "rub", "units": "1000", "nano": 0 },
                  if (keyTyped === 'initialNominal') return null; //"initialNominal": { "currency": "rub", "units": "1000", "nano": 0 },
                  if (keyTyped === 'stateRegDate') return null; //"stateRegDate": "2020-07-16T00:00:00.000Z",
                  if (keyTyped === 'placementDate') return null; //"placementDate": "2020-09-23T00:00:00.000Z",
                  if (keyTyped === 'placementPrice') return null; //"placementPrice": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'aciValue') return null; //"aciValue": { "currency": "rub", "units": "28", "nano": 0 },
                  if (keyTyped === 'countryOfRisk') return null; //"countryOfRisk": "KZ",
                  if (keyTyped === 'countryOfRiskName') return null; //"countryOfRiskName": "Республика Казахстан",
                  if (keyTyped === 'sector') return null; //"sector": "government",
                  if (keyTyped === 'issueKind') return null; //"issueKind": "non_documentary",
                  if (keyTyped === 'issueSize') return null; //"issueSize": "10000000",
                  if (keyTyped === 'issueSizePlan') return null; //"issueSizePlan": "10000000",
                  if (keyTyped === 'tradingStatus') return null; //"tradingStatus": "SECURITY_TRADING_STATUS_NOT_AVAILABLE_FOR_TRADING",
                  if (keyTyped === 'otcFlag') return null; //"otcFlag": false,
                  if (keyTyped === 'buyAvailableFlag') { //"buyAvailableFlag": true,
                    const text = value ? 'Покупка доступна' : 'Покупка недоступна';
                    const color = value ? 'var(--tg-theme-accent-text-color)' : 'var(--tg-theme-hint-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                  }
                  if (keyTyped === 'sellAvailableFlag') {   //"sellAvailableFlag": true,
                    const text = value ? 'Продажа доступна' : 'Продажа недоступна';
                    const color = value ? 'var(--tg-theme-accent-text-color)' : 'var(--tg-theme-hint-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'floatingCouponFlag') {  //"floatingCouponFlag": false,
                    const text = value ? 'Плавающий купон' : 'Фиксированный купон';
                    const color = value ? 'var(--tg-theme-hint-color)' : 'var(--tg-theme-accent-text-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'perpetualFlag') {  //"perpetualFlag": false,
                    const text = value ? 'Бессрочная' : 'Срочная';
                    const color = value ? 'var(--tg-theme-hint-color)' : 'var(--tg-theme-accent-text-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'amortizationFlag') {  //"amortizationFlag": false,
                    const text = value ? 'С амортизацией' : 'Без амортизации';
                    const color = value ? 'var(--tg-theme-hint-color)' : 'var(--tg-theme-accent-text-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'minPriceIncrement') return null; //"minPriceIncrement": { "units": "0", "nano": 10000000 },
                  if (keyTyped === 'apiTradeAvailableFlag') {  //"apiTradeAvailableFlag": true,
                    const text = value ? 'Доступна через API' : 'Не доступна через API';
                    const color = value ? 'var(--tg-theme-accent-text-color)' : 'var(--tg-theme-hint-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'uid') return null; //"uid": "2dd3b003-aca2-4920-89ce-8d827c637372",
                  if (keyTyped === 'realExchange') return null; //"realExchange": "REAL_EXCHANGE_MOEX",
                  if (keyTyped === 'positionUid') return null; //"positionUid": "2c354d2c-98d0-4705-8370-92e604e31ece",
                  if (keyTyped === 'assetUid') return null; //"assetUid": "28887b0a-20a8-409d-b895-e9831a56152e",
                  if (keyTyped === 'requiredTests') return null; //"requiredTests": [],
                  if (keyTyped === 'forIisFlag') {  //"forIisFlag": false,
                    const text = value ? 'Доступна на ИИС' : 'Не доступна на ИИС';
                    const color = value ? 'var(--tg-theme-accent-text-color)' : 'var(--tg-theme-hint-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'forQualInvestorFlag') {  //"forQualInvestorFlag": false,
                    const text = value ? 'Для квалифицированных' : 'Для всех';
                    const color = value ? 'var(--tg-theme-hint-color)': 'var(--tg-theme-accent-text-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'weekendFlag') {  //"weekendFlag": false,
                    const text = value ? 'Доступна в выходные' : 'Не доступна в выходные';
                    const color = value ? 'var(--tg-theme-accent-text-color)' : 'var(--tg-theme-hint-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                  }
                  if (keyTyped === 'blockedTcaFlag') {  //"blockedTcaFlag": false,
                    const text = value ? 'Заблокированная' : 'Незаблокированная';
                    const color = value ? 'var(--tg-theme-hint-color)' : 'var(--tg-theme-accent-text-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  if (keyTyped === 'subordinatedFlag') {  //"subordinatedFlag": false,
                    const text = value ? 'Субординированная' : 'Несубординированная';
                    const color = value ? 'var(--tg-theme-hint-color)':'var(--tg-theme-accent-text-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                  }
                  
                  if (keyTyped === 'liquidityFlag') { //"liquidityFlag": true,
                    const text = value ? 'Ликвидная' : 'Неликвидная';
                    const color = value ? 'var(--tg-theme-accent-text-color)' : 'var(--tg-theme-hint-color)';
                    const bgcolor = value ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-secondary-bg-color)';
                    return (
                      <Tag key={index}
                        value={text}
                        style={{
                          color: color,
                          backgroundColor: bgcolor,
                        }}
                        className='mr-1'
                      /> 
                    );
                    
                  }
                  
                  if (keyTyped === 'first1minCandleDate') return null; //"first1minCandleDate": "2020-09-23T07:00:00.000Z",
                  if (keyTyped === 'first1dayCandleDate') return null; //"first1dayCandleDate": "2020-09-23T07:00:00.000Z",
                  if (keyTyped === 'riskLevel') return null; //"riskLevel": "RISK_LEVEL_LOW",
                  //  <div key={index} className={classes}>
                  //    {'Уровень риска'}: {getRiskLevelText(ibond)?.charAt(0).toUpperCase()}{getRiskLevelText(ibond)?.slice(1)}
                  //  </div>
                  //);
                  if (keyTyped === 'brand') return null; //"brand": { "logoName": "RU000A101RP4.png", "logoBaseColor": "#000000", "textColor": "#ffffff" },
                  if (keyTyped === 'bondType') return null; //"bondType": "BOND_TYPE_UNSPECIFIED"
                  if (keyTyped === 'callDate') return null; //"callDate": "2020-09-23T07:00:00.000Z",
                  if (keyTyped === 'dlongClient') return null; //"dlongClient": { "currency": "", "units": "0", "nano": 0 },
                  if (keyTyped === 'dshortClient') return null; //"dshortClient": { "currency": "", "units": "0", "nano": 0 },

                  // общий вывод
                  return (
                    <div key={index} className={classes}>
                      {keyTyped}: {value?.toString()}<br/>
                    </div>
                  );
                })}
              </span>
            </div>
            
            
      
          </div>
        </div>}
        <div className='m-0'>
          
        </div>
      </Panel>

      <div className='app p-0'/>
      
      {bond && dates && <Panel
        className='shadow-5 mx-1'
        header='События'
      >
        {dates && edateslist.length > 0 && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Купоны
            </span>
            <div className='flex align-items-center gap-2'>
              <div
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                {/**  */}
              </div>
              <div className='flex flex-wrap'>
                {edateslist}
              </div>
            </div>
            
            
          </div>
        </div>}
      </Panel>}
    </React.Fragment>
  );
};


/*
// EVENT_TYPE_UNSPECIFIED


{
  "events": [
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 1,
      "eventDate": "2025-01-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-01-24T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-01-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "31",
        "nano": 510000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "242627000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2024-12-12T00:00:00Z",
      "couponEndDate": "2025-01-27T00:00:00Z",
      "couponPeriod": 46,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 2,
      "eventDate": "2025-02-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-02-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-02-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "21",
        "nano": 230000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "163471000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-01-27T00:00:00Z",
      "couponEndDate": "2025-02-27T00:00:00Z",
      "couponPeriod": 31,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 3,
      "eventDate": "2025-03-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-03-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-03-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "19",
        "nano": 180000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "147686000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-02-27T00:00:00Z",
      "couponEndDate": "2025-03-27T00:00:00Z",
      "couponPeriod": 28,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 4,
      "eventDate": "2025-04-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-04-25T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-04-28T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "21",
        "nano": 230000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "163471000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-03-27T00:00:00Z",
      "couponEndDate": "2025-04-27T00:00:00Z",
      "couponPeriod": 31,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 5,
      "eventDate": "2025-05-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-05-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-05-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "20",
        "nano": 550000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "158235000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-04-27T00:00:00Z",
      "couponEndDate": "2025-05-27T00:00:00Z",
      "couponPeriod": 30,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 6,
      "eventDate": "2025-06-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-06-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-06-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "21",
        "nano": 230000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "163471000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-05-27T00:00:00Z",
      "couponEndDate": "2025-06-27T00:00:00Z",
      "couponPeriod": 31,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 7,
      "eventDate": "2025-07-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-07-25T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-07-28T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "20",
        "nano": 550000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "158235000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-06-27T00:00:00Z",
      "couponEndDate": "2025-07-27T00:00:00Z",
      "couponPeriod": 30,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 8,
      "eventDate": "2025-08-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-08-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-08-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "21",
        "nano": 230000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "163471000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-07-27T00:00:00Z",
      "couponEndDate": "2025-08-27T00:00:00Z",
      "couponPeriod": 31,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 9,
      "eventDate": "2025-09-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-09-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-09-29T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "21",
        "nano": 230000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "163471000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-08-27T00:00:00Z",
      "couponEndDate": "2025-09-27T00:00:00Z",
      "couponPeriod": 31,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 10,
      "eventDate": "2025-10-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-10-24T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-10-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "20",
        "nano": 550000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "158235000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-09-27T00:00:00Z",
      "couponEndDate": "2025-10-27T00:00:00Z",
      "couponPeriod": 30,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 11,
      "eventDate": "2025-11-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-11-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "payDate": "2025-11-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "21",
        "nano": 230000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "163471000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-10-27T00:00:00Z",
      "couponEndDate": "2025-11-27T00:00:00Z",
      "couponPeriod": 31,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 12,
      "eventDate": "2025-12-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2025-12-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "realPayDate": "2025-12-29T00:00:00Z",
      "payDate": "2025-12-29T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "20",
        "nano": 550000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "158235000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-11-27T00:00:00Z",
      "couponEndDate": "2025-12-27T00:00:00Z",
      "couponPeriod": 30,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 13,
      "eventDate": "2026-01-27T00:00:00Z",
      "eventType": "EVENT_TYPE_CPN",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2026-01-26T00:00:00Z",
      "rateDate": "2024-12-11T00:00:00Z",
      "realPayDate": "2026-01-27T00:00:00Z",
      "payDate": "2026-01-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "21",
        "nano": 230000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "163471000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "Фиксированный",
      "value": {
        "units": "25",
        "nano": 0
      },
      "note": "",
      "convertToFinToolId": "",
      "couponStartDate": "2025-12-27T00:00:00Z",
      "couponEndDate": "2026-01-27T00:00:00Z",
      "couponPeriod": 31,
      "couponInterestRate": {
        "units": "25",
        "nano": 0
      }
    },
    {
      "instrumentId": "cdfb7fe3-13ce-4a72-89eb-4a01693cb1b5",
      "eventNumber": 1,
      "eventDate": "2026-01-27T00:00:00Z",
      "eventType": "EVENT_TYPE_MTY",
      "eventTotalVol": {
        "units": "7700000",
        "nano": 0
      },
      "fixDate": "2026-01-26T00:00:00Z",
      "rateDate": "2026-01-21T00:00:00Z",
      "payDate": "2026-01-27T00:00:00Z",
      "payOneBond": {
        "currency": "rub",
        "units": "177",
        "nano": 990000000
      },
      "moneyFlowVal": {
        "currency": "rub",
        "units": "1370523000",
        "nano": 0
      },
      "execution": "E",
      "operationType": "CA",
      "value": {
        "units": "17",
        "nano": 799000000
      },
      "note": "",
      "convertToFinToolId": "",
      "couponPeriod": 0
    }
  ]
}
*/

/*
  const eventslist = events.map((event: any, index: number) => {
    const iId: string = event.instrumentId;                               // Идентификатор инструмента. 2
    const eNumber: number = event.eventNumber;                            // Номер события для данного типа события. 3
    const eDate: string = event.eventDate;                                // Дата события. 4
    const eType: string = event.eventType;                                // Тип события. 5
    const eTotalVol: IIQuotation = event.eventTotalVol;                   // Полное количество бумаг, задействованных в событии. 6
    const fixDate: string = event.fixDate;                                // Дата фиксации владельцев для участия в событии. 7
    const rateDate: string = event.rateDate;                              // Дата определения даты или факта события. 8
    const defaultPayDate: string = event.defaultPayDate;                  // Дата дефолта, если применимо. 9
    const realPayDate: string = event.realPayDate;                        // Дата реального исполнения обязательства. 10
    const payDate: string = event.payDate;                                // Дата выплаты. 11
    const payOneBond: IIBondValue = event.payOneBond;                     // Выплата на одну облигацию. 12
    const moneyFlowVal: IIBondValue = event.moneyFlowVal;                 // Выплаты на все бумаги, задействованные в событии. 13
    const execution: string = event.execution;                            // Признак исполнения. 14
    const operationType: string = event.operationType;                    // Тип операции. 15
    const value: IIQuotation = event.value;                               // Стоимость операции — ставка купона, доля номинала, цена выкупа или коэффициент конвертации. 16
    const note: string = event.note;                                      // Примечание. 17
    const convertToFinToolId: string = event.convertToFinToolId;          // ID выпуска бумаг, в который произведена конвертация (для конвертаций). 18
    const couponStartDate: string = event.couponStartDate;                // Начало купонного периода. 19
    const couponEndDate: string = event.couponEndDate;                    // Окончание купонного периода. 20
    const couponPeriod: number = event.couponPeriod;                      // Купонный период. 21
    const couponInterestRate: IIQuotation = event.couponInterestRate;     // Ставка купона, процентов годовых. 22
    
    const e:IBondEvent = {
      instrumentId: iId,
      eventNumber: eNumber,
      eventDate: eDate,
      eventType: eType,
      eventTotalVol: eTotalVol,
      fixDate: fixDate,
      rateDate: rateDate,
      defaultDate: defaultPayDate,
      realPayDate: realPayDate,
      payDate: payDate,
      payOneBond: payOneBond,
      moneyFlowVal: moneyFlowVal,
      execution: execution,
      operationType: operationType,
      value: value,
      note: note,
      convertToFinToolId: convertToFinToolId,
      couponStartDate: couponStartDate,
      couponEndDate: couponEndDate,
      couponPeriod: couponPeriod,
      couponInterestRate: couponInterestRate 
    }

    if (e.eventType === 'EVENT_TYPE_CPN') {

      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-accent',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {new Date(e.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-accent',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(e.value.units) + Number(e.value.nano / 1000000000)} %
          </div>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'bg-accent',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round'
              )
            }
          >
            {Number(e.payOneBond.units) + Number(e.payOneBond.nano / 1000000000)} {e.payOneBond.currency === 'rub' ? '₽' : e.payOneBond.currency}
          </div>
        </div>
      ); 
    } else if (e.eventType === 'EVENT_TYPE_CALL') {
      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round',
                'border-1'
              )
            }
          >
            {new Date(e.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round',
                'border-1'

              )
            }
          >
            Оферта
          </div>

        </div>
      ); 
    } else if (e.eventType === 'EVENT_TYPE_MTY') {

      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round',
                'border-1'
              )
            }
          >
            {new Date(e.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round',
                'border-1'

              )
            }
          >
            Погашение
          </div>

        </div>
      ); 
    } else if (e.eventType === 'EVENT_TYPE_CONV') {
      return (
        <div key={index} className='flex'>
          <div
            className={
              classNames(
                'flex-grow-1',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round',
                'border-1'
              )
            }
          >
            {new Date(event.eventDate).toLocaleDateString()}
          </div>
          <div
            className={
              classNames(
                'flex-shrink',
                'flex',
                'align-items-center',
                'justify-content-center',
                'font-bold',
                'm-1',
                'px-2',
                'py-1',
                'border-round',
                'border-1'

              )
            }
          >
            Конвертация
          </div>

        </div>
      ); 
    } else {
      return null;
    }
  });

*/