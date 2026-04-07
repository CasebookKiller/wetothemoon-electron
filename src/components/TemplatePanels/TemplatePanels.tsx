const template_panels = import.meta.env.VITE_TEMPLATE_PANELS === 'true' ? true : false;

import React, { FC } from 'react';

import { Panel } from 'primereact/panel';

import { Link } from '@/components/Link/Link';

import tonSvg from './ton.svg';

export const TemplatePanels: FC = () => {
  return (
    <React.Fragment>
      {template_panels && <div className='app p-0'/>}
      {template_panels && <Panel
        className='shadow-5 mx-1'
        header={'Особенности'}
        footer={'Вы можете воспользоваться этими страницами, чтобы узнать больше о функциях, предоставляемых мини-приложениями Telegram и другими полезными проектами'}
      >
        <Link to='/ton-connect'>
          <div className='flex flex-wrap app p-2 align-items-center gap-4'>
            <img
              crossOrigin='anonymous'
              className='w-2-5rem shadow-2 flex-shrink-0 border-round'
              style={{ 
                backgroundColor: 'var(--tg-theme-accent-text-color)'
              }}
              src={tonSvg}
              alt='TON Connect'
            />
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >TON Connect</span>
              <div className='flex align-items-center gap-2'>
                {/*<i className="pi pi-tag text-sm"></i>*/}
                <span
                  className='app font-size theme-hint-color font-weight-content'
                >
                  Подключите свой кошелек TON
                </span>
              </div>
            </div>
            {/*<span className="font-bold text-900">$65</span>*/}
          </div>
        </Link>
      </Panel>}
      
      {template_panels && <div className='app p-0'/>}
      {template_panels && <Panel
        className='shadow-5 mx-1'
        header={'Данные о запуске приложения'}
        footer={'Эти страницы помогают разработчикам узнать больше о текущей информации о запуске'}
      >
        <Link to='/init-data'>
          <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >
                Данные инициализации
              </span>
              <div className='flex align-items-center gap-2'>
                <span
                  className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
                >
                  Пользовательские данные, информация о чате, технические данные
                </span>
              </div>
            </div>
          </div>
        </Link>
        <Link to='/launch-params'>
          <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >
                Параметры запуска
              </span>
              <div className='flex align-items-center gap-2'>
                <span
                  className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
                >
                  Идентификатор платформы, версия мини-приложения и т.д.
                </span>
              </div>
            </div>
          </div>
        </Link>
        <Link to='/theme-params'>
          <div className='flex flex-wrap app p-2 align-items-center gap-4'>
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >
                Параметры темы
              </span>
              <div className='flex align-items-center gap-2'>
                <span
                  className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
                >
                  Информация о палитре приложений Telegram
                </span>
              </div>
            </div>
          </div>
        </Link>
      </Panel>}
      
      {template_panels && <div className='app p-0'/>}
      {template_panels && <Panel
        className='shadow-5 mx-1'
        header='База данных и задания'
        footer='Этот раздел помогает разработчикам настроить подключение supabase к своему мини-приложению и организовать подписку на чаты и каналы'
      >
        <Link to='/supabase'>
          <div className='flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom'>
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >
                База данных
              </span>
              <div className='flex align-items-center gap-2'>
                <span
                  className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
                >
                  Идентификаторы пользователей приложения
                </span>
              </div>
            </div>
          </div>
        </Link>
        <Link to='/missions'>
          <div className='flex flex-wrap align-items-center gap-4 app p-2'>
            <div className='flex-1 flex flex-column gap-1 xl:mr-8'>
              <span
                className='app font-size-subheading'
              >
                Задания
              </span>
              <div className='flex align-items-center gap-2'>
                <span
                  className='app font-size theme-hint-color font-weight-content nowrap overflow-ellipsis'
                >
                  Задания для пользователей, проверка подписки на чаты и каналы
                </span>
              </div>
            </div>
          </div>
        </Link>
      </Panel>}
    </React.Fragment>
  )
}