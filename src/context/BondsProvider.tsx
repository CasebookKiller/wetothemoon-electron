import { useState } from 'react';
import { IBond } from '@root/api/types';
import { BondsContext } from '@/context/BondsContext';

export const BondsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [bonds, setBonds] = useState<IBond[] | undefined>(undefined);
  const [filteredData, setFilteredData] = useState<IBond[] | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <BondsContext.Provider value={{ bonds, setBonds, filteredData, setFilteredData, searchTerm, setSearchTerm }}>
      {children}
    </BondsContext.Provider>
  );
};