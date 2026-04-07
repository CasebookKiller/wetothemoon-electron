import { IAccount } from '@root/api/types';
import { createContext, type Dispatch, type SetStateAction } from 'react';

interface AccountsContextType {
  accounts: IAccount[] | undefined; // Массив облигаций
  setAccounts: Dispatch<SetStateAction<IAccount[] | undefined>>; // Функция обновления
}

export const AccountsContext = createContext<AccountsContextType>({
  accounts: undefined,
  setAccounts: () => {},
});