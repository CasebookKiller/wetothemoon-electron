import { useContext } from 'react';
import { IBond } from '@root/api/types';
import { BondsContext } from '@/context/BondsContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export const useBonds = () => {
  const { bonds, setBonds, filteredData, setFilteredData, searchTerm, setSearchTerm } = useContext(BondsContext);
  const { setItem } = useLocalStorage();

  const addBonds = (bonds: IBond[]) => {
    setBonds(bonds);
    setItem('bonds', JSON.stringify(bonds));
  };

  const removeBonds = () => {
    setBonds(undefined)
    setItem('bonds', '');
  };

  return { bonds, addBonds, removeBonds, setBonds, filteredData, setFilteredData, searchTerm, setSearchTerm };
};
