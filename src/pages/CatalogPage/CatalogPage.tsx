const serverDebuggerOn = false;

import * as RU from '@/locale/ru.json';

import * as packageJson from '@/../package.json';

const version = packageJson.version;

import React, { useEffect, useState, FC } from 'react';

import axios from 'axios';

import { addLocale, locale as Locale  } from 'primereact/api';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { Sidebar } from 'primereact/sidebar';
import { Toolbar } from 'primereact/toolbar';

import { TopMenu } from '@/components/BONDS/TopMenu/TopMenu';
import { BondsScroller } from '@/components/BONDS/BondsScroller/BondsScroller';

import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import { User } from '@/context/UserContext';

import { classNames } from '@/css/classnames';

import { simpleConnect } from '@/utils/data-utils';
import { fetchBonds, fetchInstrument, fetchWithToken } from '@/utils/common';

import { convertTIBond, getPlatform, parseTokens } from '@root/api/methods';
import { IBond, TIBond } from '@root/api/types';
import { fetchBonds as Bonds } from '@root/api/public';

import './CatalogPage.css';
import { useBonds } from '@/hooks/useBonds';

const HOST = import.meta.env.VITE_HOST;
const PORT = import.meta.env.VITE_PORT;

const lng = 'ru';

addLocale(lng, RU.ru);
Locale(lng);

interface ITIInfo {
  premStatus: boolean,
  qualStatus: boolean,
  qualifiedForWorkWith: string[],
  tariff: string,
  userId: string,
  riskLevelCode: string
}

interface IToolBar {
  user: User;
  onAvatarClick?: () => void;
  onDisconnectClick?: () => void;
}

const BondsReloader: FC = () => {
  const { getItem } = useLocalStorage();
  const { setBonds } = useBonds();
  return (
    <div
      className='flex align-items-center justify-content-center font-bold ml-2'
      onClick={()=>{
        setBonds(undefined);
        const data = getItem('tokens');
        const ttoken = parseTokens(data);
    
        // Получение списка облигаций через web
        Bonds(ttoken).then(res => {
          console.log('...bonds: ', res);
          let bonds: IBond[] = [];
          res.forEach((bond: any) => {
            bonds.push(convertTIBond(bond));
          })
          setBonds(bonds);
        });
      }}
    >
      <i className='pi pi-sync'/>
    </div>
  );  
}

const ToolBar: FC<IToolBar> = ({ user, ...rest }) => {
  const startContent = (
    <div className='align-content-center align-items-center'>
      {/*
        user.tgid && <Avatar
          tgid={user.tgid}
          token={user.token}
          className={'border-round-lg align-content-center align-items-center'}
          onClick={rest.onAvatarClick}
          width={42}
          height={42}
        />
      */}
    </div>
  );
  const centerContent = (
    <React.Fragment>
    </React.Fragment>
  );
  const endContent = (
    <div className='flex align-content-center align-items-center'>
      <Button
        icon='pi pi-sign-out'
        className='profile'
        onClick={rest.onDisconnectClick}/>
    </div>
  );

  return (
    <React.Fragment>
      <Toolbar
        start={startContent}
        center={centerContent}
        end={endContent}
        className='bg-gray-900 shadow-2 align-content-center align-items-center'
        style={{
          borderRadius: '6px',
          backgroundImage: 'linear-gradient(to right, var(--tg-theme-secondary-bg-color), var(--tg-theme-bg-color))',
          padding: '0.0rem 0.0rem',          
        }}
      />
    </React.Fragment>
  );
};

export const CatalogPage: FC = React.memo(() => {
  const platform: string = getPlatform();

  //const [LP] = useState(retrieveLaunchParams());
  //let ID = LP?.tgWebAppData;
  let tgid = import.meta.env.VITE_TGID//ID?.user?.id.toString();

  const { addUser } = useUser();
  const { user, setUser, logout } = useAuth();
  const { getItem } = useLocalStorage();
  const [ sidebar, setSidebar] = useState<boolean>(false);

  const [fullaccess, setFullAccess] = useState<string>();
  const [readonly, setReadOnly] = useState<string>();
  const [sandbox, setSandBox] = useState<string>();

  const [TIInfo, setTIInfo] = useState<ITIInfo | null>();

  const { bonds, setBonds } = useBonds();

  const doConnect = async () => {
    try {
      const rUser: User = await simpleConnect(tgid || '');
      
      console.log('rUser: ', rUser);
      if (rUser) if (setUser) {
        setUser(rUser);
      }
    } catch (error) {
      console.log(error); if (error instanceof Error) console.error('Ошибка авторизации: ',error.message);
    }
  }

  useEffect(() => {
    const storage = getItem('tokens');
    const tokens = typeof storage === 'string' ? JSON.parse(storage || '{}') : storage; 
    
    if (storage) {
      if (tokens.fullaccess) setFullAccess(tokens.fullaccess);
      if (tokens.readonly) setReadOnly(tokens.readonly);
      if (tokens.sandbox) setSandBox(tokens.sandbox);      
    }
  }, []);

  useEffect(() => {
    if (!user) {
      const defaultUser: User = { id: 0, name: '', email: '', password: '', token: '', avatar: '', tgid: tgid }
      const storedUser = JSON.parse(getItem('user')||'{}');
      if (storedUser?.name) { setUser(storedUser) } else { setUser(defaultUser) }
    }
  },[]);
  
  function getBonds() {
    if (readonly === '' && fullaccess === '' && sandbox === '') return;
    const ttoken = readonly !== '' ? readonly : fullaccess !== '' ? fullaccess : sandbox !== '' ? sandbox : '';
    
    if (!user?.token) return;

    fetchBonds(`http://${HOST}:${PORT}/getBonds`, ttoken || '', user?.token)
    .then(res => {
      return res.json();
    }).then(res => {
      let bonds: IBond[] = [];
      res.forEach((bond: TIBond) => {
        //const tibond = bond as TIBond;
        //console.log(tibond);
        bonds.push(convertTIBond(bond));
      })
      setBonds(bonds);
      //console.log(res);
    });
  
  }
  
  useEffect(() => {
    user && addUser(user);
  }, [user]);

  useEffect(() => {
    if (!user?.name) doConnect();
    //getBondsAxios();
  }, []);

  async function getInfoAxios() {
    // запрос напрямую в Т-Инвестиции
    // необходима страница с настройками для хранения токенов

    const data = JSON.stringify({});

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.UsersService/GetInfo',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json', 
        'Authorization': 'Bearer ' + import.meta.env.VITE_TReadOnly
      },
      data : data
    };

    const res = await axios.request(config);
    if (res.status === 200) {
      console.log(res.data);
      setTIInfo(res.data);
    }
  }

  return (
    <React.Fragment>
  
      <Sidebar visible={sidebar} onHide={() => setSidebar(false)} baseZIndex={9990} fullScreen>
        {user?.name && <div className='flex flex-wrap app p-2 align-items-center gap-4'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <div className={'flex justify-content-center'}>
              <span
                className='app font-size-subheading'
              >
                {/*
                  user.tgid && <Avatar
                    tgid={user.tgid}
                    token={user.token}
                    className={'m-1 shadow-5 border-round-lg'}

                  />
                */}
              </span>
            </div>            
            
          </div>
        </div>}

        {user?.name && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <div className='card flex justify-content-start gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                server: {HOST}:{PORT}
              </span>
            </div>
            <div className='card flex justify-content-start gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                id: {user?.id}
              </span>
            </div>
            <div className='card flex justify-content-start gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                tgid: {user?.tgid}
              </span>
            </div>
            <div className='card flex justify-content-start gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                name: {user?.name}
              </span>
            </div>
            <div className='card flex justify-content-start gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                e-mail: {user?.email}
              </span>
            </div>
            <div className='card flex justify-content-start gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                token: {user?.token}
              </span>
            </div>
            <div className='card flex justify-content-start gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                avatar: {user?.avatar}
              </span>
            </div>
          </div>
        </div>}

        {serverDebuggerOn && user?.name && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='app font-size-subheading'
            >
              Тест запроса
            </span>
            {/***** */}
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                <Button
                  className='profile'
                  onClick={async ()=>{
                    try {
                      // запрос API
                      if (!user?.token) return;
                      fetchWithToken(`http://${HOST}:${PORT}/private`, user?.token)
                        .then(res => {
                          console.log(res);
                          return res.json();
                        })
                        .then(res => console.log(res));
                    } catch (error) {
                      console.log(error);
                    }
                  }}
                >
                  Запрос
                </Button>
              </span>
            </div>
            {/***** */}
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                <Button
                  className='profile'
                  onClick={async ()=>{
                    try {
                      // запрос API
                      if (!user?.token) return;
                      fetchWithToken(`http://${HOST}:${PORT}/bond`, user?.token)
                        .then(res => {
                          console.log(res);
                          return res.json();
                        })
                        .then(res => console.log(res));
                    } catch (error) {
                      console.log(error);
                    }
                  }}
                >
                  Бонд
                </Button>
              </span>
            </div>
            {/***** */}
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                <Button className='profile' label='Запрос инструмента' onClick={async () => {
                if (!user?.token) return;
                fetchInstrument(`http://${HOST}:${PORT}/instrument`, 'SBER', user?.token)
                  .then(res => {
                    return res.json();
                  }).then(res => console.log(res));;
                }} />
              </span>
            </div>
            {/***** */}
            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                <Button
                  className='profile'
                  label='getInfo'
                  onClick={async () => {
                    getInfoAxios();
                    /*if (!user?.token) return;
                    getData(`http://${HOST}:${PORT}/getInfo`, user?.token)
                      .then(res => {
                        return res.json();
                      }).then(res => console.log(res));;
                    */
                    }}
                />
              </span>
            </div>
            {/***** */}

            {TIInfo && <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
              <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
                <div className='card flex justify-content-start gap-2'>
                  <span
                    className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
                  >
                    premStatus: {TIInfo.premStatus ? 'true': 'false'}
                  </span>
                </div>
                
                <div className='card flex justify-content-start gap-2'>
                  <span
                    className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
                  >
                    qualStatus: {TIInfo.qualStatus ? 'true': 'false'}
                  </span>
                </div>


              </div>
            </div>}


            <div className='flex align-items-center gap-2'>
              <span
                className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
              >
                <Button
                  className='profile'
                  label='getBonds'
                  onClick={async () => {
                    getBonds();
                  }}
                />
              </span>
            </div>
          </div>
        </div>}
      </Sidebar>
      <TopMenu/>
      
      {true && <div className='app p-0'/>}

      <Panel
        className='shadow-5 mx-1'
        header={'Подключение к серверу'}
      >

        {!user?.name && <div className={
          classNames(
            'flex flex-wrap app p-2 align-items-center gap-4',
            user?.name && 'item-border-bottom'
        )}>
          <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
            <span
              className='card flex justify-content-center mb-2'
            >
              {!user?.name && <Button
                icon='pi pi-check'
                label='Простое подключение'
                className='profile'
                onClick={doConnect}
              />
              }  
            </span>
          </div>
        </div>}

        {user?.name && <div className='app p-0'/>}
        {user?.name && <ToolBar
          user={user}
          onAvatarClick={() => setSidebar(true)}
          onDisconnectClick={() => logout()}
        />}
        {true && user?.name && <div className='app p-0'/>}
      </Panel>
      
      {user?.name && <div className='app p-0'/>}
      {user?.name && <Panel
        className='shadow-5 mx-1'
        header={
          <div>
            <div className='flex flex-nowrap'>
              <div className='flex align-items-center justify-content-center font-bold'>Облигации</div>
              { bonds && 
                <BondsReloader/>
              }
            </div>
          </div>
        }
        id='lazylist'
      >
        <BondsScroller bonds={bonds}/>
      </Panel>}

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
});
/*
{
  "premStatus": false,
  "qualStatus": false,
  "qualifiedForWorkWith": [
    "bond",
    "closed_fund",
    "derivative",
    "foreign_shares",
    "leverage",
    "option",
    "russian_shares",
    "russian_bonds_foreign_law"
  ],
  "tariff": "investor",
  "userId": "b79a3f6d-6b37-43ed-a70a-c96eabd9a809",
  "riskLevelCode": "STANDARD"
}
*/
