// src/components/PRANA_BINDU/PANELS/TrainingTabs/TrainingTabs.tsx
//
// Три панели — Календарь / План / Пробежки — в одной Panel с
// mode-switch. Каждая вкладка монтируется лениво (при первом показе),
// после — живёт в DOM и переключается через display: none.
//
// Заголовок Panel — динамический: показывает счётчики активной вкладки.
// Активная вкладка сохраняется в localStorage (pb.trainingTab).

import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';

import './TrainingTabs.css';

const STORAGE_KEY = 'pb.trainingTab';

export interface TrainingTab {
  key: string;
  /** Компактный текст для чипа. */
  label: string;
  /** Расширенный текст для заголовка Panel (со счётчиками). */
  title: string;
  /** Содержимое вкладки. */
  node: React.ReactNode;
}

interface Props {
  tabs: TrainingTab[];
  className?: string;
  embedded?: boolean;
}

function loadActiveKey(fallback: string): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v || fallback;
  } catch {
    return fallback;
  }
}

function saveActiveKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
}

export const TrainingTabs: React.FC<Props> = ({ tabs, className, embedded }) => {
  // По умолчанию — третья вкладка (Пробежки). Если в localStorage
  // что-то сохранено и такой ключ есть — используем его.
  const fallbackKey = tabs[tabs.length - 1]?.key ?? tabs[0]?.key ?? '';
  const [activeKey, setActiveKey] = useState<string>(() => {
    const stored = loadActiveKey(fallbackKey);
    return tabs.some((t) => t.key === stored) ? stored : fallbackKey;
  });

  // Какие вкладки уже были открыты — те монтируем и держим в DOM.
  const [mounted, setMounted] = useState<Set<string>>(
    () => new Set([activeKey])
  );

  useEffect(() => {
    if (!mounted.has(activeKey)) {
      setMounted((prev) => {
        const next = new Set(prev);
        next.add(activeKey);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const changeTab = (key: string) => {
    setActiveKey(key);
    saveActiveKey(key);
  };

  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  const headerNode = (
    <div className="pb-training-tabs__header">
      <div className="pb-templates__mode-switch">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={activeKey === t.key ? 'is-active' : ''}
            onClick={() => changeTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <span className="pb-training-tabs__title">{activeTab?.title}</span>
    </div>
  );

  const bodyNode = (
    <div className="pb-training-tabs__body" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {tabs.map((t) =>
        mounted.has(t.key) ? (
          <div
            key={t.key}
            className="pb-training-tabs__tab-content"
            style={{ 
              display: activeKey === t.key ? 'flex' : 'none', 
              flexDirection: 'column', 
              flex: 1, 
              minHeight: 0 
            }}
          >
            {t.node}
          </div>
        ) : null
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className={className ?? ''} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ paddingBottom: '0.5rem', flexShrink: 0 }}>{headerNode}</div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          {bodyNode}
        </div>
      </div>
    );
  }

  return (
    <Panel
      header={headerNode}
      className={`shadow-5 mb-3 pb-panel pb-training-tabs-panel ${className ?? ''}`}
    >
      {bodyNode}
    </Panel>
  );
};