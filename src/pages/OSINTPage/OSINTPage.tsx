// wetothemoon-electron/src/pages/OSINTPage/OSINTPage.tsx

import React, { useState } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Divider } from 'primereact/divider';

import { classNames } from '@/css/classnames';

import './OSINTPage.css'; // при необходимости добавьте свои стили

export const OSINTPage: React.FC = () => {
  const [inn, setInn] = useState<string>(() => {
    try {
      return localStorage.getItem('osint_last_inn') || '';
    } catch {
      return '';
    }
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [needArbitrDetails, setNeedArbitrDetails] = useState(false);
  const [needConnectionsDetails, setNeedConnectionsDetails] = useState(false);
  const [needSouDetails, setNeedSouDetails] = useState(false); // <-- новое

  const [souRole, setSouRole] = useState('all'); // 'all', 'defendant', 'plaintiff', 'representative', 'third_other_party'
  const [souMatchLevels, setSouMatchLevels] = useState<string[]>([]); // 'high', 'medium', 'low'
  const [souSearch, setSouSearch] = useState('');
  const [souMaxPages, setSouMaxPages] = useState(1);
  const [souMaxTotalCases, setSouMaxTotalCases] = useState(100);

  const [needTrademarksDetails, setNeedTrademarksDetails] = useState(false);
  const [trademarkFilters, setTrademarkFilters] = useState({
    onlyActual: false,
    type: 'all', // 'all', 'combined', 'verbal', 'visual', 'unknown'
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const handleInnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInn(value);
    try {
      localStorage.setItem('osint_last_inn', value);
    } catch {
      // ignore storage errors
    }
  };

  // Состояния фильтров арбитража
  const [arbitrFilters, setArbitrFilters] = useState({
    sides: [] as string[],       // 'plaintiff', 'defendant', 'third'
    status: [] as string[],      // 'in_progress', 'completed'
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [souFilters, setSouFilters] = useState({
    sides: [] as string[],
    status: [] as string[],
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const toggleSouSide = (value: string) => {
    setSouFilters(prev => ({
      ...prev,
      sides: prev.sides.includes(value)
        ? prev.sides.filter(s => s !== value)
        : [...prev.sides, value],
    }));
  };

  const toggleSouStatus = (value: string) => {
    setSouFilters(prev => ({
      ...prev,
      status: prev.status.includes(value)
        ? prev.status.filter(s => s !== value)
        : [...prev.status, value],
    }));
  };

  const [needLeasingDetails, setNeedLeasingDetails] = useState(false);
  const [leasingFilters, setLeasingFilters] = useState({
    role: 'all', // 'all', 'Lessee', 'Lessor'
    status: 'all', // 'all', 'ok', 'ended', 'stopped'
    code: 'all', // 'all', '0000001', '0104008'
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needPledgesDetails, setNeedPledgesDetails] = useState(false);
  const [pledgesFilters, setPledgesFilters] = useState({
    role: 'all',       // 'all', 'Mortgagor', 'Mortgagee'
    status: 'all',     // 'all', 'ended', 'annul', 'undefined'
    code: 'all',       // 'all', '01', '0101', ... (можно добавить select)
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needFactsDetails, setNeedFactsDetails] = useState(false);
  const [factsFilters, setFactsFilters] = useState({
    group: 'all', // 'all', 'obespechitelnye_interesy_i_obyazatelstva', 'licenzii_razresheniya_samoregulirovaniya', 'bankrotstva_i_ispolnitelnye_proizvodstva', 'prochee'
    withAnnulled: false,
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needBankruptcyDetails, setNeedBankruptcyDetails] = useState(false);
  const [bankruptcyFilters, setBankruptcyFilters] = useState({
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needFoundersDetails, setNeedFoundersDetails] = useState(false);
  const [foundersFilters, setFoundersFilters] = useState({
    types: [] as string[], // 'org_rus', 'person', 'org_foreign', 'state', 'fund'
    statuses: [] as string[], // 'actual', 'historical'
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needReliabilityDetails, setNeedReliabilityDetails] = useState(false);


  const api = (window as any).electronAPI;

  const handleLaunch = async () => {
    try {
      await api.osintLaunch();
      setError('');
      setResult(null);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleClose = async () => {
    try {
      await api.osintClose();
      setError('');
      setResult(null);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleScrapeRusprofile = async () => {
    if (!inn.trim()) {
      setError('Введите ИНН');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      if (!api?.scrapeRusprofile) {
        setError('Метод scrapeRusprofile не найден');
        return;
      }

      const options: any = {
        arbitrDetails: needArbitrDetails,
        maxPages: arbitrFilters.maxPages,
        maxTotalCases: arbitrFilters.maxTotalCases,
        connectionsDetails: needConnectionsDetails,
        souDetails: needSouDetails,
        // фильтры арбитража
        filters: needArbitrDetails ? {
          sides: arbitrFilters.sides.length > 0 ? arbitrFilters.sides : undefined,
          status: arbitrFilters.status.length > 0 ? arbitrFilters.status : undefined,
          search: arbitrFilters.search.trim() || undefined,
        } : undefined,
        // отдельные фильтры для судов
        souFilters: needSouDetails ? {
          role: souRole,
          matchLevel: souMatchLevels,
          search: souSearch.trim() || undefined,
          maxPages: souMaxPages,
          maxTotalCases: souMaxTotalCases,
        } : undefined,
        // отдельные фильтры для товарных знаков
        trademarksDetails: needTrademarksDetails,
        trademarksFilters: needTrademarksDetails ? {
          onlyActual: trademarkFilters.onlyActual,
          type: trademarkFilters.type,
          search: trademarkFilters.search.trim() || undefined,
          maxPages: trademarkFilters.maxPages,
          maxTotalCases: trademarkFilters.maxTotalCases,
        } : undefined,
        // отдельные фильтры для лизинга
        leasingDetails: needLeasingDetails,
        leasingFilters: needLeasingDetails ? {
          role: leasingFilters.role,
          status: leasingFilters.status,
          code: leasingFilters.code,
          search: leasingFilters.search.trim() || undefined,
          maxPages: leasingFilters.maxPages,
          maxTotalCases: leasingFilters.maxTotalCases,
        } : undefined,
        // отдельные фильтры для залогов
        pledgesDetails: needPledgesDetails,
        pledgesFilters: needPledgesDetails ? {
          role: pledgesFilters.role,
          status: pledgesFilters.status,
          maxPages: pledgesFilters.maxPages,
          maxTotalCases: pledgesFilters.maxTotalCases,
        } : undefined,
        // отдельные фильтры для существенных фактов
        factsDetails: needFactsDetails,
        factsFilters: needFactsDetails ? {
          group: factsFilters.group,
          withAnnulled: factsFilters.withAnnulled,
          maxPages: factsFilters.maxPages,
          maxTotalCases: factsFilters.maxTotalCases,
        } : undefined,
        // отдельные фильтры для банкротства
        bankruptcyDetails: needBankruptcyDetails,
        bankruptcyFilters: needBankruptcyDetails ? {
          search: bankruptcyFilters.search.trim() || undefined,
          maxPages: bankruptcyFilters.maxPages,
          maxTotalCases: bankruptcyFilters.maxTotalCases,
        } : undefined,
        // отдельные фильтры для учредителей
        foundersDetails: needFoundersDetails,
        foundersFilters: needFoundersDetails ? {
          types: foundersFilters.types,
          statuses: foundersFilters.statuses,
          maxPages: foundersFilters.maxPages,
          maxTotalCases: foundersFilters.maxTotalCases,
        } : undefined,
        // сбор данных о надежности
        reliabilityDetails: needReliabilityDetails,
      };

      if (needArbitrDetails) {
        options.filters = {
          sides: arbitrFilters.sides.length > 0 ? arbitrFilters.sides : undefined,
          status: arbitrFilters.status.length > 0 ? arbitrFilters.status : undefined,
          search: arbitrFilters.search.trim() || undefined,
        };
      }

      const response = await api.scrapeRusprofile(inn, options);

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка сбора');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSide = (value: string) => {
    setArbitrFilters(prev => ({
      ...prev,
      sides: prev.sides.includes(value)
        ? prev.sides.filter(s => s !== value)
        : [...prev.sides, value],
    }));
  };

  const toggleStatus = (value: string) => {
    setArbitrFilters(prev => ({
      ...prev,
      status: prev.status.includes(value)
        ? prev.status.filter(s => s !== value)
        : [...prev.status, value],
    }));
  };

  const renderResult = () => {
    if (!result) return null;
    return (
      <pre className="app theme-hint-color p-3 border-round">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  const toggleArrayState = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const toggleFoundersType = (value: string) => {
    setFoundersFilters(prev => ({
      ...prev,
      types: prev.types.includes(value) ? prev.types.filter(v => v !== value) : [...prev.types, value],
    }));
  };

  const toggleFoundersStatus = (value: string) => {
    setFoundersFilters(prev => ({
      ...prev,
      types: prev.statuses.includes(value) ? prev.statuses.filter(v => v !== value) : [...prev.statuses, value],
    }));
  };

  return (
    <React.Fragment>
      <div className="app p-0" />

      {/* Панель управления браузером */}
      <Panel className="shadow-5 mx-1" header="Взгляд Фримена">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <div className="flex align-items-center gap-2">
              <Button
                label="Запустить"
                icon="pi pi-play"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleLaunch}
              />
              <Button
                label="Остановить"
                icon="pi pi-stop"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleClose}
              />
            </div>
          </div>
        </div>
      </Panel>

      <div className="app p-0" />

      {/* Панель ввода данных */}
      <Panel className="shadow-5 mx-1" header="Поиск компании">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <span className="app font-size-subheading">ИНН</span>
            <div className="flex align-items-center gap-2">
              <InputText
                value={inn}
                onChange={handleInnChange}
                placeholder="Введите ИНН"
                className="w-full text-base"
              />
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needArbitr"
                checked={needArbitrDetails}
                onChange={(e) => setNeedArbitrDetails(e.checked as boolean)}
              />
              <label htmlFor="needArbitr" className="ml-2">
                Детальный список арбитражных дел
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needConnections"
                checked={needConnectionsDetails}
                onChange={(e) => setNeedConnectionsDetails(e.checked as boolean)}
              />
              <label htmlFor="needConnections" className="ml-2">Детальные связи</label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needSou"
                checked={needSouDetails}
                onChange={(e) => setNeedSouDetails(e.checked as boolean)}
              />
              <label htmlFor="needSou" className="ml-2">
                Детальные суды общей юрисдикции
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needTrademarks"
                checked={needTrademarksDetails}
                onChange={(e) => setNeedTrademarksDetails(e.checked ?? false)}
              />
              <label htmlFor="needTrademarks" className="ml-2">
                Детальные товарные знаки
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needLeasing"
                checked={needLeasingDetails}
                onChange={(e) => setNeedLeasingDetails(e.checked ?? false)}
              />
              <label htmlFor="needLeasing" className="ml-2">
                Детальный лизинг
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needPledges"
                checked={needPledgesDetails}
                onChange={(e) => setNeedPledgesDetails(e.checked ?? false)}
              />
              <label htmlFor="needPledges" className="ml-2">
                Детальные залоги
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needFacts"
                checked={needFactsDetails}
                onChange={(e) => setNeedFactsDetails(e.checked ?? false)}
              />
              <label htmlFor="needFacts" className="ml-2">
                Детальные существенные факты
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needBankruptcy"
                checked={needBankruptcyDetails}
                onChange={(e) => setNeedBankruptcyDetails(e.checked ?? false)}
              />
              <label htmlFor="needBankruptcy" className="ml-2">
                Детальное банкротство
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needFounders"
                checked={needFoundersDetails}
                onChange={(e) => setNeedFoundersDetails(e.checked ?? false)}
              />
              <label htmlFor="needFounders" className="ml-2">
                Детальный список учредителей
              </label>
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needReliability"
                checked={needReliabilityDetails}
                onChange={(e) => setNeedReliabilityDetails(e.checked ?? false)}
              />
              <label htmlFor="needReliability" className="ml-2">
                Собрать детальную надёжность
              </label>
            </div>

          </div>
        </div>

        {/* Фильтры арбитража (показываются при включённом чекбоксе) */}
        {needArbitrDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры арбитража</span>

              {/* Роль */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Роль:</span>
                <Checkbox
                  inputId="sidePlaintiff"
                  checked={arbitrFilters.sides.includes('plaintiff')}
                  onChange={() => toggleSide('plaintiff')}
                />
                <label htmlFor="sidePlaintiff" className="ml-1">Истец</label>
                <Checkbox
                  inputId="sideDefendant"
                  checked={arbitrFilters.sides.includes('defendant')}
                  onChange={() => toggleSide('defendant')}
                />
                <label htmlFor="sideDefendant" className="ml-1">Ответчик</label>
                <Checkbox
                  inputId="sideThird"
                  checked={arbitrFilters.sides.includes('third')}
                  onChange={() => toggleSide('third')}
                />
                <label htmlFor="sideThird" className="ml-1">Третье лицо</label>
              </div>

              {/* Статус */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <Checkbox
                  inputId="statusInProgress"
                  checked={arbitrFilters.status.includes('in_progress')}
                  onChange={() => toggleStatus('in_progress')}
                />
                <label htmlFor="statusInProgress" className="ml-1">Рассматривается</label>
                <Checkbox
                  inputId="statusCompleted"
                  checked={arbitrFilters.status.includes('completed')}
                  onChange={() => toggleStatus('completed')}
                />
                <label htmlFor="statusCompleted" className="ml-1">Завершено</label>
              </div>

              {/* Поиск */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск:</span>
                <InputText
                  value={arbitrFilters.search}
                  onChange={(e) => setArbitrFilters({ ...arbitrFilters, search: e.target.value })}
                  placeholder="Номер дела или ИНН"
                  className="w-full"
                />
              </div>

              {/* Лимиты */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText
                  type="number"
                  min={1}
                  max={100}
                  value={String(arbitrFilters.maxPages)}
                  onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxPages: parseInt(e.target.value) || 1 })}
                  className="w-4rem"
                />
                <span className="ml-3">Макс. дел:</span>
                <InputText
                  type="number"
                  min={1}
                  max={1000}
                  value={String(arbitrFilters.maxTotalCases)}
                  onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxTotalCases: parseInt(e.target.value) || 100 })}
                  className="w-4rem"
                />
              </div>
            </div>
          </div>
        )}

        {/* Фильтры СОЮ (показываются при включённом чекбоксе) */}
        {needSouDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры судов</span>

              {/* Роль */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Роль:</span>
                <select value={souRole} onChange={(e) => setSouRole(e.target.value)}>
                  <option value="all">Все</option>
                  <option value="defendant">Ответчик</option>
                  <option value="plaintiff">Истец</option>
                  <option value="representative">Представитель</option>
                  <option value="third_other_party">Третье/иное лицо</option>
                </select>
              </div>

              {/* Точность совпадения */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Точность:</span>
                <Checkbox inputId="souHigh" checked={souMatchLevels.includes('high')} onChange={() => toggleArrayState(setSouMatchLevels, 'high')} />
                <label htmlFor="souHigh" className="ml-1">Высокая</label>
                <Checkbox inputId="souMedium" checked={souMatchLevels.includes('medium')} onChange={() => toggleArrayState(setSouMatchLevels, 'medium')} />
                <label htmlFor="souMedium" className="ml-1">Средняя</label>
                <Checkbox inputId="souLow" checked={souMatchLevels.includes('low')} onChange={() => toggleArrayState(setSouMatchLevels, 'low')} />
                <label htmlFor="souLow" className="ml-1">Низкая</label>
              </div>

              {/* Поиск */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск (номер дела):</span>
                <InputText value={souSearch} onChange={(e) => setSouSearch(e.target.value)} placeholder="Номер дела" className="w-full" />
              </div>

              {/* Лимиты */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(souMaxPages)} onChange={(e) => setSouMaxPages(parseInt(e.target.value) || 1)} className="w-4rem" />
                <span className="ml-3">Макс. дел:</span>
                <InputText type="number" min={1} max={1000} value={String(souMaxTotalCases)} onChange={(e) => setSouMaxTotalCases(parseInt(e.target.value) || 100)} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needTrademarksDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры товарных знаков</span>

              <div className="flex align-items-center gap-2 mt-2">
                <Checkbox
                  inputId="tmOnlyActual"
                  checked={trademarkFilters.onlyActual}
                  onChange={(e) => setTrademarkFilters({ ...trademarkFilters, onlyActual: e.checked ?? false })}
                />
                <label htmlFor="tmOnlyActual" className="ml-1">Только действующие</label>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Тип:</span>
                <select
                  value={trademarkFilters.type}
                  onChange={(e) => setTrademarkFilters({ ...trademarkFilters, type: e.target.value })}
                >
                  <option value="all">Все</option>
                  <option value="combined">Комбинированный</option>
                  <option value="verbal">Словесный</option>
                  <option value="visual">Изобразительный</option>
                  <option value="unknown">Не определено</option>
                </select>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск (номер регистрации):</span>
                <InputText
                  value={trademarkFilters.search}
                  onChange={(e) => setTrademarkFilters({ ...trademarkFilters, search: e.target.value })}
                  placeholder="Номер гос. регистрации"
                  className="w-full"
                />
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText
                  type="number"
                  min={1}
                  max={100}
                  value={String(trademarkFilters.maxPages)}
                  onChange={(e) => setTrademarkFilters({ ...trademarkFilters, maxPages: parseInt(e.target.value) || 1 })}
                  className="w-4rem"
                />
                <span className="ml-3">Макс. знаков:</span>
                <InputText
                  type="number"
                  min={1}
                  max={1000}
                  value={String(trademarkFilters.maxTotalCases)}
                  onChange={(e) => setTrademarkFilters({ ...trademarkFilters, maxTotalCases: parseInt(e.target.value) || 100 })}
                  className="w-4rem"
                />
              </div>
            </div>
          </div>
        )}

        {needLeasingDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры лизинга</span>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Роль:</span>
                <select value={leasingFilters.role} onChange={(e) => setLeasingFilters({ ...leasingFilters, role: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="Lessee">Лизингополучатель</option>
                  <option value="Lessor">Лизингодатель</option>
                </select>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <select value={leasingFilters.status} onChange={(e) => setLeasingFilters({ ...leasingFilters, status: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="ok">Действующий</option>
                  <option value="ended">Завершённый</option>
                  <option value="stopped">Прекращённый</option>
                </select>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Предмет аренды:</span>
                <select value={leasingFilters.code} onChange={(e) => setLeasingFilters({ ...leasingFilters, code: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="0000001">Материальные активы</option>
                  <option value="0104008">Металлообрабатывающее оборудование</option>
                </select>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск (номер договора):</span>
                <InputText
                  value={leasingFilters.search}
                  onChange={(e) => setLeasingFilters({ ...leasingFilters, search: e.target.value })}
                  placeholder="Номер договора"
                  className="w-full"
                />
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(leasingFilters.maxPages)} onChange={(e) => setLeasingFilters({ ...leasingFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. договоров:</span>
                <InputText type="number" min={1} max={1000} value={String(leasingFilters.maxTotalCases)} onChange={(e) => setLeasingFilters({ ...leasingFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needPledgesDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры залогов</span>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Роль:</span>
                <select value={pledgesFilters.role} onChange={(e) => setPledgesFilters({ ...pledgesFilters, role: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="Mortgagor">Залогодатель</option>
                  <option value="Mortgagee">Залогодержатель</option>
                </select>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <select value={pledgesFilters.status} onChange={(e) => setPledgesFilters({ ...pledgesFilters, status: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="ended">Завершено</option>
                  <option value="annul">Аннулировано</option>
                  <option value="undefined">Не определено</option>
                </select>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(pledgesFilters.maxPages)} onChange={(e) => setPledgesFilters({ ...pledgesFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. сообщений:</span>
                <InputText type="number" min={1} max={1000} value={String(pledgesFilters.maxTotalCases)} onChange={(e) => setPledgesFilters({ ...pledgesFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needFactsDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры фактов</span>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Категория:</span>
                <select value={factsFilters.group} onChange={(e) => setFactsFilters({ ...factsFilters, group: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="obespechitelnye_interesy_i_obyazatelstva">Обеспечительные интересы и обязательства</option>
                  <option value="licenzii_razresheniya_samoregulirovaniya">Лицензии, разрешения, саморегулирования</option>
                  <option value="bankrotstva_i_ispolnitelnye_proizvodstva">Банкротства и исполнительные производства</option>
                  <option value="prochee">Прочее</option>
                </select>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <Checkbox
                  inputId="withAnnulled"
                  checked={factsFilters.withAnnulled}
                  onChange={(e) => setFactsFilters({ ...factsFilters, withAnnulled: e.checked ?? false })}
                />
                <label htmlFor="withAnnulled" className="ml-1">Аннулированные сообщения</label>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(factsFilters.maxPages)} onChange={(e) => setFactsFilters({ ...factsFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. фактов:</span>
                <InputText type="number" min={1} max={1000} value={String(factsFilters.maxTotalCases)} onChange={(e) => setFactsFilters({ ...factsFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needBankruptcyDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры банкротства</span>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск (номер сообщения или дела):</span>
                <InputText
                  value={bankruptcyFilters.search}
                  onChange={(e) => setBankruptcyFilters({ ...bankruptcyFilters, search: e.target.value })}
                  placeholder="Номер сообщения или дела"
                  className="w-full"
                />
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(bankruptcyFilters.maxPages)} onChange={(e) => setBankruptcyFilters({ ...bankruptcyFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. сообщений:</span>
                <InputText type="number" min={1} max={1000} value={String(bankruptcyFilters.maxTotalCases)} onChange={(e) => setBankruptcyFilters({ ...bankruptcyFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needFoundersDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры учредителей</span>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Тип:</span>
                <Checkbox inputId="founderOrgRus" checked={foundersFilters.types.includes('org_rus')} onChange={() => toggleFoundersType('org_rus')} />
                <label htmlFor="founderOrgRus" className="ml-1">Юридические лица</label>
                <Checkbox inputId="founderPerson" checked={foundersFilters.types.includes('person')} onChange={() => toggleFoundersType('person')} />
                <label htmlFor="founderPerson" className="ml-1">Физические лица</label>
                <Checkbox inputId="founderForeign" checked={foundersFilters.types.includes('org_foreign')} onChange={() => toggleFoundersType('org_foreign')} />
                <label htmlFor="founderForeign" className="ml-1">Иностранные</label>
                <Checkbox inputId="founderState" checked={foundersFilters.types.includes('state')} onChange={() => toggleFoundersType('state')} />
                <label htmlFor="founderState" className="ml-1">Госструктуры</label>
                <Checkbox inputId="founderFund" checked={foundersFilters.types.includes('fund')} onChange={() => toggleFoundersType('fund')} />
                <label htmlFor="founderFund" className="ml-1">ПИФы</label>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <Checkbox inputId="founderActual" checked={foundersFilters.statuses.includes('actual')} onChange={() => toggleFoundersStatus('actual')} />
                <label htmlFor="founderActual" className="ml-1">Актуальные</label>
                <Checkbox inputId="founderHistorical" checked={foundersFilters.statuses.includes('historical')} onChange={() => toggleFoundersStatus('historical')} />
                <label htmlFor="founderHistorical" className="ml-1">Исторические</label>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(foundersFilters.maxPages)} onChange={(e) => setFoundersFilters({ ...foundersFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. учредителей:</span>
                <InputText type="number" min={1} max={1000} value={String(foundersFilters.maxTotalCases)} onChange={(e) => setFoundersFilters({ ...foundersFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap app p-2 align-items-center gap-4">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <Button
              label={loading ? 'Сбор...' : 'Собрать данные'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
              className="p-button-lg w-full p-button-raised p-button-accent"
              onClick={handleScrapeRusprofile}
              disabled={loading}
            />
          </div>
        </div>


      </Panel>

      <div className="app p-0" />

      {/* Панель для kad.arbitr.ru и mos-gorsud.ru */}
      <Panel className="shadow-5 mx-1" header="Дополнительные источники">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <div className="flex align-items-center gap-2">
              <Button
                label="kad.arbitr.ru"
                icon="pi pi-external-link"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={() => { /* будет реализовано позже */ }}
                disabled={loading}
              />
              <Button
                label="mos-gorsud.ru"
                icon="pi pi-external-link"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={() => { /* будет реализовано позже */ }}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="app p-0">
          <div className="p-error mx-2">{error}</div>
        </div>
      )}

      {result && (
        <React.Fragment>
          <div className="app p-0" />
          <Panel className="shadow-5 mx-1" header="Результат">
            <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
              <div className="flex-1 flex flex-column gap-1 xl:mr-8">
                {renderResult()}
              </div>
            </div>
          </Panel>
        </React.Fragment>
      )}
    </React.Fragment>
  );
};