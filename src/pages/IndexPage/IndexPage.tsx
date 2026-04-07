import * as RU from '@/locale/ru.json';

import * as packageJson from '@/../package.json';

const version = packageJson.version;

import React, { useEffect, type FC } from 'react';

import { addLocale, locale as Locale } from 'primereact/api';

import { TopMenu } from '@/components/TopMenu/TopMenu';

import './IndexPage.css';
import { TemplatePanels } from '@/components/TemplatePanels/TemplatePanels';

import { getTableCount } from '@/supabaseClient';

import { Accounts } from '@root/api/public';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAccounts } from '@/hooks/useAccounts';
import { AxiosResponse } from 'axios';
import { IAccount } from '@root/api/types';

import { TIAccount } from '@/components/TIAccount/TIAccount';
import { getPlatform, parseTokens } from '@root/api/methods';

const lng = 'ru';

addLocale(lng, RU.ru);
Locale(lng);

// Использование
getTableCount().then(count => {
  console.log('Total `ids` records:', count);
});

export const IndexPage: FC = () => {
  const platform: string = getPlatform();

  const { getItem } = useLocalStorage();
  const { accounts, setAccounts } = useAccounts();
  
  async function getAccounts() {
    const ttoken = parseTokens(getItem('tokens'));
    
    if (ttoken === '' ) return;
        
    const resaxios = await Accounts(4, ttoken);
    const response = resaxios as AxiosResponse<any, any, {}>;

    if (response.status !== 200) return;
    const iaccounts: IAccount[] = response.data.accounts;
    console.log('iaccounts: ', iaccounts);
    setAccounts(iaccounts);

  }

  useEffect(() => {
    getAccounts();  
  }, []);

  const accountslist = accounts && accounts.map((account: IAccount, index: number) => {
    //const last = index === arr.length - 1;
    //const clsname = classNames('flex', 'flex-wrap', 'app', 'p-2', 'align-items-center', 'gap-4', !last &&'item-border-bottom');
    
    return (
      <TIAccount key={index} account={account}/>
    );
  }); 

  return (
    <React.Fragment>
      <TopMenu />
      
      <TemplatePanels/>

      {accountslist}
  
      <div
        className='my-5 mx-2 app theme-hint-color theme-bg-secondary text-xs'
      >
        <div className='block text-center mb-2'>
          <span>{'Платформа: ' + platform}</span>
        </div>
        <div className='block text-center mb-1'>
          <span>Мы на Луну!</span>
        </div>
        <div className='block text-center mb-1'>
          <span>Версия {version}</span>
        </div>
        <div className='block text-center mb-3'>
          <span>@2024-2025</span>
        </div>
      </div>      

    </React.Fragment>
  );
};
