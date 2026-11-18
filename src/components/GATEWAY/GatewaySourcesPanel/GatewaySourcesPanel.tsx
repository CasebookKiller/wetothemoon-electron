// src/components/GATEWAY/GatewaySourcesPanel/GatewaySourcesPanel.tsx
import React from 'react';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';

export interface WebSource {
  url: string;
  title: string;
  snippet?: string;
  siteIcon?: string;
  siteName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sources: WebSource[];
}

export const GatewaySourcesPanel: React.FC<Props> = ({ isOpen, onClose, sources }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 480,
        background: '#1a1a1a',
        borderLeft: '1px solid #333',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
        color: '#e0e0e0',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>
          Изученные источники ({sources.length})
        </h3>
        <div
          role="button"
          tabIndex={0}
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 6,
            color: '#888',
          }}
          title="Закрыть"
        >
          <AppIcon name="close" set="material" size="lg" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {sources.map((src, i) => {
          let hostname = '';
          try { hostname = new URL(src.url).hostname; } catch { /* ignore */ }
          return (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: 12,
                marginBottom: 10,
                background: '#252525',
                borderRadius: 8,
                textDecoration: 'none',
                border: '1px solid #333',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                {src.siteIcon ? (
                  <img
                    src={src.siteIcon}
                    alt=""
                    style={{ width: 16, height: 16, borderRadius: 2 }}
                  />
                ) : (
                  <AppIcon name="language" set="material" size="sm" color="muted" />
                )}
                <span style={{ fontSize: 12, color: '#888' }}>
                  {src.siteName || hostname}
                </span>
              </div>
              <div style={{ fontWeight: 500, color: '#a5b4fc', fontSize: 14, marginBottom: 4 }}>
                {src.title || src.url}
              </div>
              {src.snippet && (
                <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.4 }}>
                  {src.snippet}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
};