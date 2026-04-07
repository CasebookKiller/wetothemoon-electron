import { useState } from 'react';
import { IAccount } from '@root/api/types';
import { AccountsContext } from '@/context/AccountsContext';

export const AccountsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [accounts, setAccounts] = useState<IAccount[] | undefined>(undefined);
  
  return (
    <AccountsContext.Provider value={{ accounts, setAccounts }}>
      {children}
    </AccountsContext.Provider>
  );
};