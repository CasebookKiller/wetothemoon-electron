// src/components/SIETCH/CreateDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DetailFields } from '@/components/SIETCH/DetailFields';

export type CreateType = 'entity' | 'relation' | 'observation' | 'source';

export interface CreateDialogProps {
  visible: boolean;
  createType: CreateType;
  onHide: () => void;
  onSuccess?: (type: CreateType, id: number) => void | Promise<void>;
}

interface DropdownOption {
  label: string;
  value: any;
}

const entityTypeOptions: DropdownOption[] = [
  { label: 'Юрлицо', value: 'company' },
  { label: 'ИП', value: 'entrepreneur' },
  { label: 'Физлицо', value: 'person' },
  { label: 'Домен', value: 'domain' },
  { label: 'Email', value: 'email' },
  { label: 'Телефон', value: 'phone' },
  { label: 'IP', value: 'ip' },
  { label: 'Адрес', value: 'address' },
  { label: 'Документ', value: 'document' },
  { label: 'Суд', value: 'court' },
  { label: 'Судебное дело', value: 'court_case' },
  { label: 'Судья', value: 'judge' },
  { label: 'Прочее', value: 'other' },
];

const statusOptions: DropdownOption[] = [
  { label: 'unverified', value: 'unverified' },
  { label: 'hypothesis', value: 'hypothesis' },
  { label: 'confirmed', value: 'confirmed' },
  { label: 'archived', value: 'archived' },
  { label: 'false', value: 'false' },
];

const predicateOptions: DropdownOption[] = [
  { label: 'employee_of', value: 'employee_of' },
  { label: 'director_of', value: 'director_of' },
  { label: 'owner_of', value: 'owner_of' },
  { label: 'founder_of', value: 'founder_of' },
  { label: 'associated_with', value: 'associated_with' },
  { label: 'uses_domain', value: 'uses_domain' },
  { label: 'located_at', value: 'located_at' },
  { label: 'includes', value: 'includes' },
  { label: 'mentions', value: 'mentions' },
  { label: 'resolves_to', value: 'resolves_to' },
  { label: 'individual_entrepreneur_of', value: 'individual_entrepreneur_of' },
  { label: 'plaintiff_in', value: 'plaintiff_in' },
  { label: 'defendant_in', value: 'defendant_in' },
  { label: 'third_party_in', value: 'third_party_in' },
  { label: 'representative_of', value: 'representative_of' },
  { label: 'judge_of', value: 'judge_of' },
  { label: 'heard_by', value: 'heard_by' },
  { label: 'related_to', value: 'related_to' },
];

const sourceTypeOptions: DropdownOption[] = [
  { label: 'website', value: 'website' },
  { label: 'social', value: 'social' },
  { label: 'registry', value: 'registry' },
  { label: 'document', value: 'document' },
  { label: 'cli', value: 'cli' },
  { label: 'search', value: 'search' },
  { label: 'screenshot', value: 'screenshot' },
  { label: 'company_system', value: 'company_system' },
  { label: 'court', value: 'court' },
  { label: 'other', value: 'other' },
];

const sourceKindOptions: DropdownOption[] = [
  { label: 'public_web', value: 'public_web' },
  { label: 'internal_person', value: 'internal_person' },
  { label: 'internal_document', value: 'internal_document' },
  { label: 'official_registry', value: 'official_registry' },
  { label: 'company_system', value: 'company_system' },
  { label: 'cli_tool', value: 'cli_tool' },
  { label: 'personal_observation', value: 'personal_observation' },
];

const collectionMethodOptions: DropdownOption[] = [
  { label: 'browser', value: 'browser' },
  { label: 'api', value: 'api' },
  { label: 'export', value: 'export' },
  { label: 'official_export', value: 'official_export' },
  { label: 'interview', value: 'interview' },
  { label: 'email', value: 'email' },
  { label: 'internal_chat', value: 'internal_chat' },
  { label: 'theharvester', value: 'theharvester' },
  { label: 'whois', value: 'whois' },
  { label: 'dig', value: 'dig' },
  { label: 'manual', value: 'manual' },
];

const accessLevelOptions: DropdownOption[] = [
  { label: 'public', value: 'public' },
  { label: 'internal', value: 'internal' },
  { label: 'confidential', value: 'confidential' },
  { label: 'restricted', value: 'restricted' },
];

function initialForm(type: CreateType): any {
  switch (type) {
    case 'entity':
      return {
        type: 'company',
        value: '',
        label: '',
        confidence: 50,
        status: 'unverified',
        notes: '',
      };
    case 'relation':
      return {
        subject_id: null,
        predicate: 'associated_with',
        object_id: null,
        source_id: null,
        valid_from: '',
        valid_to: '',
        evidence_text: '',
        confidence: 50,
        status: 'unverified',
        notes: '',
      };
    case 'observation':
      return {
        entity_id: null,
        attribute: '',
        value: '',
        source_id: null,
        confidence: 50,
        notes: '',
      };
    case 'source':
      return {
        url: '',
        title: '',
        source_type: 'website',
        source_kind: 'public_web',
        provider: '',
        collection_method: 'manual',
        authority_basis: '',
        reliability: 50,
        access_level: 'public',
        notes: '',
      };
  }
}

export const CreateDialog: React.FC<CreateDialogProps> = ({
  visible,
  createType,
  onHide,
  onSuccess,
}) => {
  const api = (window as any).electronAPI;

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [entityOptions, setEntityOptions] = useState<DropdownOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<DropdownOption[]>([]);

  // Инициализация формы при каждом открытии
  useEffect(() => {
    if (!visible) return;
    setForm(initialForm(createType));
    setMessage('');
    loadDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, createType]);

  const loadDropdowns = async () => {
    try {
      const [entitiesRes, sourcesRes] = await Promise.all([
        api.listEntitiesDropdown(),
        api.getSources(500, 0),
      ]);

      if (entitiesRes?.success) {
        setEntityOptions(
          (entitiesRes.items || []).map((e: any) => ({
            label: `[${e.id}] ${e.label} (${e.type})`,
            value: e.id,
          }))
        );
      }

      if (Array.isArray(sourcesRes)) {
        setSourceOptions([
          { label: '— Не указан —', value: null },
          ...sourcesRes.map((s: any) => ({
            label: `[${s.id}] ${s.title || s.url}`,
            value: s.id,
          })),
        ]);
      }
    } catch (e) {
      console.error('Не удалось загрузить опции для dropdown:', e);
    }
  };

  const onEditChange = (key: string, value: any) =>
    setForm((prev: any) => ({ ...(prev || {}), [key]: value }));

  const submit = async () => {
    if (!form) return;

    // Простая валидация
    if (createType === 'entity' && !form.value?.trim()) {
      setMessage('Поле «Значение» обязательно');
      return;
    }
    if (createType === 'relation') {
      if (!form.subject_id || !form.object_id) {
        setMessage('Выберите исходную и целевую сущности');
        return;
      }
      if (!form.predicate?.trim()) {
        setMessage('Укажите тип связи');
        return;
      }
    }
    if (createType === 'observation') {
      if (!form.entity_id) { setMessage('Выберите сущность'); return; }
      if (!form.attribute?.trim()) { setMessage('Укажите атрибут'); return; }
      if (!form.value?.trim()) { setMessage('Укажите значение'); return; }
    }
    if (createType === 'source' && !form.url?.trim()) {
      setMessage('Укажите URL или локальный путь');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      let res: any;
      if (createType === 'entity') res = await api.createEntity(form);
      else if (createType === 'relation') res = await api.createRelation(form);
      else if (createType === 'observation') res = await api.createObservation(form);
      else if (createType === 'source') res = await api.createSource(form);

      if (res?.success) {
        setMessage('Создано');
        if (onSuccess && res.id) await onSuccess(createType, res.id);
        setTimeout(onHide, 400);
      } else {
        setMessage(`Ошибка: ${res?.error || 'неизвестная'}`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = (() => {
    switch (createType) {
      case 'entity': return 'Создать сущность';
      case 'relation': return 'Создать связь';
      case 'observation': return 'Создать наблюдение';
      case 'source': return 'Создать источник';
    }
  })();

  return (
    <Dialog
      visible={visible}
      style={{ width: '800px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={<span className="p-panel-title">{headerTitle}</span>}
      footer={
        <div className="p-panel-footer flex justify-content-end gap-2">
          <Button
            label="Отмена"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
            disabled={saving}
          />
          <Button
            label={saving ? 'Создание...' : 'Создать'}
            icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="osint"
            onClick={submit}
            disabled={saving}
          />
        </div>
      }
    >
      {form && createType === 'entity' && (
        <DetailFields
          editing={true}
          editForm={form}
          onEditChange={onEditChange}
          fields={[
            {
              label: 'Тип *',
              value: form.type,
              editable: true,
              editKey: 'type',
              editType: 'dropdown',
              editOptions: entityTypeOptions,
            },
            {
              label: 'Статус',
              value: form.status,
              editable: true,
              editKey: 'status',
              editType: 'dropdown',
              editOptions: statusOptions,
            },
            {
              label: 'Значение *',
              span: 2,
              value: form.value,
              editable: true,
              editKey: 'value',
              editType: 'text',
            },
            {
              label: 'Название (label)',
              span: 2,
              value: form.label,
              editable: true,
              editKey: 'label',
              editType: 'text',
            },
            {
              label: 'Уверенность',
              value: form.confidence,
              editable: true,
              editKey: 'confidence',
              editType: 'number',
            },
            {
              label: 'Заметки',
              span: 2,
              value: form.notes,
              editable: true,
              editKey: 'notes',
              editType: 'textarea',
            },
          ]}
        />
      )}

      {form && createType === 'relation' && (
        <DetailFields
          editing={true}
          editForm={form}
          onEditChange={onEditChange}
          fields={[
            {
              label: 'Исходная сущность *',
              span: 2,
              value: form.subject_id,
              editable: true,
              editKey: 'subject_id',
              editType: 'autocomplete',
              editOptions: entityOptions,
              editPlaceholder: 'Начните печатать ФИО, название или ИНН',
            },
            {
              label: 'Тип связи (predicate) *',
              span: 2,
              value: form.predicate,
              editable: true,
              editKey: 'predicate',
              editType: 'dropdown',
              editOptions: predicateOptions,
            },
            {
              label: 'Целевая сущность *',
              span: 2,
              value: form.object_id,
              editable: true,
              editKey: 'object_id',
              editType: 'autocomplete',
              editOptions: entityOptions,
              editPlaceholder: 'Начните печатать ФИО, название или ИНН',
            },
            {
              label: 'Уверенность',
              value: form.confidence,
              editable: true,
              editKey: 'confidence',
              editType: 'number',
            },
            {
              label: 'Статус',
              value: form.status,
              editable: true,
              editKey: 'status',
              editType: 'dropdown',
              editOptions: statusOptions,
            },
            {
              label: 'Источник',
              value: form.source_id,
              editable: true,
              editKey: 'source_id',
              editType: 'dropdown',
              editOptions: sourceOptions,
            },
            {
              label: 'Действует с',
              value: form.valid_from,
              editable: true,
              editKey: 'valid_from',
              editType: 'text',
            },
            {
              label: 'Действует до',
              value: form.valid_to,
              editable: true,
              editKey: 'valid_to',
              editType: 'text',
            },
            {
              label: 'Подтверждение (evidence)',
              span: 2,
              value: form.evidence_text,
              editable: true,
              editKey: 'evidence_text',
              editType: 'textarea',
            },
            {
              label: 'Заметки',
              span: 2,
              value: form.notes,
              editable: true,
              editKey: 'notes',
              editType: 'textarea',
            },
          ]}
        />
      )}

      {form && createType === 'observation' && (
        <DetailFields
          editing={true}
          editForm={form}
          onEditChange={onEditChange}
          fields={[
            {
              label: 'Сущность *',
              span: 2,
              value: form.entity_id,
              editable: true,
              editKey: 'entity_id',
              editType: 'autocomplete',
              editOptions: entityOptions,
              editPlaceholder: 'Начните печатать ФИО, название или ИНН',
            },
            {
              label: 'Атрибут *',
              span: 2,
              value: form.attribute,
              editable: true,
              editKey: 'attribute',
              editType: 'text',
            },
            {
              label: 'Значение *',
              span: 2,
              value: form.value,
              editable: true,
              editKey: 'value',
              editType: 'textarea',
            },
            {
              label: 'Уверенность',
              value: form.confidence,
              editable: true,
              editKey: 'confidence',
              editType: 'number',
            },
            {
              label: 'Источник',
              value: form.source_id,
              editable: true,
              editKey: 'source_id',
              editType: 'dropdown',
              editOptions: sourceOptions,
            },
            {
              label: 'Заметки',
              span: 2,
              value: form.notes,
              editable: true,
              editKey: 'notes',
              editType: 'textarea',
            },
          ]}
        />
      )}

      {form && createType === 'source' && (
        <DetailFields
          editing={true}
          editForm={form}
          onEditChange={onEditChange}
          fields={[
            {
              label: 'URL или локальный путь *',
              span: 2,
              value: form.url,
              editable: true,
              editKey: 'url',
              editType: 'text',
            },
            {
              label: 'Название',
              span: 2,
              value: form.title,
              editable: true,
              editKey: 'title',
              editType: 'text',
            },
            {
              label: 'Тип источника',
              value: form.source_type,
              editable: true,
              editKey: 'source_type',
              editType: 'dropdown',
              editOptions: sourceTypeOptions,
            },
            {
              label: 'Происхождение',
              value: form.source_kind,
              editable: true,
              editKey: 'source_kind',
              editType: 'dropdown',
              editOptions: sourceKindOptions,
            },
            {
              label: 'Провайдер',
              span: 2,
              value: form.provider,
              editable: true,
              editKey: 'provider',
              editType: 'text',
            },
            {
              label: 'Метод получения',
              value: form.collection_method,
              editable: true,
              editKey: 'collection_method',
              editType: 'dropdown',
              editOptions: collectionMethodOptions,
            },
            {
              label: 'Надёжность',
              value: form.reliability,
              editable: true,
              editKey: 'reliability',
              editType: 'number',
            },
            {
              label: 'Уровень доступа',
              value: form.access_level,
              editable: true,
              editKey: 'access_level',
              editType: 'dropdown',
              editOptions: accessLevelOptions,
            },
            {
              label: 'Основание доступа',
              span: 2,
              value: form.authority_basis,
              editable: true,
              editKey: 'authority_basis',
              editType: 'textarea',
            },
            {
              label: 'Заметки',
              span: 2,
              value: form.notes,
              editable: true,
              editKey: 'notes',
              editType: 'textarea',
            },
          ]}
        />
      )}

      {message && (
        <p className={message.startsWith('Ошибка') ? 'p-error mt-2' : 'p-success mt-2'}>
          {message}
        </p>
      )}
    </Dialog>
  );
};