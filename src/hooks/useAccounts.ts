import { useContext } from 'react';
import { IAccount } from '@root/api/types';
import { AccountsContext } from '@/context/AccountsContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export const useAccounts = () => {
  const { accounts, setAccounts } = useContext(AccountsContext);
  const { setItem } = useLocalStorage();

  const addAccounts = (accounts: IAccount[]) => {
    setAccounts(accounts);
    setItem('accounts', JSON.stringify(accounts));
  };

  const removeAccounts = () => {
    setAccounts(undefined)
    setItem('accounts', '');
  };

  return { accounts, addAccounts, removeAccounts, setAccounts };
};
