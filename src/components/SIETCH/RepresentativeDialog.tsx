// src/components/SIETCH/RepresentativeDialog.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DetailFields, type DetailField } from '@/components/SIETCH/DetailFields';

export interface RepresentativeDialogProps {
  visible: boolean;
  /** Если открыто из карточки дела — фиксируем дело (поле disabled) */
  fixedCaseId?: number | null;
  /** Если открыто из карточки person — фиксируем представителя */
  fixedRepresentativeId?: number | null;
  onHide: () => void;
  onSuccess?: () => void | Promise<void>;
}

interface EntityOption { id: number; type: string; label: string; }

const ROLE_OPTIONS = [
  { label: 'Адвокат', value: 'адвокат' },
  { label: 'По доверенности', value: 'по доверенности' },
  { label: 'Руководитель', value: 'руководитель' },
  { label: 'Арбитражный управляющий', value: 'арбитражный управляющий' },
];

const PARTY_PREDICATES: Record<string, string> = {
  plaintiff_in: 'истец',
  defendant_in: 'ответчик',
  third_party_in: 'третье лицо',
};

function initialForm(
  fixedCaseId: number | null | undefined,
  fixedRepresentativeId: number | null | undefined
): any {
  return {
    caseId: fixedCaseId ?? null,
    representativeId: fixedRepresentativeId ?? null,
    partyId: null,
    role: 'по доверенности',
    legalBasis: '',
    validFrom: null,
    validTo: null,
    notes: '',
  };
}

function toIso(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

export const RepresentativeDialog: React.FC<RepresentativeDialogProps> = ({
  visible,
  fixedCaseId,
  fixedRepresentativeId,
  onHide,
  onSuccess,
}) => {
  const api = (window as any).electronAPI;

  const [form, setForm] = useState<any>(() =>
    initialForm(fixedCaseId, fixedRepresentativeId)
  );
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [parties, setParties] = useState<Array<{ id: number; label: string; role: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Инициализация / сброс при открытии
  useEffect(() => {
    if (!visible) return;
    setForm(initialForm(fixedCaseId, fixedRepresentativeId));
    setMessage('');
    setEntities([]);
    setParties([]);
    loadEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fixedCaseId, fixedRepresentativeId]);

  // Загружаем стороны, когда известен caseId (и фиксированный, и выбранный)
  const effectiveCaseId = fixedCaseId ?? form?.caseId ?? null;
  useEffect(() => {
    if (!visible || !effectiveCaseId) { setParties([]); return; }
    loadParties(effectiveCaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, effectiveCaseId]);

  const loadEntities = async () => {
    try {
      const res = await api.listEntitiesDropdown();
      if (res?.success) setEntities(res.items || []);
    } catch (e) {
      console.error('Не удалось загрузить сущности:', e);
    }
  };

  const loadParties = async (cid: number) => {
    try {
      const res = await api.getEntityDetails(cid);
      if (!res?.success || !res.data) { setParties([]); return; }
      const rels = (res.data.relations_in || []) as any[];
      const ps = rels
        .filter((r) => PARTY_PREDICATES[r.predicate])
        .map((r) => ({
          id: r.subject_id as number,
          label: r.subject_label || `#${r.subject_id}`,
          role: PARTY_PREDICATES[r.predicate],
        }));
      setParties(ps);
    } catch (e) {
      console.error('Не удалось загрузить стороны дела:', e);
    }
  };

  // ===== Опции для полей =====

  const caseOptions = useMemo(
    () => entities
      .filter((e) => e.type === 'court_case')
      .map((e) => ({ label: `[${e.id}] ${e.label}`, value: e.id })),
    [entities]
  );

  const personOptions = useMemo(
    () => entities
      .filter((e) => e.type === 'person')
      .map((e) => ({ label: `[${e.id}] ${e.label}`, value: e.id })),
    [entities]
  );

  const partyOptions = useMemo(
    () => parties.map((p) => ({ label: `${p.label} (${p.role})`, value: p.id })),
    [parties]
  );

  // Для фиксированных полей — показываем читаемую метку вместо ID
  const findEntityLabel = (id: number | null | undefined): React.ReactNode => {
    if (!id) return null;
    const e = entities.find((x) => x.id === id);
    return e ? `[${e.id}] ${e.label} (${e.type})` : `#${id}`;
  };

  const findPartyLabel = (id: number | null | undefined): React.ReactNode => {
    if (!id) return null;
    const p = parties.find((x) => x.id === id);
    return p ? `${p.label} (${p.role})` : `#${id}`;
  };

  const onEditChange = (key: string, value: any) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));

  // ===== Submit =====

  const submit = async () => {
    const finalCaseId = fixedCaseId ?? form?.caseId;
    const finalRepId = fixedRepresentativeId ?? form?.representativeId;

    if (!finalCaseId) { setMessage('Выберите дело'); return; }
    if (!finalRepId) { setMessage('Выберите представителя'); return; }
    if (!form?.partyId) { setMessage('Укажите, кого представляет'); return; }

    setLoading(true);
    setMessage('');
    try {
      const evidenceParts: string[] = [];
      if (form.role) evidenceParts.push(form.role);
      if (form.legalBasis?.trim()) evidenceParts.push(form.legalBasis.trim());

      const res = await api.createRelation({
        subject_id: finalRepId,
        predicate: 'represents',
        object_id: form.partyId,
        via_entity_id: finalCaseId,
        evidence_text: evidenceParts.join(' · ') || null,
        valid_from: toIso(form.validFrom),
        valid_to: toIso(form.validTo),
        confidence: 80,
        status: 'unverified',
        notes: form.notes || null,
      });

      if (res?.success) {
        setMessage('Сохранено');
        if (onSuccess) await onSuccess();
        setTimeout(onHide, 700);
      } else {
        setMessage(`Ошибка: ${res?.error || 'неизвестная'}`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ===== Поля формы =====

  const fields: DetailField[] = [
    {
      label: 'Дело *',
      span: 2,
      value: fixedCaseId ? findEntityLabel(fixedCaseId) : null,
      editable: !fixedCaseId,
      editKey: 'caseId',
      editType: 'autocomplete',
      editOptions: caseOptions,
      editPlaceholder: 'Начните вводить номер дела',
      editMaxSuggestions: 30,
    },
    {
      label: 'Представитель *',
      span: 2,
      value: fixedRepresentativeId ? findEntityLabel(fixedRepresentativeId) : null,
      editable: !fixedRepresentativeId,
      editKey: 'representativeId',
      editType: 'autocomplete',
      editOptions: personOptions,
      editPlaceholder: 'Начните вводить ФИО',
      editMaxSuggestions: 30,
    },
    {
      label: 'Кого представляет *',
      span: 2,
      value: form?.partyId ? findPartyLabel(form.partyId) : null,
      editable: true,
      editKey: 'partyId',
      editType: 'dropdown',
      editOptions: partyOptions,
    },
    {
      label: 'Роль',
      value: form?.role,
      editable: true,
      editKey: 'role',
      editType: 'dropdown',
      editOptions: ROLE_OPTIONS,
    },
    {
      label: 'Основание',
      span: 2,
      value: form?.legalBasis,
      editable: true,
      editKey: 'legalBasis',
      editType: 'text',
      editPlaceholder: 'Например: доверенность №123 от 01.02.2026',
    },
    {
      label: 'Действует с',
      value: form?.validFrom,
      editable: true,
      editKey: 'validFrom',
      editType: 'date',
    },
    {
      label: 'Действует до',
      value: form?.validTo,
      editable: true,
      editKey: 'validTo',
      editType: 'date',
    },
    {
      label: 'Заметки',
      span: 2,
      value: form?.notes,
      editable: true,
      editKey: 'notes',
      editType: 'textarea',
    },
  ];

  return (
    <Dialog
      visible={visible}
      style={{ width: '720px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={
        <span className="p-panel-title">
          <i className="pi pi-user-plus mr-2" />
          Добавить представителя
        </span>
      }
      footer={
        <div className="p-panel-footer flex justify-content-end gap-2">
          <Button
            label="Отмена"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
            disabled={loading}
          />
          <Button
            label={loading ? 'Сохранение...' : 'Добавить'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="osint"
            onClick={submit}
            disabled={loading}
          />
        </div>
      }
    >
      {form && (
        <DetailFields
          editing={true}
          editForm={form}
          onEditChange={onEditChange}
          fields={fields}
        />
      )}
      {message && (
        <p className={message.startsWith('Ошибка') ? 'p-error mt-3' : 'p-success mt-3'}>
          {message}
        </p>
      )}
    </Dialog>
  );
};