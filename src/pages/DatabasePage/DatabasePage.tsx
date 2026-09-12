import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';

import './DatabasePage.css';

export const DatabasePage: React.FC = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState('');

  // Поиск
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  const api = (window as any).electronAPI;

  const entityTypeOptions = [
    { label: 'Все', value: 'all' },
    { label: 'Юрлицо', value: 'company' },
    { label: 'ИП', value: 'entrepreneur' },
    { label: 'Физлицо', value: 'person' },
    { label: 'Домен', value: 'domain' },
    { label: 'Email', value: 'email' },
    { label: 'Телефон', value: 'phone' },
    { label: 'Адрес', value: 'address' },
    { label: 'Документ', value: 'document' },
    { label: 'Прочее', value: 'other' },
  ];

  const loadData = async () => {
    try {
      const [ent, rel, obs, src] = await Promise.all([
        api.getEntities(200, 0),
        api.getRelations(200, 0),
        api.getObservations(200, 0),
        api.getSources(200, 0),
      ]);
      setEntities(ent);
      setRelations(rel);
      setObservations(obs);
      setSources(src);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchActive(false);
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setError('');
    try {
      const res = await api.searchEntities(searchQuery.trim(), searchType, 200, 0);
      if (res.success) {
        setSearchResults(res.items || []);
        setSearchActive(true);
      } else {
        setError(res.error || 'Ошибка поиска');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setSearchType('all');
    setSearchResults([]);
    setSearchActive(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const displayEntities = searchActive ? searchResults : entities;

  return (
    <div className="p-4">
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Панель поиска */}
      <Panel className="shadow-5 mb-3" header="Поиск по сущностям">
        <div className="flex flex-wrap align-items-center gap-3 py-2">
          <div className="flex-1" style={{ minWidth: '240px' }}>
            <span className="p-input-icon-left w-full search-input-with-icon">
              <i className="pi pi-search" />
              <InputText
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Название, ИНН, ФИО и т.п."
                className="w-full text-base"
              />
            </span>
          </div>
          <div style={{ minWidth: '180px' }}>
            <Dropdown
              value={searchType}
              options={entityTypeOptions}
              onChange={(e) => setSearchType(e.value)}
              placeholder="Тип сущности"
              className="w-full"
            />
          </div>
          <Button
            label={searchLoading ? 'Поиск...' : 'Найти'}
            icon={searchLoading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
            className="p-button-raised p-button-accent"
            onClick={handleSearch}
            disabled={searchLoading}
          />
          {(searchActive || searchQuery) && (
            <Button
              label="Сбросить"
              icon="pi pi-times"
              className="p-button-raised p-button-outlined"
              onClick={handleResetSearch}
            />
          )}
          <Button
            label="Обновить всё"
            icon="pi pi-refresh"
            className="p-button-raised p-button-accent"
            onClick={loadData}
          />
        </div>

        {searchActive && (
          <div className="mt-2 text-sm">
            Найдено: <b>{searchResults.length}</b> записей
          </div>
        )}
      </Panel>

      {/* Панель таблиц */}
      <Panel className="shadow-5 mb-3" header="Таблицы">
        <TabView className="my-3">
          <TabPanel header={`Сущности (${displayEntities.length})`}>
            <DataTable
              value={displayEntities}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              responsiveLayout="scroll"
              className="db-entities-table"
              emptyMessage={searchActive ? 'Ничего не найдено' : 'Нет данных'}
            >
              <Column field="id" header="ID" sortable />
              <Column field="type" header="Тип" sortable />
              <Column field="label" header="Название" sortable />
              <Column field="value" header="Значение" sortable />
              <Column field="confidence" header="Уверенность" sortable />
              <Column field="status" header="Статус" sortable />
              <Column field="last_seen" header="Обновлено" sortable />
            </DataTable>
          </TabPanel>

          <TabPanel header={`Связи (${relations.length})`}>
            <DataTable
              value={relations}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              className="db-entities-table"
              responsiveLayout="scroll"
            >
              <Column field="subject_label" header="Исходная сущность" sortable />
              <Column field="predicate" header="Тип связи" sortable />
              <Column field="object_label" header="Целевая сущность" sortable />
              <Column field="confidence" header="Уверенность" sortable />
              <Column field="status" header="Статус" sortable />
            </DataTable>
          </TabPanel>

          <TabPanel header={`Наблюдения (${observations.length})`}>
            <DataTable
              value={observations}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              className="db-entities-table"
              responsiveLayout="scroll"
            >
              <Column field="entity_label" header="Сущность" sortable />
              <Column field="attribute" header="Атрибут" sortable />
              <Column field="value" header="Значение" sortable />
              <Column field="observed_at" header="Дата" sortable />
            </DataTable>
          </TabPanel>

          <TabPanel header={`Источники (${sources.length})`}>
            <DataTable
              value={sources}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              className="db-entities-table"
              responsiveLayout="scroll"
            >
              <Column field="id" header="ID" sortable />
              <Column field="url" header="URL" sortable />
              <Column field="title" header="Название" sortable />
              <Column field="source_type" header="Тип" sortable />
              <Column field="retrieved_at" header="Дата получения" sortable />
            </DataTable>
          </TabPanel>
        </TabView>
      </Panel>
    </div>
  );
};