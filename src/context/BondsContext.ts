import { IBond } from '@root/api/types';
import { createContext, type Dispatch, type SetStateAction } from 'react';

interface BondsContextType {
  bonds: IBond[] | undefined; // Массив облигаций
  setBonds: Dispatch<SetStateAction<IBond[] | undefined>>; // Функция обновления
  filteredData: IBond[] | undefined; // Массив облигаций
  setFilteredData: Dispatch<SetStateAction<IBond[] | undefined>>; // Функция обновления
  searchTerm: string; // Поисковая строка
  setSearchTerm: Dispatch<SetStateAction<string>>; // Функция обновления
}

export const BondsContext = createContext<BondsContextType>({
  bonds: undefined,
  setBonds: () => {},
  filteredData: undefined,
  setFilteredData: () => {},
  searchTerm: '',
  setSearchTerm: () => {},
});