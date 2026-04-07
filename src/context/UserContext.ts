import { createContext, type Dispatch, type SetStateAction } from 'react';

export type User = {
  id?: number,
  name: string,
  email: string,
  password?: string,
  token?: string,
  avatar?: string,                  // Аватар
  tgid?: string | null,             // userid telegram
  firstname?: string | null,        // Имя
  lastname?: string | null,         // Фамилия
  bio?: string | null,              // Биография
  sandbox?: string | null,          // Токен для песочница
  readonly?: string | null,         // Токен для чтения
  fullaccess?: string | null,       // Токен для полного доступа
}

interface UserContextType {
  user: User | null; // Данные пользователя
  setUser: Dispatch<SetStateAction<User | null>>; // Функция обновления
  loginVisible: boolean; // Видимость формы авторизации
  setLoginVisible: Dispatch<SetStateAction<boolean>>; // Функция обновления
}

export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  loginVisible: false,
  setLoginVisible: () => {}
});