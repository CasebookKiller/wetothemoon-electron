import * as packageJson from '@/../package.json';

const version = packageJson.version;

import React, { FC, useState, useEffect } from 'react';

import { useForm, SubmitHandler } from 'react-hook-form';

//import { openLink } from '@tma.js/sdk-react';

// необходимо реализовать открытие ссылке вместо функции телеграмм
function openLink(arg0: string, arg1: { tryBrowser: string; tryInstantView: boolean; }) {
  throw new Error('Function not implemented.');
}

import { Panel } from 'primereact/panel';
import { FloatLabel } from 'primereact/floatlabel';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';

import { TopMenu } from '@/components/TopMenu/TopMenu';

import { useLocalStorage } from '@/hooks/useLocalStorage';

import { useUser } from '@/hooks/useUser';

import { User } from '@/context/UserContext';

import './SettingsPage.css';

type FormTokens = {
  fullaccess: string;
  readonly: string;
  sandbox: string;
}

export const SettingsPage: FC = () => {

  const { user, setUser } = useUser();
  
  const { getItem, setItem } = useLocalStorage();
  
  const [fullaccess, setFullAccess] = useState<string>();
  const [readonly, setReadOnly] = useState<string>();
  const [sandbox, setSandBox] = useState<string>();

  const { handleSubmit, setValue } = useForm<FormTokens>({
    defaultValues: {
      fullaccess: '',
      readonly: '',
      sandbox: '',
    },
  });

  useEffect(() => {
    const data = getItem('tokens');
    const tokens = JSON.parse(data || '{}');
    
    if (data) {
      if (tokens.fullaccess) {
        setFullAccess(tokens.fullaccess);
        setValue('fullaccess', tokens.fullaccess);
      }
      if (tokens.readonly) {
        setReadOnly(tokens.readonly);
        setValue('readonly', tokens.readonly);
      }
      if (tokens.sandbox) {
        setSandBox(tokens.sandbox);
        setValue('sandbox', tokens.sandbox);
      }
      
      setUser(prevUser => {
        return {
          ...prevUser,
          fullaccess: tokens.fullaccess,
          readonly: tokens.readonly,
          sandbox: tokens.sandbox,
          name: user?.name || '',
          email: user?.email || '',
        }
      });
      
    }
  }, []);
  

  const onSubmit: SubmitHandler<FormTokens> = (data) => {
    console.log(data);
    setItem('tokens', JSON.stringify(data));
  };

  let platform: string;

  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    platform = 'ios';
  } else if (/android/.test(userAgent)) {
    platform = 'android';
  } else {
    platform = 'desktop';
  }

  return (
    <React.Fragment>

      <TopMenu/>
      
      <div className='app p-0'/>
      <Panel
        className='shadow-5 mx-1'
        header={'Важная информация'}
      >
          <div className='flex flex-wrap app p-2 align-items-center gap-4'>
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >Для работы приложения необходим токен</span>
              <div className='flex align-items-center gap-2'>
                {/*<i className="pi pi-tag text-sm"></i>*/}
                <span
                  className='app font-size theme-hint-color font-weight-content'
                >
                  <div className='mb-2'>Наше приложение для получения сведений об облигациях использует программный интерфейс Т-Инвестиции.</div>
                  <div>И для его работы необходимо быть клиентом Т-Инвестиции и создать токен доступа.</div>
                </span>
              </div>
            </div>
          </div>
          <div className='flex flex-wrap app p-2 align-items-center gap-4'>
            
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >Создание нового токена</span>
              <div className='flex align-items-center gap-2'>
                {/*<i className="pi pi-tag text-sm"></i>*/}
                <span
                  className='app font-size theme-hint-color font-weight-content'
                >
                  <div className='mb-2'>Для создания нового токена перейдите на сайт Т-Инвестиции, <span style={{color: 'var(--tg-theme-accent-text-color)'}}>нажав на кнопку "Создать токен"</span>.</div>
                  <div>В настройках в разделе <span style={{color: 'var(--tg-theme-accent-text-color)'}}>Токены T‑Bank Invest API</span> нажмите <span style={{color: 'var(--tg-theme-accent-text-color)'}}>Создать токен</span>.</div> 
                </span>
              </div>
              <div className='flex justify-content-center flex-wrap mt-3'>
                <Button
                  type='submit'
                  label='Создать токен'
                  className='profile'
                  icon='pi pi-key'
                  onClick={() => {
                    openLink('https://www.tbank.ru/invest/settings/', {
                      tryBrowser: 'chrome',
                      tryInstantView: true,
                    });
                  }}
                  autoFocus
                />
              </div>
            </div>
            {/*<span className="font-bold text-900">$65</span>*/}
          </div>
        
      </Panel>

      <div className='app p-0'/>
      <Panel
        className='shadow-5 mx-1'
        header={'Настройки'}
        footer={
          <React.Fragment>
            В целях безопасности рекомендуется обновлять токены, удаляя в личном кабинете Т-Инвестиции старые токены
          </React.Fragment>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='flex flex-wrap app p-2 align-items-center gap-4'>
            <FloatLabel className='mt-3'>
              <InputTextarea
                id='txtsandbox'
                className='profile'
                value={sandbox}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setValue('sandbox', e.target.value);

                  setSandBox(e.target.value);
                  if (sandbox !== e.target.value) {
                    setUser({ ...user, sandbox: e.target.value } as User);
                  }
                }}
                rows={3}
                cols={36}
              />
              <label htmlFor='txtsandbox'>Токен для песочницы</label>
            </FloatLabel>
            <FloatLabel className='mt-3'>
              <InputTextarea
                id='txtreadonly'
                className='profile'
                value={readonly}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setValue('readonly', e.target.value);

                  setReadOnly(e.target.value);
                  if (readonly !== e.target.value) {
                    setUser({ ...user, readonly: e.target.value } as User);
                  }
                }}
                rows={3}
                cols={36}
              />
              <label htmlFor='txtreadonly'>Токен только для чтения</label>
            </FloatLabel>
            <FloatLabel className='mt-3'>
              <InputTextarea
                id='txtfullaccess'
                className='profile'
                value={fullaccess}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setValue('fullaccess', e.target.value);

                  setFullAccess(e.target.value);
                  if (fullaccess !== e.target.value) {
                    setUser({ ...user, fullaccess: e.target.value } as User);
                  }
                }}
                rows={3}
                cols={36}
              />
              <label htmlFor='txtfullaccess'>Токен с полным доступом</label>
            </FloatLabel>
          </div>
          <div className='flex justify-content-center flex-wrap'>
            <Button
              type='submit'
              label='Сохранить'
              className='profile mb-3'
              icon='pi pi-save'
              onClick={() => {}}
              autoFocus
            />
          </div>
        </form>
      </Panel>

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
}