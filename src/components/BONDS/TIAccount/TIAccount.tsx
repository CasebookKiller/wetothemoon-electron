import { AxiosResponse } from 'axios';

import React, { FC, useEffect, useState } from 'react';

import { getAccountTypeHuman, IAccount, IPortfolio, IPortfolioPosition } from '@root/api/types';
import { Instrument, Portfolio } from '@root/api/public';
import { parseTokens } from '@root/api/methods';

import { useLocalStorage } from '@/hooks/useLocalStorage';

import { Panel } from 'primereact/panel';
import { Accordion, AccordionTab } from 'primereact/accordion';

import { TIPosition } from '../TIPosition/TIPosition';

import { classNames } from '@/css/classnames';
import './TIAccount.css';

interface TIAccountProps {
  account: IAccount;
}

export const TIAccount:FC<TIAccountProps> = (props) => {
  const [ portfolio, setPortfolio ] = useState<IPortfolio>();
  const [ instruments, setInstruments ] = useState<any[]>();
  const { getItem } = useLocalStorage();
    
  async function getPortfolio(account: number) {
    const ttoken = parseTokens(getItem('tokens'));
    
    if (ttoken === '' ) return;
        
    const resaxios = await Portfolio(account, ttoken);
    const response = resaxios as AxiosResponse<any, any, {}>;

    if (response.status !== 200) return;
    const iportfolio = response.data;
    setPortfolio(iportfolio);

    iportfolio.positions.map(async (position: IPortfolioPosition) => {
      const iinstrument = await getInstrument(position);
      setInstruments(prevInstruments => prevInstruments ? [...prevInstruments, iinstrument] : [iinstrument]);
    })

  }

  async function getInstrument(position: IPortfolioPosition) {
    const ttoken = parseTokens(getItem('tokens'));
    
    if (ttoken === '' ) return;
        
    const resaxios = await Instrument(position.ticker, position.classCode, ttoken);
    const response = resaxios as AxiosResponse<any, any, {}>;
    if (response.status !== 200) return;
    const iinstrument = {
      ...response.data.instrument, // В исходном ответе с инструментом 
      brand: {
        ...response.data.instrument.brand, // подставляем путь к картинке с логотипом вида https://invest-brands.cdn-tinkoff.ru/RU000A100Q4x160.png
        logoName: 'https://invest-brands.cdn-tinkoff.ru/' + response.data.instrument.brand.logoName.replace('.png','') + 'x160.png'
      }
    };
    return iinstrument;
  }

  useEffect(() => {
    getPortfolio(Number(props.account.id));
  },[])

  useEffect(() => {
    portfolio && console.log(portfolio)
  }, [portfolio]);

  const clsname = classNames('flex', 'flex-wrap', 'app', 'pt-2', 'align-items-center', 'gap-2');
      
  const header = (
    <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
      <span
        className='app font-size-subheading'
      >
        {props.account.name}
      </span>
      <div className='flex align-items-center gap-2 mt-2'>
        <div
          className='app font-size theme-hint-color font-weight-content flex nowrap'
        >
          {props.account.accessLevel === 'ACCOUNT_ACCESS_LEVEL_READ_ONLY' ? <i className='pi pi-lock'/>:''}
          <span className='ml-2'>{getAccountTypeHuman(props.account.type)}</span>
        </div>
        <div className='flex flex-wrap'>
          {/**  */}
        </div>
        
      </div>
      
      
    </div>
  );

  const postionslist = portfolio?.positions.map((position: IPortfolioPosition, index: number) => {
    const iinstrument = instruments?.find((instrument: any) => instrument.ticker === position.ticker);
    
    return (
      <TIPosition key={index} account={props.account} position={position} instrument={iinstrument} />
    )
  })


  const footer = (
    <React.Fragment>
      <Accordion className='amount'>
        <AccordionTab
          header={
            <span className='flex align-items-center gap-2 w-full'>
              <span className='font-bold white-space-nowrap'>{portfolio?.totalAmountPortfolio && <span className=''>Всего: {Number(portfolio.totalAmountPortfolio.units + '.' + portfolio.totalAmountPortfolio.nano).toFixed(2)} {portfolio.totalAmountPortfolio.currency === 'rub' ? '₽' : portfolio.totalAmountPortfolio.currency}</span>}</span>
            </span>
          }
        >
          <div>
            {portfolio?.totalAmountShares && <span className=''>Акции: {Number(portfolio.totalAmountShares.units + '.' + portfolio.totalAmountShares.nano).toFixed(2)} {portfolio.totalAmountShares.currency === 'rub' ? '₽' : portfolio.totalAmountShares.currency}</span>}
          </div>
          <div>
            {portfolio?.totalAmountBonds && <span className=''>Облигации: {Number(portfolio.totalAmountBonds.units + '.' + portfolio.totalAmountBonds.nano).toFixed(2)} {portfolio.totalAmountBonds.currency === 'rub' ? '₽' : portfolio.totalAmountBonds.currency}</span>}
          </div>
          <div>
            {portfolio?.totalAmountEtf && <span className=''>Фонды: {Number(portfolio.totalAmountEtf.units + '.' + portfolio.totalAmountEtf.nano).toFixed(2)} {portfolio.totalAmountEtf.currency === 'rub' ? '₽' : portfolio.totalAmountEtf.currency}</span>}
          </div>
          <div>
            {portfolio?.totalAmountFutures && <span className=''>Фьючерсы: {Number(portfolio.totalAmountFutures.units + '.' + portfolio.totalAmountFutures.nano).toFixed(2)} {portfolio.totalAmountFutures.currency === 'rub' ? '₽' : portfolio.totalAmountFutures.currency}</span>}
          </div>
          <div>
            {portfolio?.totalAmountOptions && <span className=''>Опционы: {Number(portfolio.totalAmountOptions.units + '.' + portfolio.totalAmountOptions.nano).toFixed(2)} {portfolio.totalAmountOptions.currency === 'rub' ? '₽' : portfolio.totalAmountOptions.currency}</span>}
          </div>
          <div>
            {portfolio?.totalAmountSp && <span className=''>Стр.ноты: {Number(portfolio.totalAmountSp.units + '.' + portfolio.totalAmountSp.nano).toFixed(2)} {portfolio.totalAmountSp.currency === 'rub' ? '₽' : portfolio.totalAmountSp.currency}</span>}
          </div>
          <div>
            {portfolio?.totalAmountCurrencies && <span className=''>Валюта: {Number(portfolio.totalAmountCurrencies.units + '.' + portfolio.totalAmountCurrencies.nano).toFixed(2)} {portfolio.totalAmountCurrencies.currency === 'rub' ? '₽' : portfolio.totalAmountCurrencies.currency}</span>}
          </div>
        </AccordionTab>
      </Accordion>
    </React.Fragment>
  );
  

  return (
    <React.Fragment>
      <div className='app p-0'/>
      <Panel
        className='shadow-5 mx-1'
        header={header}
        footer={footer}
      >
        <div
          className={clsname}
        >
          {postionslist}
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              {/**  */}
            </span>
            <div className='flex align-items-center gap-2'>
              <div
                className='app font-size theme-hint-color font-weight-content flex nowrap'
              >
                {/**  */}
                <span className='ml-2'>{/**  */}</span>
              </div>
              <div className='flex flex-wrap'>
                {/**  */}
              </div>
            </div>
            
            
          </div>
        </div>
      </Panel>
    </React.Fragment>
  );
}