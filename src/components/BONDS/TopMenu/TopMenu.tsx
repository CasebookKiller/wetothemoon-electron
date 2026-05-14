import React, { FC } from 'react';

import { MegaMenu } from 'primereact/megamenu';
import { MenuItem } from 'primereact/menuitem';

import { Link } from '@/components/COMMON/Link/Link';

import './TopMenu.css';

export const TopMenu: FC = () => {
  const itemRenderer = (item: MenuItem) => (
      <Link to={item.url||'/bonds'} className='flex align-items-center p-menuitem-link topmenu'>
        <span className={item.icon} />
        <span className='mx-1'>{item.label}</span>
      </Link>
    );
  const onlyIcon = (item: MenuItem) => (
      <Link to={item.url||'/bonds'} className='flex align-items-center p-menuitem-link'>
        <span className={item.icon} />
      </Link>
  );
  const items: MenuItem[] = [
    {
      label: 'Главная',
      url: '/bonds',
      icon: 'pi pi-home',
      template: itemRenderer
    },
    {
      label: 'Каталог',
      url: '/catalog',
      icon: 'pi pi-shopping-cart',
      template: itemRenderer
    },
    {
      label: 'Лестница',
      url: '/ladder',
      icon: 'pi pi-chart-bar',
      template: itemRenderer
    },
    {
      url: '/settings',
      icon: 'pi pi-cog',
      template: onlyIcon
    }
  ];

return (
  <React.Fragment>
  {true && <div id='header'
    style={{
      position:'sticky',
      top: 0,
      overflow: 'hidden',
      zIndex: 7777
    }}
  >
    <MegaMenu
      model={items}
      className='shadow-5 justify-content-center topmenu'
      style={{
        border: '1px solid var(--tg-theme-hint-color)',
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '0px',
        background: 'var(--tg-theme-secondary-bg-color)'
      }}
    />
  </div>}
  </React.Fragment>
  )
}