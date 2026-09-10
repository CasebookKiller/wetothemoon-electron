// wetothemoon-electron/src/pages/OSINTPage/OSINTPage.tsx

import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Divider } from 'primereact/divider';

import { classNames } from '@/css/classnames';

import './OSINTPage.css';

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
  const [needSouDetails, setNeedSouDetails] = useState(false);

  const [souRole, setSouRole] = useState('all');
  const [souMatchLevels, setSouMatchLevels] = useState<string[]>([]);
  const [souSearch, setSouSearch] = useState('');
  const [souMaxPages, setSouMaxPages] = useState(1);
  const [souMaxTotalCases, setSouMaxTotalCases] = useState(100);

  const [needTrademarksDetails, setNeedTrademarksDetails] = useState(false);
  const [trademarkFilters, setTrademarkFilters] = useState({
    onlyActual: false,
    type: 'all',
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [arbitrFilters, setArbitrFilters] = useState({
    sides: [] as string[],
    status: [] as string[],
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

  const [needLeasingDetails, setNeedLeasingDetails] = useState(false);
  const [leasingFilters, setLeasingFilters] = useState({
    role: 'all',
    status: 'all',
    code: 'all',
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needPledgesDetails, setNeedPledgesDetails] = useState(false);
  const [pledgesFilters, setPledgesFilters] = useState({
    role: 'all',
    status: 'all',
    code: 'all',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needFactsDetails, setNeedFactsDetails] = useState(false);
  const [factsFilters, setFactsFilters] = useState({
    group: 'all',
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
    types: [] as string[],
    statuses: [] as string[],
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needReliabilityDetails, setNeedReliabilityDetails] = useState(false);
  const [needSanctionsDetails, setNeedSanctionsDetails] = useState(false);

  const [needGzDetails, setNeedGzDetails] = useState(false);
  const [gzFilters, setGzFilters] = useState({
    role: 'all',
    purchaseStatus: 'all',
    contractStatus: 'all',
    isContractor: 'all',
    category: 'all',
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needFsspDetails, setNeedFsspDetails] = useState(false);
  const [fsspFilters, setFsspFilters] = useState({
    statuses: [] as string[],
    objects: [] as string[],
    due: [] as string[],
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needInspectionsDetails, setNeedInspectionsDetails] = useState(false);
  const [inspectionsFilters, setInspectionsFilters] = useState({
    planned: [] as string[],
    statuses: [] as string[],
    results: [] as string[],
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needLicensesDetails, setNeedLicensesDetails] = useState(false);
  const [licensesFilters, setLicensesFilters] = useState({
    origins: [] as string[],
    statuses: [] as string[],
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needBranchesDetails, setNeedBranchesDetails] = useState(false);

  const [needHistoryDetails, setNeedHistoryDetails] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    importantOnly: false,
    maxPages: 1,
    maxTotalCases: 100,
  });

  const [needRequisitesDetails, setNeedRequisitesDetails] = useState(false);
  const [needOkvedDetails, setNeedOkvedDetails] = useState(false);
  const [needEgrulDetails, setNeedEgrulDetails] = useState(false);

  const [saveMessage, setSaveMessage] = useState('');
  const [supplementLoading, setSupplementLoading] = useState(false);
  const [supplementMessage, setSupplementMessage] = useState('');

  const [dumpExists, setDumpExists] = useState<boolean>(false);
  const [dumpInfo, setDumpInfo] = useState<any>(null);

  const [entityTypeFilter, setEntityTypeFilter] = useState<'auto' | 'company' | 'entrepreneur' | 'person'>('auto');

  const api = (window as any).electronAPI;

  const innDigits = inn.replace(/\D/g, '');
  const isLegalEntityInn = innDigits.length === 10;
  const isIndividualInn = innDigits.length === 12;

  useEffect(() => {
    if (inn.trim()) {
      checkDump(inn);
    }
  }, []);

  useEffect(() => {
    if (isLegalEntityInn) {
      setEntityTypeFilter('company');
    } else if (isIndividualInn) {
      if (entityTypeFilter === 'company') {
        setEntityTypeFilter('auto');
      }
    }
  }, [isLegalEntityInn, isIndividualInn]);

  const handleInnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInn(value);
    try {
      localStorage.setItem('osint_last_inn', value);
    } catch {
      // ignore
    }
    if (value.trim()) {
      checkDump(value);
    } else {
      setDumpExists(false);
      setDumpInfo(null);
    }
  };

  const checkDump = async (innToCheck: string) => {
    if (!innToCheck.trim()) return;
    try {
      const res = await api.checkDumpExists(innToCheck.trim());
      setDumpExists(res.exists);
      setDumpInfo(res.dumpInfo || null);
    } catch (e) {
      console.error('Ошибка проверки дампа:', e);
    }
  };

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
        filters: needArbitrDetails ? {
          sides: arbitrFilters.sides.length > 0 ? arbitrFilters.sides : undefined,
          status: arbitrFilters.status.length > 0 ? arbitrFilters.status : undefined,
          search: arbitrFilters.search.trim() || undefined,
        } : undefined,
        souFilters: needSouDetails ? {
          role: souRole,
          matchLevel: souMatchLevels,
          search: souSearch.trim() || undefined,
          maxPages: souMaxPages,
          maxTotalCases: souMaxTotalCases,
        } : undefined,
        trademarksDetails: needTrademarksDetails,
        trademarksFilters: needTrademarksDetails ? {
          onlyActual: trademarkFilters.onlyActual,
          type: trademarkFilters.type,
          search: trademarkFilters.search.trim() || undefined,
          maxPages: trademarkFilters.maxPages,
          maxTotalCases: trademarkFilters.maxTotalCases,
        } : undefined,
        leasingDetails: needLeasingDetails,
        leasingFilters: needLeasingDetails ? {
          role: leasingFilters.role,
          status: leasingFilters.status,
          code: leasingFilters.code,
          search: leasingFilters.search.trim() || undefined,
          maxPages: leasingFilters.maxPages,
          maxTotalCases: leasingFilters.maxTotalCases,
        } : undefined,
        pledgesDetails: needPledgesDetails,
        pledgesFilters: needPledgesDetails ? {
          role: pledgesFilters.role,
          status: pledgesFilters.status,
          maxPages: pledgesFilters.maxPages,
          maxTotalCases: pledgesFilters.maxTotalCases,
        } : undefined,
        factsDetails: needFactsDetails,
        factsFilters: needFactsDetails ? {
          group: factsFilters.group,
          withAnnulled: factsFilters.withAnnulled,
          maxPages: factsFilters.maxPages,
          maxTotalCases: factsFilters.maxTotalCases,
        } : undefined,
        bankruptcyDetails: needBankruptcyDetails,
        bankruptcyFilters: needBankruptcyDetails ? {
          search: bankruptcyFilters.search.trim() || undefined,
          maxPages: bankruptcyFilters.maxPages,
          maxTotalCases: bankruptcyFilters.maxTotalCases,
        } : undefined,
        foundersDetails: needFoundersDetails,
        foundersFilters: needFoundersDetails ? {
          types: foundersFilters.types,
          statuses: foundersFilters.statuses,
          maxPages: foundersFilters.maxPages,
          maxTotalCases: foundersFilters.maxTotalCases,
        } : undefined,
        reliabilityDetails: needReliabilityDetails,
        gzDetails: needGzDetails,
        gzFilters: needGzDetails ? {
          role: gzFilters.role,
          purchaseStatus: gzFilters.purchaseStatus,
          contractStatus: gzFilters.contractStatus,
          search: gzFilters.search.trim() || undefined,
          maxPages: gzFilters.maxPages,
          maxTotalCases: gzFilters.maxTotalCases,
        } : undefined,
        fsspDetails: needFsspDetails,
        fsspFilters: needFsspDetails ? {
          statuses: fsspFilters.statuses,
          maxPages: fsspFilters.maxPages,
          maxTotalCases: fsspFilters.maxTotalCases,
        } : undefined,
        inspectionsDetails: needInspectionsDetails,
        inspectionsFilters: needInspectionsDetails ? {
          planned: inspectionsFilters.planned,
          statuses: inspectionsFilters.statuses,
          results: inspectionsFilters.results,
          maxPages: inspectionsFilters.maxPages,
          maxTotalCases: inspectionsFilters.maxTotalCases,
        } : undefined,
        licensesDetails: needLicensesDetails,
        licensesFilters: needLicensesDetails ? {
          origins: licensesFilters.origins,
          statuses: licensesFilters.statuses,
          maxPages: licensesFilters.maxPages,
          maxTotalCases: licensesFilters.maxTotalCases,
        } : undefined,
        branchesDetails: needBranchesDetails,
        historyDetails: needHistoryDetails,
        historyFilters: needHistoryDetails ? {
          importantOnly: historyFilters.importantOnly,
          maxPages: historyFilters.maxPages,
          maxTotalCases: historyFilters.maxTotalCases,
        } : undefined,
        requisitesDetails: needRequisitesDetails,
        okvedDetails: needOkvedDetails,
        egrulDetails: needEgrulDetails,
        preferredType: entityTypeFilter === 'auto' ? undefined : entityTypeFilter,
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

  const handleSaveToDb = async () => {
    if (!result) {
      setSaveMessage('Нет данных для сохранения');
      return;
    }
    setSaveMessage('');
    try {
      const companyId = result.company_id;
      if (!companyId) {
        setSaveMessage('Не удалось определить ID сущности.');
        return;
      }

      const response = await api.saveCompany(companyId, inn, result);
      if (response.success) {
        setSaveMessage(
          `Сохранено: сущностей ${response.savedEntities}, связей ${response.savedRelations}, наблюдений ${response.savedObservations}`
        );
        // Обновляем информацию о дампе (появятся даты, кнопка заблокируется)
        await checkDump(inn);
        setResult(null); // раскомментируйте, если хотите скрыть JSON после сохранения
      } else {
        setSaveMessage(`Ошибка: ${response.error}`);
      }
    } catch (e) {
      setSaveMessage((e as Error).message);
    }
  };

  const handleSupplement = async () => {
    if (!inn.trim()) {
      setError('Введите ИНН');
      return;
    }

    const sectionsToUpdate: string[] = [];
    if (needArbitrDetails) sectionsToUpdate.push('arbitration_details');
    if (needConnectionsDetails) sectionsToUpdate.push('connections_details');
    if (needSouDetails) sectionsToUpdate.push('sou_details');
    if (needTrademarksDetails) sectionsToUpdate.push('trademarks_details');
    if (needLeasingDetails) sectionsToUpdate.push('leasing_details');
    if (needPledgesDetails) sectionsToUpdate.push('pledges_details');
    if (needFactsDetails) sectionsToUpdate.push('facts_details');
    if (needBankruptcyDetails) sectionsToUpdate.push('bankruptcy_details');
    if (needFoundersDetails) sectionsToUpdate.push('founders_details');
    if (needReliabilityDetails) sectionsToUpdate.push('reliability_details');
    if (needSanctionsDetails) sectionsToUpdate.push('sanctions_details');
    if (needGzDetails) sectionsToUpdate.push('gz_details');
    if (needFsspDetails) sectionsToUpdate.push('fssp_details');
    if (needInspectionsDetails) sectionsToUpdate.push('inspections_details');
    if (needLicensesDetails) sectionsToUpdate.push('licenses_details');
    if (needBranchesDetails) sectionsToUpdate.push('branches_details');
    if (needHistoryDetails) sectionsToUpdate.push('history_details');
    if (needRequisitesDetails) sectionsToUpdate.push('requisites_details');
    if (needOkvedDetails) sectionsToUpdate.push('okved_details');
    if (needEgrulDetails) sectionsToUpdate.push('egrul_details');

    // Сводка всегда обновляется
    sectionsToUpdate.push('summary');

    setSupplementLoading(true);
    setSupplementMessage('');
    setError('');
    try {
      const response = await api.supplementCompany(inn.trim(), sectionsToUpdate);
      if (response.success) {
        setSupplementMessage(
          `Дозагрузка завершена: сущностей ${response.savedEntities}, связей ${response.savedRelations}, наблюдений ${response.savedObservations}`
        );
        if (response.data) {
          setResult(response.data);
        }
        await checkDump(inn.trim());
      } else {
        setSupplementMessage(`Ошибка: ${response.error}`);
      }
    } catch (e) {
      setSupplementMessage((e as Error).message);
    } finally {
      setSupplementLoading(false);
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
      <pre
        className="app theme-hint-color p-3 border-round"
        style={{ maxHeight: '50vh', overflowY: 'auto' }}
      >
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
      statuses: prev.statuses.includes(value) ? prev.statuses.filter(v => v !== value) : [...prev.statuses, value],
    }));
  };

  const toggleFsspStatus = (value: string) => {
    setFsspFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(value) ? prev.statuses.filter(v => v !== value) : [...prev.statuses, value],
    }));
  };

  const toggleInspectionsPlanned = (value: string) => {
    setInspectionsFilters(prev => ({
      ...prev,
      planned: prev.planned.includes(value) ? prev.planned.filter(v => v !== value) : [...prev.planned, value],
    }));
  };
  
  const toggleInspectionsStatus = (value: string) => { 
    setInspectionsFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(value) ? prev.statuses.filter(v => v !== value) : [...prev.statuses, value],
    }));
  };
  const toggleInspectionsResult = (value: string) => { 
    setInspectionsFilters(prev => ({
      ...prev,
      results: prev.results.includes(value) ? prev.results.filter(v => v !== value) : [...prev.results, value],
    }));
  };

  const toggleLicensesOrigin = (value: string) => {
    setLicensesFilters(prev => ({
      ...prev,
      origins: prev.origins.includes(value) ? prev.origins.filter(v => v !== value) : [...prev.origins, value],
    }));
  };

  const toggleLicensesStatus = (value: string) => {
    setLicensesFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(value) ? prev.statuses.filter(v => v !== value) : [...prev.statuses, value],
    }));
  };

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

  const sectionOptions = [
    { key: 'needArbitrDetails', label: 'Арбитражные дела', section: 'arbitration_details' },
    { key: 'needConnectionsDetails', label: 'Связи', section: 'connections_details' },
    { key: 'needSouDetails', label: 'Суды общей юрисдикции', section: 'sou_details' },
    { key: 'needTrademarksDetails', label: 'Товарные знаки', section: 'trademarks_details' },
    { key: 'needLeasingDetails', label: 'Лизинг', section: 'leasing_details' },
    { key: 'needPledgesDetails', label: 'Залоги', section: 'pledges_details' },
    { key: 'needFactsDetails', label: 'Существенные факты', section: 'facts_details' },
    { key: 'needBankruptcyDetails', label: 'Банкротство', section: 'bankruptcy_details' },
    { key: 'needFoundersDetails', label: 'Учредители', section: 'founders_details' },
    { key: 'needReliabilityDetails', label: 'Надёжность', section: 'reliability_details' },
    { key: 'needSanctionsDetails', label: 'Санкции', section: 'sanctions_details' },
    { key: 'needGzDetails', label: 'Госзакупки', section: 'gz_details' },
    { key: 'needFsspDetails', label: 'Исполнительные производства', section: 'fssp_details' },
    { key: 'needInspectionsDetails', label: 'Проверки', section: 'inspections_details' },
    { key: 'needLicensesDetails', label: 'Лицензии', section: 'licenses_details' },
    { key: 'needBranchesDetails', label: 'Филиалы и представительства', section: 'branches_details' },
    { key: 'needHistoryDetails', label: 'История', section: 'history_details' },
    { key: 'needRequisitesDetails', label: 'Реквизиты', section: 'requisites_details' },
    { key: 'needOkvedDetails', label: 'Виды деятельности', section: 'okved_details' },
    { key: 'needEgrulDetails', label: 'Выписка из ЕГРЮЛ', section: 'egrul_details' },
  ];

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  const footer = dumpExists && (
    <div>
      <p className="p-warning mt-2">
        Дамп для этой организации уже существует. Используйте «Дополнить выбранные разделы» для обновления.
      </p>
      {dumpInfo?.sectionUpdatedAt?.summary && (
        <p className="text-xs mt-1">
          Сводка обновлена: {formatDate(dumpInfo.sectionUpdatedAt.summary)}
        </p>
      )}
    </div>
  );

  return (
    <React.Fragment>
      <div className="app p-0" />

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

      <Panel
        className="shadow-5 mx-1"
        header="Поиск по ИНН"
        footer={footer}
      >
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
            <div className="flex align-items-center gap-2">
              {innDigits.length > 0 && innDigits.length !== 10 && innDigits.length !== 12 && (
                <small className="p-error">ИНН должен содержать 10 или 12 цифр</small>
              )}
            </div>

            <div className="flex align-items-center gap-3 mt-2">
              <span>Тип:</span>
              <label
                className="flex align-items-center gap-1"
                style={{ color: isLegalEntityInn ? '#999' : 'inherit' }}
              >
                <input
                  type="radio"
                  name="entityType"
                  value="auto"
                  checked={entityTypeFilter === 'auto'}
                  onChange={() => setEntityTypeFilter('auto')}
                  disabled={isLegalEntityInn}
                />
                Авто
              </label>
              <label
                className="flex align-items-center gap-1"
                style={{ color: isIndividualInn ? '#999' : 'inherit' }}
              >
                <input
                  type="radio"
                  name="entityType"
                  value="company"
                  checked={entityTypeFilter === 'company'}
                  onChange={() => setEntityTypeFilter('company')}
                  disabled={isIndividualInn}
                />
                Юрлицо
              </label>
              <label
                className="flex align-items-center gap-1"
                style={{ color: isLegalEntityInn ? '#999' : 'inherit' }}
              >
                <input
                  type="radio"
                  name="entityType"
                  value="entrepreneur"
                  checked={entityTypeFilter === 'entrepreneur'}
                  onChange={() => setEntityTypeFilter('entrepreneur')}
                  disabled={isLegalEntityInn}
                />
                ИП
              </label>
              <label
                className="flex align-items-center gap-1"
                style={{ color: isLegalEntityInn ? '#999' : 'inherit' }}
              >
                <input
                  type="radio"
                  name="entityType"
                  value="person"
                  checked={entityTypeFilter === 'person'}
                  onChange={() => setEntityTypeFilter('person')}
                  disabled={isLegalEntityInn}
                />
                Физлицо
              </label>
            </div>

            <div className="grid mt-2">
              {sectionOptions.map(({ key, label, section }) => {
                const checked = 
                  key === 'needArbitrDetails' ? needArbitrDetails :
                  key === 'needConnectionsDetails' ? needConnectionsDetails :
                  key === 'needSouDetails' ? needSouDetails :
                  key === 'needTrademarksDetails' ? needTrademarksDetails :
                  key === 'needLeasingDetails' ? needLeasingDetails :
                  key === 'needPledgesDetails' ? needPledgesDetails :
                  key === 'needFactsDetails' ? needFactsDetails :
                  key === 'needBankruptcyDetails' ? needBankruptcyDetails :
                  key === 'needFoundersDetails' ? needFoundersDetails :
                  key === 'needReliabilityDetails' ? needReliabilityDetails :
                  key === 'needSanctionsDetails' ? needSanctionsDetails :
                  key === 'needGzDetails' ? needGzDetails :
                  key === 'needFsspDetails' ? needFsspDetails :
                  key === 'needInspectionsDetails' ? needInspectionsDetails :
                  key === 'needLicensesDetails' ? needLicensesDetails :
                  key === 'needBranchesDetails' ? needBranchesDetails :
                  key === 'needHistoryDetails' ? needHistoryDetails :
                  key === 'needRequisitesDetails' ? needRequisitesDetails :
                  key === 'needOkvedDetails' ? needOkvedDetails :
                  key === 'needEgrulDetails' ? needEgrulDetails : false;

                const onChange = (e: any) => {
                  const val = e.checked;
                  switch (key) {
                    case 'needArbitrDetails': setNeedArbitrDetails(val); break;
                    case 'needConnectionsDetails': setNeedConnectionsDetails(val); break;
                    case 'needSouDetails': setNeedSouDetails(val); break;
                    case 'needTrademarksDetails': setNeedTrademarksDetails(val); break;
                    case 'needLeasingDetails': setNeedLeasingDetails(val); break;
                    case 'needPledgesDetails': setNeedPledgesDetails(val); break;
                    case 'needFactsDetails': setNeedFactsDetails(val); break;
                    case 'needBankruptcyDetails': setNeedBankruptcyDetails(val); break;
                    case 'needFoundersDetails': setNeedFoundersDetails(val); break;
                    case 'needReliabilityDetails': setNeedReliabilityDetails(val); break;
                    case 'needSanctionsDetails': setNeedSanctionsDetails(val); break;
                    case 'needGzDetails': setNeedGzDetails(val); break;
                    case 'needFsspDetails': setNeedFsspDetails(val); break;
                    case 'needInspectionsDetails': setNeedInspectionsDetails(val); break;
                    case 'needLicensesDetails': setNeedLicensesDetails(val); break;
                    case 'needBranchesDetails': setNeedBranchesDetails(val); break;
                    case 'needHistoryDetails': setNeedHistoryDetails(val); break;
                    case 'needRequisitesDetails': setNeedRequisitesDetails(val); break;
                    case 'needOkvedDetails': setNeedOkvedDetails(val); break;
                    case 'needEgrulDetails': setNeedEgrulDetails(val); break;
                  }
                };

                return (
                  <div className="col-12 md:col-6 lg:col-4 xl:col-3" key={key}>
                    <div className="flex align-items-start">
                      <Checkbox
                        inputId={key}
                        checked={checked}
                        onChange={onChange}
                      />
                      <label htmlFor={key} className="ml-2">{label}</label>
                    </div>
                    <div className="text-xs mt-1" style={{ fontSize: '0.75rem', color: 'gray', marginLeft: '1.75rem' }}>
                      {dumpExists && dumpInfo?.sectionUpdatedAt?.[section]
                        ? formatDate(dumpInfo.sectionUpdatedAt[section])
                        : 'Нет данных'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {needArbitrDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры арбитража</span>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Роль:</span>
                <Checkbox inputId="sidePlaintiff" checked={arbitrFilters.sides.includes('plaintiff')} onChange={() => toggleSide('plaintiff')} />
                <label htmlFor="sidePlaintiff" className="ml-1">Истец</label>
                <Checkbox inputId="sideDefendant" checked={arbitrFilters.sides.includes('defendant')} onChange={() => toggleSide('defendant')} />
                <label htmlFor="sideDefendant" className="ml-1">Ответчик</label>
                <Checkbox inputId="sideThird" checked={arbitrFilters.sides.includes('third')} onChange={() => toggleSide('third')} />
                <label htmlFor="sideThird" className="ml-1">Третье лицо</label>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <Checkbox inputId="statusInProgress" checked={arbitrFilters.status.includes('in_progress')} onChange={() => toggleStatus('in_progress')} />
                <label htmlFor="statusInProgress" className="ml-1">Рассматривается</label>
                <Checkbox inputId="statusCompleted" checked={arbitrFilters.status.includes('completed')} onChange={() => toggleStatus('completed')} />
                <label htmlFor="statusCompleted" className="ml-1">Завершено</label>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск:</span>
                <InputText value={arbitrFilters.search} onChange={(e) => setArbitrFilters({ ...arbitrFilters, search: e.target.value })} placeholder="Номер дела или ИНН" className="w-full" />
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(arbitrFilters.maxPages)} onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. дел:</span>
                <InputText type="number" min={1} max={1000} value={String(arbitrFilters.maxTotalCases)} onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needSouDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры судов</span>

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

              <div className="flex align-items-center gap-2 mt-2">
                <span>Точность:</span>
                <Checkbox inputId="souHigh" checked={souMatchLevels.includes('high')} onChange={() => toggleArrayState(setSouMatchLevels, 'high')} />
                <label htmlFor="souHigh" className="ml-1">Высокая</label>
                <Checkbox inputId="souMedium" checked={souMatchLevels.includes('medium')} onChange={() => toggleArrayState(setSouMatchLevels, 'medium')} />
                <label htmlFor="souMedium" className="ml-1">Средняя</label>
                <Checkbox inputId="souLow" checked={souMatchLevels.includes('low')} onChange={() => toggleArrayState(setSouMatchLevels, 'low')} />
                <label htmlFor="souLow" className="ml-1">Низкая</label>
              </div>

              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск (номер дела):</span>
                <InputText value={souSearch} onChange={(e) => setSouSearch(e.target.value)} placeholder="Номер дела" className="w-full" />
              </div>

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
                <Checkbox inputId="tmOnlyActual" checked={trademarkFilters.onlyActual} onChange={(e) => setTrademarkFilters({ ...trademarkFilters, onlyActual: e.checked ?? false })} />
                <label htmlFor="tmOnlyActual" className="ml-1">Только действующие</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Тип:</span>
                <select value={trademarkFilters.type} onChange={(e) => setTrademarkFilters({ ...trademarkFilters, type: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="combined">Комбинированный</option>
                  <option value="verbal">Словесный</option>
                  <option value="visual">Изобразительный</option>
                  <option value="unknown">Не определено</option>
                </select>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск (номер регистрации):</span>
                <InputText value={trademarkFilters.search} onChange={(e) => setTrademarkFilters({ ...trademarkFilters, search: e.target.value })} placeholder="Номер гос. регистрации" className="w-full" />
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(trademarkFilters.maxPages)} onChange={(e) => setTrademarkFilters({ ...trademarkFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. знаков:</span>
                <InputText type="number" min={1} max={1000} value={String(trademarkFilters.maxTotalCases)} onChange={(e) => setTrademarkFilters({ ...trademarkFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
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
                <InputText value={leasingFilters.search} onChange={(e) => setLeasingFilters({ ...leasingFilters, search: e.target.value })} placeholder="Номер договора" className="w-full" />
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
                <Checkbox inputId="withAnnulled" checked={factsFilters.withAnnulled} onChange={(e) => setFactsFilters({ ...factsFilters, withAnnulled: e.checked ?? false })} />
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
                <InputText value={bankruptcyFilters.search} onChange={(e) => setBankruptcyFilters({ ...bankruptcyFilters, search: e.target.value })} placeholder="Номер сообщения или дела" className="w-full" />
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

        {needGzDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры госзакупок</span>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Роль:</span>
                <select value={gzFilters.role} onChange={(e) => setGzFilters({ ...gzFilters, role: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="supplier">Участник</option>
                  <option value="customer">Заказчик</option>
                </select>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус закупки:</span>
                <select value={gzFilters.purchaseStatus} onChange={(e) => setGzFilters({ ...gzFilters, purchaseStatus: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="completed_winner">Выиграно</option>
                  <option value="completed_loser">Не выиграно</option>
                  <option value="unknown">Не определено</option>
                  <option value="cancelled">Отменена</option>
                  <option value="processing">В процессе</option>
                </select>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус контракта:</span>
                <select value={gzFilters.contractStatus} onChange={(e) => setGzFilters({ ...gzFilters, contractStatus: e.target.value })}>
                  <option value="all">Все</option>
                  <option value="E">Исполнение</option>
                  <option value="ET">Исполнение прекращено</option>
                  <option value="EC">Исполнение завершено</option>
                </select>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск (номер закупки/контракта):</span>
                <InputText value={gzFilters.search} onChange={(e) => setGzFilters({ ...gzFilters, search: e.target.value })} placeholder="Номер закупки или контракта" className="w-full" />
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(gzFilters.maxPages)} onChange={(e) => setGzFilters({ ...gzFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. закупок:</span>
                <InputText type="number" min={1} max={1000} value={String(gzFilters.maxTotalCases)} onChange={(e) => setGzFilters({ ...gzFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needFsspDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры ФССП</span>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <Checkbox inputId="fsspOpen" checked={fsspFilters.statuses.includes('1')} onChange={() => toggleFsspStatus('1')} />
                <label htmlFor="fsspOpen" className="ml-1">Открыто</label>
                <Checkbox inputId="fsspClosed" checked={fsspFilters.statuses.includes('2')} onChange={() => toggleFsspStatus('2')} />
                <label htmlFor="fsspClosed" className="ml-1">Завершено</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(fsspFilters.maxPages)} onChange={(e) => setFsspFilters({ ...fsspFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. производств:</span>
                <InputText type="number" min={1} max={1000} value={String(fsspFilters.maxTotalCases)} onChange={(e) => setFsspFilters({ ...fsspFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needInspectionsDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры проверок</span>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Тип:</span>
                <Checkbox inputId="inspPlanned0" checked={inspectionsFilters.planned.includes('0')} onChange={() => toggleInspectionsPlanned('0')} />
                <label htmlFor="inspPlanned0" className="ml-1">Внеплановая</label>
                <Checkbox inputId="inspPlanned1" checked={inspectionsFilters.planned.includes('1')} onChange={() => toggleInspectionsPlanned('1')} />
                <label htmlFor="inspPlanned1" className="ml-1">Плановая</label>
                <Checkbox inputId="inspPlanned2" checked={inspectionsFilters.planned.includes('2')} onChange={() => toggleInspectionsPlanned('2')} />
                <label htmlFor="inspPlanned2" className="ml-1">Профилактическое</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <Checkbox inputId="inspStatus1" checked={inspectionsFilters.statuses.includes('1')} onChange={() => toggleInspectionsStatus('1')} />
                <label htmlFor="inspStatus1" className="ml-1">Завершена</label>
                <Checkbox inputId="inspStatus0" checked={inspectionsFilters.statuses.includes('0')} onChange={() => toggleInspectionsStatus('0')} />
                <label htmlFor="inspStatus0" className="ml-1">Неизвестно</label>
                <Checkbox inputId="inspStatus2" checked={inspectionsFilters.statuses.includes('2')} onChange={() => toggleInspectionsStatus('2')} />
                <label htmlFor="inspStatus2" className="ml-1">Ожидает завершения</label>
                <Checkbox inputId="inspStatus4" checked={inspectionsFilters.statuses.includes('4')} onChange={() => toggleInspectionsStatus('4')} />
                <label htmlFor="inspStatus4" className="ml-1">Ожидает проведения</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Результат:</span>
                <Checkbox inputId="inspResult0" checked={inspectionsFilters.results.includes('0')} onChange={() => toggleInspectionsResult('0')} />
                <label htmlFor="inspResult0" className="ml-1">Неизвестно</label>
                <Checkbox inputId="inspResult1" checked={inspectionsFilters.results.includes('1')} onChange={() => toggleInspectionsResult('1')} />
                <label htmlFor="inspResult1" className="ml-1">Без нарушений</label>
                <Checkbox inputId="inspResult2" checked={inspectionsFilters.results.includes('2')} onChange={() => toggleInspectionsResult('2')} />
                <label htmlFor="inspResult2" className="ml-1">Выявлены нарушения</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(inspectionsFilters.maxPages)} onChange={(e) => setInspectionsFilters({ ...inspectionsFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. проверок:</span>
                <InputText type="number" min={1} max={1000} value={String(inspectionsFilters.maxTotalCases)} onChange={(e) => setInspectionsFilters({ ...inspectionsFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needLicensesDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры лицензий</span>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Источник:</span>
                <Checkbox inputId="licEgrul" checked={licensesFilters.origins.includes('egrul')} onChange={() => toggleLicensesOrigin('egrul')} />
                <label htmlFor="licEgrul" className="ml-1">ЕГРЮЛ</label>
                <Checkbox inputId="licCbr" checked={licensesFilters.origins.includes('cbr')} onChange={() => toggleLicensesOrigin('cbr')} />
                <label htmlFor="licCbr" className="ml-1">Центральный банк</label>
                <Checkbox inputId="licRalcr" checked={licensesFilters.origins.includes('ralcr')} onChange={() => toggleLicensesOrigin('ralcr')} />
                <label htmlFor="licRalcr" className="ml-1">Росалкоголь</label>
                <Checkbox inputId="licRptrn" checked={licensesFilters.origins.includes('rptrn')} onChange={() => toggleLicensesOrigin('rptrn')} />
                <label htmlFor="licRptrn" className="ml-1">Роспотребнадзор</label>
                <Checkbox inputId="licRkomnbroadcast" checked={licensesFilters.origins.includes('rkomnbroadcast')} onChange={() => toggleLicensesOrigin('rkomnbroadcast')} />
                <label htmlFor="licRkomnbroadcast" className="ml-1">Роскомнадзор</label>
                <Checkbox inputId="licRtehn" checked={licensesFilters.origins.includes('rtehn')} onChange={() => toggleLicensesOrigin('rtehn')} />
                <label htmlFor="licRtehn" className="ml-1">Ростехнадзор</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <Checkbox inputId="licActive" checked={licensesFilters.statuses.includes('active')} onChange={() => toggleLicensesStatus('active')} />
                <label htmlFor="licActive" className="ml-1">Действующая</label>
                <Checkbox inputId="licInactive" checked={licensesFilters.statuses.includes('inactive')} onChange={() => toggleLicensesStatus('inactive')} />
                <label htmlFor="licInactive" className="ml-1">Недействующая</label>
                <Checkbox inputId="licUnknown" checked={licensesFilters.statuses.includes('unknown')} onChange={() => toggleLicensesStatus('unknown')} />
                <label htmlFor="licUnknown" className="ml-1">Неизвестно</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(licensesFilters.maxPages)} onChange={(e) => setLicensesFilters({ ...licensesFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. лицензий:</span>
                <InputText type="number" min={1} max={1000} value={String(licensesFilters.maxTotalCases)} onChange={(e) => setLicensesFilters({ ...licensesFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        {needHistoryDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры истории</span>
              <div className="flex align-items-center gap-2 mt-2">
                <Checkbox inputId="historyImportant" checked={historyFilters.importantOnly} onChange={(e) => setHistoryFilters({ ...historyFilters, importantOnly: e.checked ?? false })} />
                <label htmlFor="historyImportant" className="ml-1">Только важные события</label>
              </div>
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText type="number" min={1} max={100} value={String(historyFilters.maxPages)} onChange={(e) => setHistoryFilters({ ...historyFilters, maxPages: parseInt(e.target.value) || 1 })} className="w-4rem" />
                <span className="ml-3">Макс. записей:</span>
                <InputText type="number" min={1} max={1000} value={String(historyFilters.maxTotalCases)} onChange={(e) => setHistoryFilters({ ...historyFilters, maxTotalCases: parseInt(e.target.value) || 100 })} className="w-4rem" />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap app p-2 align-items-center gap-4">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            {!dumpExists ? (
              <Button
                label={loading ? 'Сбор...' : 'Собрать данные'}
                icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={handleScrapeRusprofile}
                disabled={loading}
              />
            ) : (
              <Button
                label={supplementLoading ? 'Дозагрузка...' : 'Дополнить выбранные разделы'}
                icon={supplementLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={handleSupplement}
                disabled={supplementLoading}
              />
            )}
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

      {result && !dumpExists && (
        <>
          <Button
            label="Сохранить в базу данных"
            icon="pi pi-save"
            className="p-button-lg w-full p-button-raised p-button-accent"
            onClick={handleSaveToDb}
          />
          {saveMessage && (
            <p className="p-info mt-2" style={{ color: saveMessage.startsWith('Ошибка') ? 'red' : 'green' }}>
              {saveMessage}
            </p>
          )}
        </>
      )}

      <div className="app p-0" />

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
    </React.Fragment>
  );
};