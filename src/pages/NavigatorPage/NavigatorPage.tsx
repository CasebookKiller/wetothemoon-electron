import React from 'react';
import './NavigatorPage.css';

export const NavigatorPage: React.FC = () => {
  return (
    <div
      data-module="navigator"
      className="navigator-page-root"
      style={{
        padding: 32,
        color: 'var(--tg-theme-text-color, #f5f5f5)',
        background: 'var(--tg-theme-bg-color, #0f1419)',
        minHeight: '100vh',
      }}
    >
      <h1
        style={{
          fontSize: 24,
          marginBottom: 12,
          color: 'var(--module-accent)',
        }}
      >
        Navigator
      </h1>
      <p style={{ color: 'var(--tg-theme-hint-color, #6b7a85)', fontSize: 14 }}>
        Универсальный Browser Hub. В разработке — Этап 1 (MVP: GigaChat-чат).
      </p>
    </div>
  );
};