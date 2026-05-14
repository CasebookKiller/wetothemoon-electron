import { type FC } from 'react';

import { App } from '@/components/App.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';

import { DebugContext } from '@/context/DebugContext';
import { UserProvider } from '@/context/UserProvider';

import { BondsProvider } from '@/context/BondsProvider';
import { AccountsProvider } from '@/context/AccountsProvider';

function ErrorBoundaryError({ error }: { error: unknown }) {
  return (
    <div>
      <p>Произошла необработанная ошибка:</p>
      <blockquote>
        <code>
          {error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error)}
        </code>
      </blockquote>
    </div>
  );
}


interface InnerProps {
  Component: FC;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pageProps: any;
}

const Inner: FC<InnerProps> = ({ Component, pageProps }) => {
  console.log('Запуск приложения');
  
  return (
    <UserProvider>
      <AccountsProvider>
        <BondsProvider>
          <Component {...pageProps}/>
        </BondsProvider>
      </AccountsProvider>
    </UserProvider>
  );
};

export interface DebugContextType {
  isDebug: boolean;
  debugLog: (...args: any[]) => void;
}

export const Root: FC = () => {
  const debugConfig: DebugContextType = {
    isDebug: import.meta.env.NODE_ENV !== 'production',
    debugLog: (...args) => {
      if (import.meta.env.NODE_ENV !== 'production') {
        console.log('[APP DEBUG]', ...args);
      }
    },
  };

  return (
    <DebugContext.Provider value={debugConfig}>
      <ErrorBoundary fallback={ErrorBoundaryError}>
        <Inner
          Component={App}
          pageProps={{title: 'Мы на Луну!'}}
        />
      </ErrorBoundary>
    </DebugContext.Provider>
  );
}



/*
export function Root() {
  return (
    <ErrorBoundary fallback={ErrorBoundaryError}>
      <TonConnectUIProvider
        manifestUrl={publicUrl('tonconnect-manifest.json')}
      >
        <Inner
          Component={App}
          pageProps={{title: 'Профиль'}}
        />
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}
*/