import type { ComponentType, JSX } from 'react';

import { IndexPage } from '@/pages/IndexPage/IndexPage';

import { CatalogPage } from '@/pages/CatalogPage/CatalogPage';
import { BondLadderPage } from '@/pages/BondLadderPage/BondLadderPage';
import { SettingsPage } from '@/pages/SettingsPage/SettingsPage';
import { BondDetailPage } from '@/pages/BondDetailPage/BondDetailPage';

export interface Route {
  path: string;
  Component?: ComponentType | null;
  element?: any | null;
  title?: string;
  icon?: JSX.Element;
}

const index: Route = { path: '/', Component: IndexPage, title: 'Главная' };
const catalog: Route = { path: '/catalog', Component: CatalogPage, title: 'Каталог' };
const bond: Route = { path: '/catalog/bond/:classcode/:isin', Component: BondDetailPage, title: 'Каталог' };
const ladder: Route = { path: '/ladder', Component: BondLadderPage, title: 'Лестница' };
const settings: Route = { path: '/settings', Component: SettingsPage, title: 'Настройки' };

export const routes: Route[] = [];

routes.push(
  index,
  catalog,
  bond,
  ladder,
  settings
);