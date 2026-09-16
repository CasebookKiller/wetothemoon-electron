// src/components/SIETCH/useSensitiveState.ts

import { useCallback, useState } from 'react';

export function useSensitiveState() {
  const [visible, setVisible] = useState(false);
  const [entityId, setEntityId] = useState<number | null>(null);
  const [entityLabel, setEntityLabel] = useState('');

  const open = useCallback((id: number, label: string) => {
    setEntityId(id);
    setEntityLabel(label);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  return {
    visible,
    entityId,
    entityLabel,
    open,
    close,
  };
}