// src/components/SIETCH/JudgesDirectoryDialog.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { DataTable, DataTablePageEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';

export interface JudgesDirectoryDialogProps {
  visible: boolean;
  onHide: () => void;
}

interface JudgeRow {
  id: number;
  judge_uuid: string;
  name: string;
  post: string | null;
  court_id: number | null;
  court_tag: string | null;
  court_name: string | null;
  court_type: string | null;
  first_seen: string;
  last_seen: string;
}

interface CourtOption {
  label: string;
  value: string | null;
}

const PAGE_SIZE = 50;

export const JudgesDirectoryDialog: React.FC<JudgesDirectoryDialogProps> = ({
  visible,
  onHide,
}) => {
  const api = (window as any).electronAPI;

  const [items, setItems] = useState<JudgeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [courtTag, setCourtTag] = useState<string | null>(null);
  const [courtOptions, setCourtOptions] = useState<CourtOption[]>([
    { label: 'Все суды', value: null },
  ]);

  const [page, setPage] = useState(0);
  const [first, setFirst] = useState(0);

  const debounceRef = useRef<any>(null);

  const load = async (
    opts: { search?: string; courtTag?: string | null; offset?: number; limit?: number } = {}
  ) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listJudges({
        search: opts.search ?? search,
        courtTag: opts.courtTag !== undefined ? opts.courtTag : courtTag,
        limit: opts.limit ?? PAGE_SIZE,
        offset: opts.offset ?? page * PAGE_SIZE,
      });
      if (res.success) {
        setItems(res.items || []);
        setTotal(res.total || 0);
      } else {
        setError(res.error || 'Ошибка загрузки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadCourts = async () => {
    try {
      const res = await api.listCourts();
      if (res.success) {
        setCourtOptions([
          { label: 'Все суды', value: null },
          ...(res.items || []).map((c: any) => ({
            label: c.court_name,
            value: c.court_tag,
          })),
        ]);
      }
    } catch {
      // ignore
    }
  };

  // При открытии — сброс и загрузка
  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setCourtTag(null);
    setPage(0);
    setFirst(0);
    load({ search: '', courtTag: null, offset: 0 });
    loadCourts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Debounce поиска
  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      setFirst(0);
      load({ search, courtTag, offset: 0 });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Смена суда — сразу загрузка
  useEffect(() => {
    if (!visible) return;
    setPage(0);
    setFirst(0);
    load({ search, courtTag, offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtTag]);

  const handlePage = (e: DataTablePageEvent) => {
    const newFirst = e.first;
    const newPage = Math.floor(newFirst / PAGE_SIZE);
    setFirst(newFirst);
    setPage(newPage);
    load({ search, courtTag, offset: newPage * PAGE_SIZE });
  };

  const refresh = () => {
    load({ search, courtTag, offset: page * PAGE_SIZE });
  };

  const handleDelete = async (row: JudgeRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Удалить судью из справочника?\n\n${row.name}\n${row.court_name || ''}\n\n` +
      `UUID: ${row.judge_uuid}\n\n` +
      `Это удалит только запись из справочника. При следующем обходе она может вернуться, ` +
      `если судья ещё активен в kad.arbitr.`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      const res = await api.deleteJudge(row.id);
      if (res.success) {
        // Обновить список
        await load({ search, courtTag, offset: page * PAGE_SIZE });
      } else {
        setError(res.error || 'Ошибка удаления');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : '—';

  return (
    <Dialog
      visible={visible}
      style={{ width: '1100px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={
        <div className="flex align-items-center gap-2">
          <span className="p-panel-title">Справочник судей kad.arbitr</span>
          <span className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Всего: <b>{total}</b>
          </span>
        </div>
      }
      footer={
        <div className="p-panel-footer flex justify-content-end gap-2">
          <Button
            label="Закрыть"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
          />
        </div>
      }
    >
      <div className="flex flex-column gap-2">
        {/* Фильтры */}
        <div className="flex flex-wrap align-items-center gap-2 mb-2">
          <div style={{ minWidth: '280px', flex: 1 }}>
            <span className="p-input-icon-left w-full">
              <i className="pi pi-search" />
              <InputText
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по ФИО..."
                className="w-full"
              />
            </span>
          </div>
          <div style={{ minWidth: '280px' }}>
            <Dropdown
              value={courtTag}
              options={courtOptions}
              onChange={(e) => setCourtTag(e.value)}
              placeholder="Все суды"
              filter
              className="w-full"
            />
          </div>
          <Button
            icon="pi pi-refresh"
            className="osint-soft"
            onClick={refresh}
            disabled={loading}
            tooltip="Обновить"
          />
        </div>

        {error && <p className="p-error">{error}</p>}

        <DataTable
          value={items}
          loading={loading}
          paginator
          rows={PAGE_SIZE}
          totalRecords={total}
          lazy
          first={first}
          onPage={handlePage}
          rowsPerPageOptions={[PAGE_SIZE]}
          emptyMessage="Судей не найдено"
          size="small"
          scrollable
          scrollHeight="440px"
          responsiveLayout="scroll"
        >
          <Column field="name" header="ФИО" sortable style={{ minWidth: '14rem' }} />
          <Column
            field="court_name"
            header="Суд"
            sortable
            style={{ minWidth: '16rem' }}
            body={(r: JudgeRow) => r.court_name || <span className="text-500">—</span>}
          />
          <Column
            field="post"
            header="Должность"
            style={{ minWidth: '12rem' }}
            body={(r: JudgeRow) => r.post || <span className="text-500">—</span>}
          />
          <Column
            field="court_tag"
            header="Тег"
            style={{ width: '8rem' }}
            body={(r: JudgeRow) => (
              <code className="text-sm">{r.court_tag || '—'}</code>
            )}
          />
          <Column
            field="last_seen"
            header="Обновлён"
            sortable
            style={{ width: '11rem' }}
            body={(r: JudgeRow) => formatDate(r.last_seen)}
          />
          <Column
            header=""
            style={{ width: '4rem' }}
            bodyStyle={{ textAlign: 'center' }}
            body={(r: JudgeRow) => (
              <Button
                icon={deletingId === r.id ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
                className="osint-destructive-soft p-button-sm"
                tooltip="Удалить из справочника"
                tooltipOptions={{ position: 'left' }}
                onClick={(e) => handleDelete(r, e)}
                disabled={deletingId !== null}
              />
            )}
          />
        </DataTable>
      </div>
    </Dialog>
  );
};