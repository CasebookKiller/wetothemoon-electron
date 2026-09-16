// src/components/SIETCH/useEditingState.ts

import { useCallback, useState } from 'react';
import type { DialogType } from './Breadcrumb';

function initialForm(type: DialogType, data: any): any {
  switch (type) {
    case 'entity':
      return {
        type: data.entity.type,
        value: data.entity.value,
        label: data.entity.label || '',
        confidence: data.entity.confidence ?? 50,
        status: data.entity.status,
        notes: data.entity.notes || '',
      };
    case 'relation':
      return {
        predicate: data.predicate,
        confidence: data.confidence ?? 50,
        status: data.status,
        valid_from: data.valid_from || '',
        valid_to: data.valid_to || '',
        evidence_text: data.evidence_text || '',
        notes: data.notes || '',
      };
    case 'observation':
      return {
        attribute: data.attribute,
        value: data.value,
        confidence: data.confidence ?? 50,
        notes: data.notes || '',
      };
    case 'source':
      return {
        url: data.source.url,
        title: data.source.title || '',
        source_type: data.source.source_type || '',
        source_kind: data.source.source_kind || '',
        provider: data.source.provider || '',
        collection_method: data.source.collection_method || '',
        authority_basis: data.source.authority_basis || '',
        reliability: data.source.reliability ?? 50,
        access_level: data.source.access_level || 'public',
        notes: data.source.notes || '',
      };
  }
}

export interface UseEditingStateOptions {
  /** Вызывается после успешного сохранения. */
  onAfterSave?: () => void | Promise<void>;
}

export function useEditingState(options: UseEditingStateOptions = {}) {
  const api = (window as any).electronAPI;

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  const startEditing = useCallback((type: DialogType, data: any) => {
    setEditForm(initialForm(type, data));
    setEditMessage('');
    setEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditForm(null);
    setEditMessage('');
  }, []);

  const updateField = useCallback((key: string, value: any) => {
    setEditForm((prev: any) => ({ ...(prev || {}), [key]: value }));
  }, []);

  const saveEditing = useCallback(
    async (type: DialogType, id: number): Promise<boolean> => {
      if (!editForm) return false;
      setEditSaving(true);
      setEditMessage('');
      try {
        let res: any;
        if (type === 'entity') res = await api.updateEntity(id, editForm);
        else if (type === 'relation') res = await api.updateRelation(id, editForm);
        else if (type === 'observation') res = await api.updateObservation(id, editForm);
        else if (type === 'source') res = await api.updateSource(id, editForm);

        if (res?.success) {
          setEditMessage('Сохранено');
          if (options.onAfterSave) await options.onAfterSave();
          setTimeout(() => {
            setEditing(false);
            setEditForm(null);
            setEditMessage('');
          }, 600);
          return true;
        } else {
          setEditMessage(`Ошибка: ${res?.error || 'неизвестная'}`);
          return false;
        }
      } catch (e) {
        setEditMessage((e as Error).message);
        return false;
      } finally {
        setEditSaving(false);
      }
    },
    [api, editForm, options]
  );

  const resetEditing = useCallback(() => {
    setEditing(false);
    setEditForm(null);
    setEditMessage('');
  }, []);

  return {
    editing,
    editForm,
    editSaving,
    editMessage,
    startEditing,
    cancelEditing,
    updateField,
    saveEditing,
    resetEditing,
  };
}