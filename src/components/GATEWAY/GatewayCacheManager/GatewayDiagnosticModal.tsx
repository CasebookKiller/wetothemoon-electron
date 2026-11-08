import React, { useState } from 'react';
import { classNames } from '@/css/classnames';

export interface DiagnosticReportModalProps {
  visible: boolean;
  loading: boolean;
  report: any | null;
  error: string | null;
  onClose: () => void;
}

export const GatewayDiagnosticModal: React.FC<DiagnosticReportModalProps> = ({
  visible, loading, report, error, onClose,
}) => {
  const [copied, setCopied] = useState(false);
  if (!visible) return null;

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn('clipboard failed:', e);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gateway-diagnostic-${report.convId.slice(0,8)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90vw', maxWidth: 900, maxHeight: '85vh',
          background: 'var(--dsw-alias-bg-base, #1a1a1a)',
          color: 'var(--dsw-alias-label-primary, #eee)',
          borderRadius: 12, padding: 20, overflow: 'auto',
          fontFamily: 'monospace', fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>🔍 Диагностика веток</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #555', color: '#eee', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
        </div>

        {loading && <div style={{ color: '#4d6bfe' }}>⏳ Собираю отчёт (PW-скролл может занять 30-90 сек)…</div>}
        {error && <div style={{ color: '#ff6b6b' }}>❌ {error}</div>}

        {report && !loading && (
          <>
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 6,
              background: report.verdict.ok ? 'rgba(76,175,80,0.15)' : 'rgba(255,82,82,0.15)',
              border: `1px solid ${report.verdict.ok ? '#4caf50' : '#ff5252'}`,
            }}>
              <strong>{report.verdict.ok ? '✅ OK' : '❌ ПРОБЛЕМЫ'}</strong>
              {!report.verdict.ok && (
                <ul style={{ margin: '8px 0 0 20px' }}>
                  {report.verdict.problems.map((p: string, i: number) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <strong>PW</strong>: {report.pw.ok ? `${report.pw.totalCount} msgs (${report.pw.durationMs}ms)` : report.pw.error}
              </div>
              <div>
                <strong>DB</strong>: {report.db.ok ? `${report.db.activeCount} active / ${report.db.inactiveCount} inactive / ${report.db.totalRows} total` : report.db.error}
              </div>
            </div>

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Comparison</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 6 }}>
                {JSON.stringify(report.comparison, null, 2)}
              </pre>
            </details>

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>DB by pwKey ({report.db.rows.length} rows)</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 6, maxHeight: 300, overflow: 'auto' }}>
                {JSON.stringify(report.db.rows, null, 2)}
              </pre>
            </details>

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>PW items ({report.pw.items.length})</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 6, maxHeight: 300, overflow: 'auto' }}>
                {JSON.stringify(report.pw.items, null, 2)}
              </pre>
            </details>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleCopy} style={{ padding: '6px 12px', borderRadius: 6, cursor: 'pointer', background: '#4d6bfe', color: 'white', border: 'none' }}>
                {copied ? '✅ Скопировано' : '📋 Скопировать JSON'}
              </button>
              <button onClick={handleDownload} style={{ padding: '6px 12px', borderRadius: 6, cursor: 'pointer', background: '#444', color: 'white', border: 'none' }}>
                💾 Скачать JSON
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};