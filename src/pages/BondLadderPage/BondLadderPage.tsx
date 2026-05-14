import * as packageJson from '@/../package.json';

const version = packageJson.version;

import React, { FC, useEffect } from 'react';

import { IBond, IBondsFilter} from '@root/api/types';
import { convertTIBond, getPlatform, parseTokens, getNominalValue, isNumberMatchFilter  } from '@root/api/methods';
import { fetchBonds as Bonds } from '@root/api/public';

import { useBonds } from '@/hooks/useBonds';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import { TopMenu } from '@/components/BONDS/TopMenu/TopMenu';


import './BondLadderPage.css';
import MarketStreamTest from '@/components/BONDS/MarketStreamTest/MarketStreamTest';
import OperationsStreamTest from '@/components/BONDS/OperationsStreamTest/OperationsStreamTest';
import { OrdersServiceClient } from '@/api/tbank/OrdersService';
import OrdersStreamTest from '@/components/BONDS/OrdersStreamTest/OrdersStreamTest';

// Функция расчёта номера ступени для облигации
function calculateStepForBond(
  maturityDate: string,
  lengthInYears: number,
  paymentsPerYear: number
): number {
  const targetDate = new Date(maturityDate);
  const now = new Date();

  // Рассчитываем количество дней до погашения
  const daysToMaturity = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  // Переводим в годы
  const yearsToMaturity = daysToMaturity / 365;

  // Если срок погашения превышает длину лестницы, возвращаем -1 (не включать)
  if (yearsToMaturity > lengthInYears) {
    return -1;
  }

  // Вычисляем номер ступени: умножаем годы до погашения на количество погашений в год
  const stepIndex = Math.floor(yearsToMaturity * paymentsPerYear);

  // Гарантируем, что индекс не выходит за границы допустимого диапазона [0, stepsCount-1]
  return Math.max(0, Math.min(stepIndex, lengthInYears * paymentsPerYear - 1));
}

// Функция создания лестницы облигаций
function createLadder(
  lengthInYears: number,
  paymentsPerYear: number,
  bonds: IBond[]
): IBond[][] {
  const stepsCount = lengthInYears * paymentsPerYear;

  // Инициализируем лестницу: массив из stepsCount пустых массивов
  const ladder: IBond[][] = Array.from(
    { length: stepsCount },
    () => [] as IBond[]
  );

  // Распределяем облигации по ступеням в зависимости от даты погашения
  bonds.forEach(bond => {
    const targetStep = calculateStepForBond(bond.maturityDate, lengthInYears, paymentsPerYear);
    if (targetStep >= 0 && targetStep < stepsCount) {
      ladder[targetStep].push(bond);
    }
  });

  return ladder;
}

// Функция реинвестирования после погашения первой ступени
function reinvest(
  currentLadder: IBond[][],
  newBonds: IBond[]
): IBond[][] {
  // Создаём копию текущей лестницы
  const newLadder = [...currentLadder];

  // Заменяем первую ступень (погашенную) на новые облигации
  newLadder[0] = newBonds;

  // Сдвигаем остальные ступени на одну позицию вперёд
  for (let i = 1; i < newLadder.length; i++) {
    newLadder[i] = currentLadder[i - 1];
  }

  return newLadder;
}

// Функция получения информации о лестнице для отладки
function printLadderInfo(ladder: IBond[][]): void {
  console.log(`Лестница облигаций: ${ladder.length} ступеней`);
  ladder.forEach((step, index) => {
    console.log(`Ступень ${index + 1}: ${step.length} облигаций`);
    step.forEach(bond => {
      console.log(`  - ${bond.ticker} (погашение: ${bond.maturityDate})`);
    });
  });
}

const exampleBonds: IBond[] = [
];
// Новые облигации для реинвестирования (с погашением через 3 года)
const newBondsForReinvestment: IBond[] = [
];

// Функция для получения статистики по лестнице
function getLadderStatistics(ladder: IBond[][]): {
  totalBonds: number;
  totalNominal: number;
  stepsWithBonds: number;
} {
  let totalBonds = 0;
  let totalNominal = 0;
  let stepsWithBonds = 0;

  ladder.forEach(step => {
    if (step.length > 0) {
      stepsWithBonds++;
      totalBonds += step.length;
      totalNominal += step.reduce((sum, bond) => sum + getNominalValue(bond.nominal), 0);
    }
  });

  return { totalBonds, totalNominal, stepsWithBonds };
}


const BONDLADDERON = false;

(function runBondLadder(on) {
  if (!on) {
    console.log('%cПостроение лестницы облигаций ОТКЛЮЧЕНО (BONDLADDERON = false)', 'color: darkorange');
    return;
  }
  // Создаём лестницу на 3 года с 2 погашениями в год (всего 6 ступеней)
  console.log('=== Создание лестницы облигаций ===');
  const ladder = createLadder(3, 2, exampleBonds);
  printLadderInfo(ladder);

  // Симулируем погашение первой ступени и реинвестирование
  console.log('\n=== Реинвестирование после погашения первой ступени ===');

  const updatedLadder = reinvest(ladder, newBondsForReinvestment);
  printLadderInfo(updatedLadder);

  // Дополнительная информация о структуре лестницы
  console.log('\n=== Дополнительная информация о лестнице ===');
  updatedLadder.forEach((step, index) => {
    const totalNominal = step.reduce((sum, bond) => sum + getNominalValue(bond.nominal), 0);
    console.log(`Ступень ${index + 1}:`);
    console.log(`  Количество облигаций: ${step.length}`);
    console.log(`  Общий номинал: ${totalNominal} ${step[0]?.nominal.currency || 'N/A'}`);
    if (step.length > 0) {
      console.log(`  Ближайшие даты погашения: ${step
        .map(bond => bond.maturityDate)
        .sort()
        .join(', ')}`);
    }
  });


  // Выводим статистику по обновлённой лестнице
  console.log('\n=== Статистика по лестнице ===');
  const stats = getLadderStatistics(updatedLadder);
  console.log(`Общее количество облигаций: ${stats.totalBonds}`);
  console.log(`Общий номинал всех облигаций: ${stats.totalNominal} RUB`);
  console.log(`Количество ступеней с облигациями: ${stats.stepsWithBonds} из ${updatedLadder.length}`);

  // Пример проверки доступности облигаций для ИИС
  console.log('\n=== Проверка облигаций для ИИС ===');
  updatedLadder.forEach((step, index) => {
    const iisEligible = step.every(bond => bond.forIisFlag);
    console.log(`Ступень ${index + 1} полностью подходит для ИИС: ${iisEligible ? 'Да' : 'Нет'}`);
  });

}(BONDLADDERON));


const bondsFilter = (bonds: IBond[], filter?: IBondsFilter) => {
  return bonds.filter(bond => {
    if (filter?.maturity?.year?.equal) {
      const maturityYear = new Date(bond.maturityDate).getFullYear();
      return isNumberMatchFilter(maturityYear, filter.maturity.year);;
    } else {
      return false;  
    }
    
  });
}

export const BondLadderPage: FC = () => {
  const platform: string = getPlatform();
  const { getItem } = useLocalStorage();
  const {bonds, setBonds, setFilteredData} = useBonds();


  useEffect(() => {
    const data = getItem('tokens');
    const ttoken = parseTokens(data);
    
    // Получение списка облигаций через web
    Bonds(ttoken).then(res => {
      let bonds: IBond[] = [];
      res.forEach((bond: any) => {
        bonds.push(convertTIBond(bond));
      });
      console.log('...bonds: ', bonds);
      setBonds(bonds);
    });
    
  }, []);

  useEffect(() => {
    if (bonds) {
      const filtered = bondsFilter(bonds, { maturity: { year: { equal: 2026 }} });
      console.log('filtered: ', filtered);
      setFilteredData(filtered);
    }
  }, [bonds]);
  
  return (
    <React.Fragment>
      <TopMenu/>

      <div className='app p-0'/>
      
      {false && <MarketStreamTest />}
      {false &&<OperationsStreamTest />}
      {<OrdersStreamTest />}
      
      <div
        className='my-5 mx-2 app theme-hint-color theme-bg-secondary text-xs'
      >
        <div className='block text-center mb-2'>
          <span>{'Платформа: ' + platform}</span>
        </div>
        <div className='block text-center mb-1'>
          <span>Мы на Луну!</span>
        </div>
        <div className='block text-center mb-1'>
          <span>Версия {version}</span>
        </div>
        <div className='block text-center mb-3'>
          <span>@2024-2025</span>
        </div>
      </div>
    </React.Fragment>
  );
}