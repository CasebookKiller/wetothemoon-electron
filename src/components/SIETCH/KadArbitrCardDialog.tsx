// src/components/SIETCH/KadArbitrCardDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

export interface KadArbitrCardDialogProps {
  visible: boolean;
  caseUuid: string;
  onHide: () => void;
}

interface ProgressInfo {
  stage: 'session' | 'fetch' | 'persist';
  message: string;
}

export const KadArbitrCardDialog: React.FC<KadArbitrCardDialogProps> = ({
  visible,
  caseUuid,
  onHide,
}) => {
  const api = (window as any).electronAPI;

  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  useEffect(() => {
    if (!visible) return;
    const onProgress = (info: ProgressInfo) => setProgress(info.message || '');
    api.onKadArbitrCardProgress(onProgress);
    return () => api.removeKadArbitrCardProgressListener();
  }, [visible]);

  useEffect(() => {
    if (!visible || !caseUuid) return;
    setLoading(true);
    setError('');
    setCard(null);
    setStats(null);
    setProgress('');

    api
      .fetchKadArbitrCard(caseUuid)
      .then((res: any) => {
        if (res.success) {
          setCard(res.card);
          setStats(res.stats);
        } else {
          setError(res.error || 'Неизвестная ошибка');
        }
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [visible, caseUuid]);

  return (
    <Dialog
      visible={visible}
      style={{ width: '900px', maxWidth: '95vw' }}
      modal
      onHide={() => { if (!loading) onHide(); }}
      header={
        <span className="p-panel-title">
          {card ? `Карточка ${card.case_number}` : `Карточка ${caseUuid}`}
        </span>
      }
      footer={
        <div className="p-panel-footer flex justify-content-end gap-2">
          <Button
            label="Закрыть"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
            disabled={loading}
          />
        </div>
      }
    >
      {loading && <p>{progress || 'Загрузка карточки...'}</p>}
      {error && <p className="p-error">Ошибка: {error}</p>}

      {card && (
        <div className="flex flex-column gap-3">
          <div className="flex flex-wrap gap-3">
            <div><b>Тип:</b> {card.case_type}</div>
            <div><b>Статус:</b> {card.status || '—'}</div>
            <div><b>Дата подачи:</b> {card.filing_date || '—'}</div>
            <div><b>Длительность:</b> {card.duration_days ? `${card.duration_days} дн.` : '—'}</div>
          </div>
          {card.category && (
            <div><b>Категория:</b> {card.category}</div>
          )}

          <div>
            <b>Истцы:</b>{' '}
            {card.sides.plaintiffs.map((s: any) => s.name).join(', ') || '—'}
          </div>
          <div>
            <b>Ответчики:</b>{' '}
            {card.sides.respondents.map((s: any) => s.name).join(', ') || '—'}
          </div>
          {card.sides.third_parties.length > 0 && (
            <div>
              <b>Третьи лица:</b> {card.sides.third_parties.map((s: any) => s.name).join(', ')}
            </div>
          )}
          {card.sides.others.length > 0 && (
            <div>
              <b>Иные лица:</b> {card.sides.others.map((s: any) => s.name).join(', ')}
            </div>
          )}

                    {card.instances.map((inst: any) => {
            const eventsSorted = [...(inst.events || [])].sort((a: any, b: any) =>
              (b.event_date || '').localeCompare(a.event_date || '')
            );
            return (
              <div
                key={inst.instance_uuid}
                style={{
                  borderTop: '1px solid var(--tg-theme-hint-color)',
                  paddingTop: '0.75rem',
                }}
              >
                <div>
                  <b>{inst.level}</b> · {inst.court_name}
                  {inst.court_tag ? ` (${inst.court_tag})` : ''}
                </div>
                {inst.judges && inst.judges.length > 0 && (
                  <div className="text-sm">
                    Судья: {inst.judges.join(', ')}
                  </div>
                )}

                <div className="mt-2">
                  <b>События ({eventsSorted.length}):</b>
                  {eventsSorted.length === 0 ? (
                    <div className="text-sm" style={{ opacity: 0.7, marginTop: '0.25rem' }}>
                      нет
                    </div>
                  ) : (
                    <DataTable
                      value={eventsSorted}
                      size="small"
                      scrollable
                      scrollHeight="280px"
                      className="p-datatable-sm mt-2"
                      emptyMessage="Нет событий"
                    >
                      <Column
                        field="event_date"
                        header="Дата"
                        style={{ minWidth: '95px', width: '95px' }}
                        body={(ev: any) => (
                          <span style={{ whiteSpace: 'nowrap' }}>{ev.event_date || '—'}</span>
                        )}
                      />
                      <Column
                        field="event_type_raw"
                        header="Тип"
                        style={{ minWidth: '120px', width: '120px' }}
                        body={(ev: any) => (
                          <span style={{ whiteSpace: 'nowrap' }}>{ev.event_type_raw || '—'}</span>
                        )}
                      />
                      <Column
                        header="Содержание"
                        style={{ minWidth: '320px' }}
                        body={(ev: any) => (
                          <div className="text-sm">
                            {ev.content || <span style={{ opacity: 0.5 }}>—</span>}
                            {ev.additional_info && (
                              <div style={{ opacity: 0.65, fontSize: '0.85em', marginTop: '0.15rem' }}>
                                {ev.additional_info}
                              </div>
                            )}
                          </div>
                        )}
                      />
                      <Column
                        header="Судья / заявитель"
                        style={{ minWidth: '160px' }}
                        body={(ev: any) => {
                          const who = ev.judge || ev.declarer;
                          return who ? (
                            <span className="text-sm" title={ev.judge_role || ''}>
                              {who}
                            </span>
                          ) : (
                            <span style={{ opacity: 0.5 }}>—</span>
                          );
                        }}
                      />
                      <Column
                        field="amount"
                        header="Сумма"
                        style={{ minWidth: '110px', width: '110px', textAlign: 'right' }}
                        body={(ev: any) =>
                          ev.amount ? (
                            <span style={{ whiteSpace: 'nowrap' }}>{ev.amount}</span>
                          ) : (
                            <span style={{ opacity: 0.5 }}>—</span>
                          )
                        }
                      />
                      <Column
                        header=""
                        style={{ minWidth: '80px', width: '80px', textAlign: 'center' }}
                        body={(ev: any) =>
                          ev.document_url ? (
                            <a
                              href={ev.document_url}
                              target="_blank"
                              rel="noreferrer"
                              className="pi pi-file-pdf"
                              style={{ fontSize: '1.1rem' }}
                              title="Открыть PDF"
                            />
                          ) : (
                            <span style={{ opacity: 0.3 }}>—</span>
                          )
                        }
                      />
                    </DataTable>
                  )}
                </div>
              </div>
            );
          })}

          {stats && (
            <div
              className="text-sm"
              style={{ color: 'var(--tg-theme-hint-color)', marginTop: '0.5rem' }}
            >
              Сохранено: сущностей {stats.savedEntities} · связей {stats.savedRelations} ·
              наблюдений {stats.savedObservations} · событий +{stats.eventsInserted}/~{stats.eventsUpdated}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};