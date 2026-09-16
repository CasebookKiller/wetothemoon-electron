// src/components/SIETCH/Breadcrumb.tsx

import React from 'react';

export type DialogType = 'entity' | 'relation' | 'observation' | 'source';

export interface DialogStackItem {
  type: DialogType;
  id: number;
}

export interface BreadcrumbProps {
  stack: DialogStackItem[];
  cacheKey: (type: DialogType, id: number) => string;
  cache: Record<string, any>;
  onNavigate: (index: number) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  stack,
  cacheKey,
  cache,
  onNavigate,
}) => {
  const getLabel = (item: DialogStackItem): string => {
    const data = cache[cacheKey(item.type, item.id)];
    switch (item.type) {
      case 'entity':
        return data?.entity?.label || data?.entity?.value || `Сущность #${item.id}`;
      case 'relation':
        return `Связь #${item.id}`;
      case 'observation':
        return `Наблюдение #${item.id}`;
      case 'source':
        return data?.source?.title || `Источник #${item.id}`;
    }
  };

  return (
    <div className="flex align-items-center gap-1 flex-wrap">
      {stack.map((item, index) => {
        const isLast = index === stack.length - 1;
        const label = getLabel(item);
        return (
          <React.Fragment key={cacheKey(item.type, item.id)}>
            {isLast ? (
              <span className="p-panel-title">{label}</span>
            ) : (
              <>
                <a
                  href="#"
                  className="text-primary"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(index);
                  }}
                >
                  {label}
                </a>
                <i className="pi pi-angle-right text-500" />
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};