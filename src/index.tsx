const strictmode = false; // StrictMode дублирует рендеринг компонентов в режиме разработки

import ReactDOM from 'react-dom/client';

import { Root } from '@/components/Root.tsx';
import { EnvUnsupported } from '@/components/EnvUnsupported.tsx';

import { init } from '@/init.ts';

// CSS
import 'primereact/resources/themes/lara-dark-cyan/theme.css';
import 'primeflex/primeflex.css';
import 'primeflex/themes/primeone-dark.css';
import 'primeicons/primeicons.css';

// Включаем стили пользовательского интерфейса, чтобы наш код мог переопределять CSS пакета.
import '@/index.css';
import React, { StrictMode } from 'react';
import { PrimeReactProvider } from 'primereact/api';

const root = ReactDOM.createRoot(document.getElementById('root')!);

try {
  let platform: string;

  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    platform = 'ios';
  } else if (/android/.test(userAgent)) {
    platform = 'android';
  } else {
    platform = 'desktop';
  }

  // Настройте все зависимости приложения.
  init({
  })
    .then(() => {
        root.render(
        <React.Fragment>
          {
            strictmode ? 
              <StrictMode><PrimeReactProvider><Root/></PrimeReactProvider></StrictMode>
            : 
              <PrimeReactProvider><Root/></PrimeReactProvider>
          }
        </React.Fragment>
      );
    });
} catch (e) {
  root.render(<EnvUnsupported/>);
}