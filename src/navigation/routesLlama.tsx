import type { ComponentType, JSX } from 'react';

import { LlamaPage } from '@/pages/LlamaPage/LlamaPage';

export interface Route {
  path: string;
  Component?: ComponentType | null;
  element?: any | null;
  title?: string;
  icon?: JSX.Element;
}

const index: Route = { path: '/', Component: LlamaPage, title: 'Главная' };

export const routes: Route[] = [];

routes.push(
  index
);