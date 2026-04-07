import { useState } from 'react';
import { UserContext, type User } from '@/context/UserContext';

export const UserProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loginVisible, setLoginVisible] = useState(false);

  return (
    <UserContext.Provider value={{ user, setUser, loginVisible, setLoginVisible }}>
      {children}
    </UserContext.Provider>
  );
};