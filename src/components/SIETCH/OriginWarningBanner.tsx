// src/components/SIETCH/OriginWarningBanner.tsx

import React from 'react';
import AppIcon from '../COMMON/AppIcon/AppIcon';

export const OriginWarningBanner: React.FC<{ origin?: string | null }> = ({ origin }) => (
  <div
    className="mb-3 p-2 border-round flex align-items-start gap-2"
    style={{
      background: 'rgba(236, 156, 66, 0.08)',
      border: '1px solid rgba(236, 156, 66, 0.4)',
    }}
  >
    <AppIcon name="exclamation-triangle" color="#ec9c42" className="mt-1" />
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