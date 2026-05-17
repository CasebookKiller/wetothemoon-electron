import type { ComponentType, JSX } from 'react';

import { IndexPage } from '@/pages/IndexPage/IndexPage';

import { CatalogPage } from '@/pages/CatalogPage/CatalogPage';
import { BondLadderPage } from '@/pages/BondLadderPage/BondLadderPage';
import { SettingsPage } from '@/pages/SettingsPage/SettingsPage';
import { BondDetailPage } from '@/pages/BondDetailPage/BondDetailPage';
import { AIPage } from '@/pages/AIPage/AIPage';
import { MarkdownPage } from '@/pages/MarkdownPage/MarkdownPage';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage';
import { PromptGeneratorPage } from '@/pages/PromptGeneratorPage/PromptGeneratorPage';
import { OllamaPage } from '@/pages/OllamaPage/OllamaPage';

export interface Route {
  path: string;
  Component?: ComponentType | null;
  element?: any | null;
  title?: string;
  icon?: JSX.Element;
}

const index: Route = { path: '/', Component: DashboardPage, title: 'Главная' };
const catalog: Route = { path: '/catalog', Component: CatalogPage, title: 'Каталог' };
const bond: Route = { path: '/catalog/bond/:classcode/:isin', Component: BondDetailPage, title: 'Каталог' };
const ladder: Route = { path: '/ladder', Component: BondLadderPage, title: 'Лестница' };
const settings: Route = { path: '/settings', Component: SettingsPage, title: 'Настройки' };
const ai: Route = { path: '/ai', Component: AIPage, title: 'Нейро' };
const md: Route = { path: '/md', Component: MarkdownPage, title: 'Markdown' };
const bonds: Route = { path: '/bonds', Component: IndexPage, title: 'Облигации' };
const dashboard: Route = { path: '/dashboard', Component: DashboardPage, title: 'ЦУП' };
const pg: Route = { path: '/pg', Component: PromptGeneratorPage, title: 'Генератор запросов' };
const ollama: Route = { path: '/ollama', Component: OllamaPage, title: 'Ollama' }; 

export const routes: Route[] = [];

routes.push(
  index,
  catalog,
  bond,
  ladder,
  settings,
  ai,
  md,
  dashboard,
  bonds,
  pg,
  ollama
);