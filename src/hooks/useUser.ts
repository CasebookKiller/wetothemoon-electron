import { useContext } from 'react';
import { UserContext, type User } from '@/context/UserContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export const useUser = () => {
  const { user, setUser, loginVisible, setLoginVisible } = useContext(UserContext);
  const { setItem } = useLocalStorage();

  const addUser = (user: User) => {
    setUser(user);
    setLoginVisible(false);
    setItem('user', JSON.stringify(user));
  };

  const removeUser = () => {
    setUser(null);
    setLoginVisible(true);
    setItem('user', '');
  };

  return { user, addUser, removeUser, setUser, loginVisible, setLoginVisible };
};
