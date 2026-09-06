import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';

export const DatabasePage: React.FC = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState('');

  const api = (window as any).electronAPI;

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

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-4">
      <h2>База данных OSINT</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <Button label="Обновить" icon="pi pi-refresh" onClick={loadData} className="mb-2" />

      <TabView>
        <TabPanel header={`Сущности (${entities.length})`}>
          <DataTable value={entities} paginator rows={20} responsiveLayout="scroll">
            <Column field="id" header="ID" sortable />
            <Column field="type" header="Тип" sortable />
            <Column field="label" header="Название" sortable />
            <Column field="confidence" header="Уверенность" sortable />
            <Column field="status" header="Статус" sortable />
            <Column field="last_seen" header="Обновлено" sortable />
          </DataTable>
        </TabPanel>

        <TabPanel header={`Связи (${relations.length})`}>
          <DataTable value={relations} paginator rows={20} responsiveLayout="scroll">
            <Column field="subject_label" header="Исходная сущность" sortable />
            <Column field="predicate" header="Тип связи" sortable />
            <Column field="object_label" header="Целевая сущность" sortable />
            <Column field="confidence" header="Уверенность" sortable />
            <Column field="status" header="Статус" sortable />
          </DataTable>
        </TabPanel>

        <TabPanel header={`Наблюдения (${observations.length})`}>
          <DataTable value={observations} paginator rows={20} responsiveLayout="scroll">
            <Column field="entity_label" header="Сущность" sortable />
            <Column field="attribute" header="Атрибут" sortable />
            <Column field="value" header="Значение" sortable />
            <Column field="observed_at" header="Дата" sortable />
          </DataTable>
        </TabPanel>

        <TabPanel header={`Источники (${sources.length})`}>
          <DataTable value={sources} paginator rows={20} responsiveLayout="scroll">
            <Column field="id" header="ID" sortable />
            <Column field="url" header="URL" sortable />
            <Column field="title" header="Название" sortable />
            <Column field="source_type" header="Тип" sortable />
            <Column field="retrieved_at" header="Дата получения" sortable />
          </DataTable>
        </TabPanel>
      </TabView>
    </div>
  );
};