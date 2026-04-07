import { useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { User } from '@/context/UserContext';

export const useAuth = () => {
  // мы можем повторно экспортировать пользовательские методы или объекты из этого хука
  const { user, addUser, removeUser, setUser, loginVisible, setLoginVisible } = useUser();
  const { getItem } = useLocalStorage();

  useEffect(() => {
    const user = getItem('user');
    if (user) {
      addUser(JSON.parse(user));
    }
  }, [addUser, getItem]);

  const login = (user: User) => {
    addUser(user);
  };

  const logout = () => {
    removeUser();
  };

  return { user, login, logout, setUser, loginVisible, setLoginVisible };
};