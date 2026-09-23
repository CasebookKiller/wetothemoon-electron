// src/components/SIETCH/KadArbitrCasesDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { KadArbitrCardDialog } from './KadArbitrCardDialog';

export interface KadArbitrCasesDialogProps {
  visible: boolean;
  cases: any[];
  inn: string;
  onHide: () => void;
}

export const KadArbitrCasesDialog: React.FC<KadArbitrCasesDialogProps> = ({
  visible,
  cases,
  inn,
  onHide,
}) => {
  const [cardDialogVisible, setCardDialogVisible] = useState(false);
  const [cardDialogUuid, setCardDialogUuid] = useState('');

  // Сброс вложенного диалога при закрытии/смене списка
  useEffect(() => {
    if (!visible) {
      setCardDialogVisible(false);
      setCardDialogUuid('');
    }
  }, [visible]);

  const openCard = (uuid: string) => {
    if (!uuid) return;
    setCardDialogUuid(uuid);
    setCardDialogVisible(true);
  };

  const partiesCell = (items: any[] | undefined) => {
    if (!items || items.length === 0) {
      return <span style={{ opacity: 0.5 }}>—</span>;
    }
    return (
      <span className="text-sm">
        {items.map((x, i) => (
          <div key={i} title={x.inn ? `ИНН ${x.inn}` : undefined}>
            {x.name}
          </div>
        ))}
      </span>
    );
  };

  const uniqueCases = React.useMemo(() => {
  const seen = new Set<string>();
  return cases.filter((c) => {
    const key = c.case_uuid || c.case_number;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  }, [cases]);

  return (
    <>
      <Dialog
        visible={visible}
        style={{ width: '1400px', maxWidth: '95vw' }}
        modal
        onHide={onHide}
        header={
          <span className="p-panel-title">
            kad.arbitr.ru — найденные дела
            {inn ? ` по ИНН ${inn}` : ''}
            {` (${cases.length})`}
          </span>
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
        {cases.length === 0 ? (
          <p>Нет данных</p>
        ) : (
          <DataTable
            value={uniqueCases}
            dataKey="case_uuid"      // uuid всегда уникален
            size="small"
            scrollable
            scrollHeight="600px"
            emptyMessage="Нет данных"
            className="p-datatable-sm"
          >
            <Column
              field="case_number"
              header="№ дела"
              style={{ minWidth: '150px', width: '150px' }}
              body={(row: any) => (
                <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {row.case_number || '—'}
                </span>
              )}
            />
            <Column
              field="filing_date"
              header="Дата"
              style={{ minWidth: '95px', width: '95px' }}
              body={(row: any) => (
                <span style={{ whiteSpace: 'nowrap' }}>{row.filing_date || '—'}</span>
              )}
            />
            <Column
              field="case_type"
              header="Тип"
              style={{ minWidth: '90px', width: '90px' }}
              body={(row: any) => row.case_type || '—'}
            />
            <Column
              field="court"
              header="Суд"
              style={{ minWidth: '160px' }}
              body={(row: any) => (
                <span className="text-sm">{row.court || '—'}</span>
              )}
            />
            <Column
              field="judge"
              header="Судья"
              style={{ minWidth: '160px' }}
              body={(row: any) => (
                <span className="text-sm">{row.judge || '—'}</span>
              )}
            />
            <Column
              header="Истцы"
              style={{ minWidth: '220px' }}
              body={(row: any) => partiesCell(row.plaintiffs)}
            />
            <Column
              header="Ответчики"
              style={{ minWidth: '220px' }}
              body={(row: any) => partiesCell(row.respondents)}
            />
            <Column
              header=""
              style={{ width: '150px', textAlign: 'center' }}
              body={(row: any) => (
                <Button
                  label="Карточка"
                  icon="pi pi-external-link"
                  className="osint-soft p-button-sm"
                  disabled={!row.case_uuid}
                  onClick={() => openCard(row.case_uuid)}
                  tooltip={
                    row.case_uuid
                      ? 'Загрузить и сохранить карточку дела'
                      : 'Нет UUID — карточка недоступна'
                  }
                  tooltipOptions={{ position: 'top' }}
                />
              )}
            />
          </DataTable>
        )}
      </Dialog>

      <KadArbitrCardDialog
        visible={cardDialogVisible}
        caseUuid={cardDialogUuid}
        onHide={() => setCardDialogVisible(false)}
      />
    </>
  );
};