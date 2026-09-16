// src/components/SIETCH/OriginWarningBanner.tsx

import React from 'react';

export const OriginWarningBanner: React.FC<{ origin?: string | null }> = ({ origin }) => (
  <div
    className="mb-3 p-2 border-round flex align-items-start gap-2"
    style={{
      background: 'rgba(236, 156, 66, 0.08)',
      border: '1px solid rgba(236, 156, 66, 0.4)',
    }}
  >
    <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec9c42' }} />
    <div className="text-sm">
      {origin === 'manual' ? (
        <><b>Ручная запись.</b> Изменения сохраняются, скрапер её не перезапишет.</>
      ) : (
        <>
          <b>Запись собрана автоматически.</b> После сохранения она станет{' '}
          <code>manual</code> и скрапер её не тронет.
        </>
      )}
    </div>
  </div>
);