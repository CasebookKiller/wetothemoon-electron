// src/components/SIETCH/useDialogStack.ts

import { useCallback, useState } from 'react';
import type { DialogStackItem, DialogType } from './Breadcrumb';

export function useDialogStack() {
  const api = (window as any).electronAPI;

  const [dialogStack, setDialogStack] = useState<DialogStackItem[]>([]);
  const [dialogCache, setDialogCache] = useState<Record<string, any>>({});
  const [dialogLoading, setDialogLoading] = useState(false);
  const [error, setError] = useState('');

  const cacheKey = useCallback(
    (type: DialogType, id: number) => `${type}:${id}`,
    []
  );

  const current = dialogStack.length > 0 ? dialogStack[dialogStack.length - 1] : null;
  const currentData = current ? dialogCache[cacheKey(current.type, current.id)] : null;

  const loadDetails = async (type: DialogType, id: number): Promise<any> => {
    switch (type) {
      case 'entity':      return api.getEntityDetails(id);
      case 'relation':    return api.getRelationDetails(id);
      case 'observation': return api.getObservationDetails(id);
      case 'source':      return api.getSourceDetails(id);
    }
  };

  const openDialog = useCallback(async (type: DialogType, id: number) => {
    // Если диалог уже в стеке — обрезаем стек до него
    const existingIdx = dialogStack.findIndex((it) => it.type === type && it.id === id);
    if (existingIdx >= 0) {
      setDialogStack((prev) => prev.slice(0, existingIdx + 1));
      return;
    }

    const key = cacheKey(type, id);
    if (dialogCache[key]) {
      setDialogStack((prev) => [...prev, { type, id }]);
      return;
    }

    setDialogLoading(true);
    try {
      const res = await loadDetails(type, id);
      if (res.success) {
        setDialogCache((prev) => ({ ...prev, [key]: res.data }));
        setDialogStack((prev) => [...prev, { type, id }]);
      } else {
        setError(res.error || 'Ошибка загрузки деталей');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDialogLoading(false);
    }
  }, [api, dialogStack, dialogCache, cacheKey]);

  const popDialog = useCallback(() => {
    setDialogStack((prev) => prev.slice(0, -1));
  }, []);

  const popToIndex = useCallback((index: number) => {
    setDialogStack((prev) => prev.slice(0, index + 1));
  }, []);

  const closeAllDialogs = useCallback(() => {
    setDialogStack([]);
    setDialogCache({});
  }, []);

  const refreshTopDialog = useCallback(async () => {
    if (dialogStack.length === 0) return;
    const top = dialogStack[dialogStack.length - 1];
    const key = cacheKey(top.type, top.id);
    const res = await loadDetails(top.type, top.id);
    if (res.success) {
      setDialogCache((prev) => ({ ...prev, [key]: res.data }));
    }
  }, [api, dialogStack, cacheKey]);

  /**
   * Инвалидирует весь кэш — полезно после массовых операций (danger zone).
   */
  const resetCache = useCallback(() => {
    setDialogCache({});
  }, []);

  return {
    dialogStack,
    dialogCache,
    dialogLoading,
    error,
    setError,
    current,
    currentData,
    cacheKey,
    openDialog,
    popDialog,
    popToIndex,
    closeAllDialogs,
    refreshTopDialog,
    resetCache,
  };
}