// src/components/PRANA_BINDU/ExerciseGraph/ExerciseGraphDialog.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ExerciseGraphView } from './ExerciseGraphView';
import type { ExerciseGraph } from '@/main/services/pranaBindu/mentat/graph/ontology';
import './ExerciseGraph.css';

interface Props {
  visible: boolean;
  onHide: () => void;
}

export const ExerciseGraphDialog: React.FC<Props> = ({ visible, onHide }) => {
  const api = (window as any).electronAPI;
  const [graph, setGraph] = useState<ExerciseGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await api.pb.getExerciseGraph();
      if (res?.ok) {
        setGraph(res.graph);
        setError(null);
      } else {
        setError(res?.error ?? 'Не удалось загрузить граф');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    if (!visible) return;
    if (!graph) {
      void reload();
    }
  }, [visible, graph, reload]);

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <span className="p-dialog-title pb-templates__title">
          <i className="pi pi-share-alt" /> Exercise Graph
        </span>
      }
      maximizable
      dismissableMask
      closeOnEscape
      className="pb-templates-dialog pb-graph-dialog"
      style={{ width: '95vw', height: '95vh' }}
    >
      {!graph && !error && (
        <div className="pb-graph-view__center">
          <ProgressSpinner style={{ width: 40, height: 40 }} />
        </div>
      )}
      {error && (
        <div className="pb-graph-view__center pb-graph-view__error">{error}</div>
      )}
      {graph && (
        <ExerciseGraphView
          graph={graph}
          onGraphChanged={reload}
        />
      )}
    </Dialog>
  );
};