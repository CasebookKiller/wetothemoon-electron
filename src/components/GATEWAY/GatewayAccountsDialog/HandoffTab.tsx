// src/components/GATEWAY/GatewayAccountsDialog/HandoffTab.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { AppIcon } from '../../COMMON/AppIcon/AppIcon';

import './HandoffTab.css';

const HANDOFF_MODULES = [
  { label: 'Gateway', value: 'gateway' },
  { label: 'Navigator (Browser Hub)', value: 'navigator' },
  { label: 'Prana-Bindu', value: 'prana-bindu' },
  { label: 'OSINT', value: 'osint' },
  { label: 'Sietch', value: 'sietch' },
];

const getApi = () =>
  (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

type Preset = 'all' | 'topics-only' | 'minimal' | 'custom';

interface FileInfo { name: string; title: string; bytes: number; }

interface Selection {
  preset: Preset;
  selectedTopics: string[];
  selectedFiles: string[];
  includeGit: boolean;
  includePreflight: boolean;
  includeSchema: boolean;
  includeIntent: boolean;
}

export interface HandoffTabProps {
  moduleId: string;
  profileId: string;
}

const C = {
  text: '#f5f5f5',
  dim: '#888',
  border: 'rgba(255,255,255,0.1)',
  borderSoft: 'rgba(255,255,255,0.15)',
  panel: '#1e1e20',
  errBg: 'rgba(220,60,60,0.1)',
  errBorder: 'rgba(220,60,60,0.3)',
  errText: '#ffb0b0',
  okBg: 'rgba(80,200,120,0.1)',
  okBorder: 'rgba(80,200,120,0.3)',
};

const sectionStyle: React.CSSProperties = { marginBottom: 16 };
const labelStyle: React.CSSProperties = { fontSize: 12, color: C.dim, marginBottom: 6, display: 'block' };
const cbRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' };
const listBoxStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 6, padding: 8,
};
const totalStyle: React.CSSProperties = { fontSize: 12, color: C.dim, padding: '4px 0', display: 'flex', justifyContent: 'space-between' };

const PRESETS = [
  { label: 'Всё (topics + intent + git)', value: 'all' },
  { label: 'Только topics', value: 'topics-only' },
  { label: 'Минимум (1 topic + architecture)', value: 'minimal' },
  { label: 'Свой выбор', value: 'custom' },
];

export const HandoffTab: React.FC<HandoffTabProps> = ({ moduleId, profileId }) => {
  const [localModule, setLocalModule] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('handoff-module');
      if (saved) return saved;
    }
    return moduleId || 'gateway';
  });

  const [topics, setTopics] = useState<FileInfo[]>([]);
  const [intentFiles, setIntentFiles] = useState<FileInfo[]>([]);
  const [selection, setSelection] = useState<Selection>({
    preset: 'all', selectedTopics: [], selectedFiles: [],
    includeGit: true, includePreflight: false, includeSchema: false, includeIntent: true,
  });
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ path: string; bytes: number; markdown: string } | null>(null);
  const [error, setError] = useState<string>('');

  const loadedRef = useRef(false);
  const selectionRef = useRef(selection);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  // Mount: list topics + list intent + get prefs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const api = getApi();
      const [topicsRes, intentRes, prefsRes] = await Promise.all([
        api?.gatewayHandoffListTopics?.(localModule),
        api?.gatewayHandoffListIntent?.(localModule),
        api?.gatewayHandoffGetPreferences?.(profileId),
      ]);
      if (cancelled) return;
      let tList: FileInfo[] = [];
      let iList: FileInfo[] = [];
      if (topicsRes?.success) tList = topicsRes.data?.topics ?? [];
      if (intentRes?.success) iList = intentRes.data?.files ?? [];
      setTopics(tList);
      setIntentFiles(iList);
      setSelection((s) => {
        const fallbackTop = tList.map((t) => t.name);
        const fallbackFiles = iList.map((f) => f.name);
        return {
          ...s,
          selectedTopics: s.selectedTopics.length > 0 ? s.selectedTopics : fallbackTop,
          selectedFiles: s.selectedFiles.length > 0 ? s.selectedFiles : fallbackFiles,
        };
      });
      if (prefsRes?.success && prefsRes.data) {
        setSelection((s) => ({
          ...s,
          preset: prefsRes.data.preset ?? s.preset,
          selectedTopics: prefsRes.data.selectedTopics ?? s.selectedTopics,
          selectedFiles: prefsRes.data.selectedFiles ?? s.selectedFiles,
          includeGit: prefsRes.data.includeGit ?? s.includeGit,
          includePreflight: prefsRes.data.includePreflight ?? s.includePreflight,
          includeSchema: prefsRes.data.includeSchema ?? s.includeSchema,
          includeIntent: prefsRes.data.includeIntent ?? s.includeIntent,
        }));
      }
      loadedRef.current = true;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [localModule, profileId]);

  // Unmount: save prefs
  useEffect(() => {
    return () => {
      if (!loadedRef.current) return;
      try {
        getApi()?.gatewayHandoffSavePreferences?.(profileId, {
          moduleId: localModule, ...selectionRef.current,
        });
      } catch { /* ignore */ }
    };
  }, [profileId, moduleId]);

  const totalBytes = useMemo(() => {
    const t = topics.filter((x) => selection.selectedTopics.includes(x.name)).reduce((s, x) => s + x.bytes, 0);
    const f = selection.includeIntent
      ? intentFiles.filter((x) => selection.selectedFiles.includes(x.name)).reduce((s, x) => s + x.bytes, 0)
      : 0;
    return t + f;
  }, [topics, intentFiles, selection]);

  const applyPreset = useCallback((preset: Preset) => {
    setSelection((s) => {
      if (preset === 'all') {
        return { ...s, preset, selectedTopics: topics.map((t) => t.name), selectedFiles: intentFiles.map((f) => f.name), includeGit: true, includeIntent: true };
      }
      if (preset === 'topics-only') {
        return { ...s, preset, selectedTopics: topics.map((t) => t.name), selectedFiles: [], includeGit: true, includeIntent: false };
      }
      if (preset === 'minimal') {
        const arch = intentFiles.find((f) => f.name.startsWith('architecture'));
        return { ...s, preset, selectedTopics: topics.slice(0, 1).map((t) => t.name), selectedFiles: arch ? [arch.name] : [], includeGit: false, includeIntent: true };
      }
      return { ...s, preset };
    });
  }, [topics, intentFiles]);

  const toggleTopic = (name: string) => {
    setSelection((s) => {
      const has = s.selectedTopics.includes(name);
      return { ...s, preset: 'custom', selectedTopics: has ? s.selectedTopics.filter((n) => n !== name) : [...s.selectedTopics, name] };
    });
  };
  const toggleFile = (name: string) => {
    setSelection((s) => {
      const has = s.selectedFiles.includes(name);
      return { ...s, preset: 'custom', selectedFiles: has ? s.selectedFiles.filter((n) => n !== name) : [...s.selectedFiles, name] };
    });
  };
  const toggleOpt = (key: 'includeGit' | 'includePreflight' | 'includeSchema' | 'includeIntent') => {
    setSelection((s) => ({ ...s, preset: 'custom', [key]: !s[key] } as Selection));
  };

  const onExport = async () => {
    setExporting(true);
    setError('');
    setResult(null);
    try {
      const r = await getApi()?.gatewayExportHandoff?.({
        moduleId: localModule,
        taskTitle: 'Продолжение работы',
        selectedTopics: selection.selectedTopics,
        selectedFiles: selection.includeIntent ? selection.selectedFiles : [],
        fileName: fileName.trim() || undefined,
      });
      if (r?.success && r.data) {
        setResult({ path: r.data.path, bytes: r.data.bytes, markdown: r.data.markdown });
      } else {
        setError(r?.error || 'Не удалось собрать handoff');
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', opacity: 0.6 }}>Загрузка настроек…</div>;
  }

  return (
    <div
      className="handoff-tab-scroll"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        paddingRight: 6,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Модуль */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Модуль</label>
        <Dropdown
          value={localModule}
          options={HANDOFF_MODULES}
          onChange={(e) => {
            const v = e.value as string;
            setLocalModule(v);
            try { localStorage.setItem('handoff-module', v); } catch { /* ignore */ }
          }}
          style={{ width: '100%' }}
          appendTo={document.body}
          panelClassName="handoff-preset-panel"
        />
      </div>

      {/* Preset + fileName */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Пресет</label>
          <Dropdown
            value={selection.preset}
            options={PRESETS}
            onChange={(e) => applyPreset(e.value as Preset)}
            style={{ width: '100%' }}
            appendTo={document.body}
            pt={{
              root: { style: { zIndex: 2147483000 } },
              panel: { style: { zIndex: 2147483000 } },
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Имя файла (без .md — авто, если пусто)</label>
          <input
            type="text"
            className="p-inputtext p-component"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="handoff-…"
            style={{ width: '100%', background: C.panel, color: C.text, border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: '6px 10px', fontSize: 13 }}
          />
        </div>
      </div>

      {/* Topics */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Topics ({topics.length})</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="pb-soft" onClick={() => setSelection((s) => ({ ...s, preset: 'custom', selectedTopics: topics.map((t) => t.name) }))}>Все</button>
            <button type="button" className="pb-soft" onClick={() => setSelection((s) => ({ ...s, preset: 'custom', selectedTopics: [] }))}>Ничего</button>
          </div>
        </div>
        <div style={listBoxStyle}>
          {topics.length === 0 && <div style={{ opacity: 0.6, fontSize: 12 }}>Topics не найдены</div>}
          {topics.map((t) => (
            <label key={t.name} style={cbRowStyle}>
              <input type="checkbox" style={{ accentColor: '#4a9eff' }} checked={selection.selectedTopics.includes(t.name)} onChange={() => toggleTopic(t.name)} />
              <span style={{ flex: 1 }}>{t.title || t.name}</span>
              <span style={{ fontSize: 11, color: C.dim }}>{(t.bytes / 1024).toFixed(1)} KB</span>
            </label>
          ))}
        </div>
      </div>

      {/* Intent files */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Intent-файлы (handoff/)</label>
        <div style={listBoxStyle}>
          {intentFiles.length === 0 && <div style={{ opacity: 0.6, fontSize: 12 }}>Файлы не найдены</div>}
          {intentFiles.map((f) => (
            <label key={f.name} style={cbRowStyle}>
              <input type="checkbox" style={{ accentColor: '#4a9eff' }} checked={selection.selectedFiles.includes(f.name)} onChange={() => toggleFile(f.name)} disabled={!selection.includeIntent} />
              <span style={{ flex: 1, opacity: selection.includeIntent ? 1 : 0.5 }}>{f.name}</span>
              <span style={{ fontSize: 11, color: C.dim }}>{(f.bytes / 1024).toFixed(1)} KB</span>
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Опции</label>
        <div style={listBoxStyle}>
          <label style={cbRowStyle}>
            <input type="checkbox" style={{ accentColor: '#4a9eff' }} checked={selection.includeGit} onChange={() => toggleOpt('includeGit')} />
            <span>Git state (log, status, diff)</span>
          </label>
          <label style={cbRowStyle}>
            <input type="checkbox" style={{ accentColor: '#4a9eff' }} checked={selection.includeIntent} onChange={() => toggleOpt('includeIntent')} />
            <span>Intent-файлы (architecture/roadmap/…)</span>
          </label>
          <label style={cbRowStyle}>
            <input type="checkbox" style={{ accentColor: '#4a9eff' }} checked={selection.includePreflight} onChange={() => toggleOpt('includePreflight')} />
            <span>Preflight (проверка окружения)</span>
          </label>
          <label style={cbRowStyle}>
            <input type="checkbox" style={{ accentColor: '#4a9eff' }} checked={selection.includeSchema} onChange={() => toggleOpt('includeSchema')} />
            <span>Schema (структура БД)</span>
          </label>
        </div>
        <div style={totalStyle}>
          <span>Выбрано topics: {selection.selectedTopics.length} / {topics.length}</span>
          <span>Оценка размера: {(totalBytes / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      {/* Export */}
      <div style={{ ...sectionStyle, display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="pb"
          onClick={onExport}
          disabled={exporting}
          style={{ flex: 1, opacity: exporting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {exporting ? 'Собираю…' : (<><AppIcon name="assignment" set="material" filled size={14} /> Экспорт продолжения</>)}
        </button>
      </div>

      {error && (
        <div style={{ color: C.errText, fontSize: 12, padding: '8px 12px', background: C.errBg, borderRadius: 6, border: `1px solid ${C.errBorder}` }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: 12, background: C.okBg, border: `1px solid ${C.okBorder}`, borderRadius: 6, fontSize: 12 }}>
          <div style={{ marginBottom: 6 }}>✅ Сохранено: <code>{result.path}</code> ({(result.bytes / 1024).toFixed(1)} KB)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pb-soft" onClick={() => navigator.clipboard.writeText(result.path)}>Копировать путь</button>
            <button type="button" className="pb-soft" onClick={() => navigator.clipboard.writeText(result.markdown)}>Копировать markdown</button>
          </div>
        </div>
      )}
    </div>
  );
};