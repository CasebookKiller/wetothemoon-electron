// src/components/PRANA_BINDU/PANELS/ImportPanel/ImportPanel.tsx
//
// Панель «Импорт файлов»: FIT/TCX архив Strava, отдельные файлы,
// Strava CSV, Zepp-папка. Самодостаточна: держит все стейты,
// подписывается на pb:import-progress, вызывает IPC импорта.
//
// onAfterImport — родитель перечитывает run_facts после успешного
// импорта.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { Panel } from 'primereact/panel';
import { ProgressBar } from 'primereact/progressbar';

const IMPORT_ORIGIN_OPTIONS = [
  { label: 'Zepp / Amazfit', value: 'zepp-app' },
  { label: 'Strava-архив', value: 'strava-archive' },
  { label: 'Garmin Connect', value: 'garmin-connect' },
  { label: 'Coros', value: 'coros' },
  { label: 'Polar', value: 'polar' },
  { label: 'Suunto', value: 'suunto' },
  { label: 'Ручной импорт', value: 'manual-import' },
];

interface Props {
  className?: string;
  onAfterImport?: () => void | Promise<void>;
}

interface ImportProgress {
  current: number;
  total: number;
  filename: string;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
}

export const ImportPanel: React.FC<Props> = ({
  className,
  onAfterImport,
}) => {
  const api = (window as any).electronAPI;

  // Strava FIT/TCX архив
  const [fitArchivePath, setFitArchivePath] = useState<string>('');
  const [archiveUpdating, setArchiveUpdating] = useState(false);
  const [archiveResult, setArchiveResult] = useState<ImportResult | null>(
    null
  );
  const [archiveError, setArchiveError] = useState('');

  // Zepp-папка
  const [zeppArchivePath, setZeppArchivePath] = useState<string>('');
  const [zeppUpdating, setZeppUpdating] = useState(false);
  const [zeppResult, setZeppResult] = useState<ImportResult | null>(null);
  const [zeppError, setZeppError] = useState('');

  // Общие
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null
  );
  const [dragActive, setDragActive] = useState(false);
  const [importOrigin, setImportOrigin] = useState<string>('zepp-app');

  // Загрузка сохранённых путей при монтировании
  useEffect(() => {
    (async () => {
      try {
        const res = await api.pb.fitArchivePathGet?.();
        if (res?.success && res.path) setFitArchivePath(res.path);
      } catch {
        /* ignore */
      }
    })();
    (async () => {
      try {
        const res = await api.pb.zeppArchivePathGet?.();
        if (res?.success && res.path) setZeppArchivePath(res.path);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подписка на прогресс импорта
  useEffect(() => {
    if (!api?.pb?.onImportProgress) return;
    api.pb.onImportProgress((data: any) => setImportProgress(data));
    return () => {
      api.pb.removeImportProgressListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickArchiveFolder = async (): Promise<string | null> => {
    if (!api?.pb?.pickDirectory) return null;
    const res = await api.pb.pickDirectory({
      title: 'Выберите папку с FIT-файлами Strava',
      defaultPath: fitArchivePath || undefined,
    });
    if (!res?.success || !res.path) return null;
    return res.path;
  };

  const handleUpdateFitArchive = async () => {
    if (!api?.pb?.importFitDir) {
      setArchiveError('electronAPI.pb.importFitDir недоступен');
      return;
    }
    setArchiveUpdating(true);
    setArchiveError('');
    setArchiveResult(null);

    try {
      let targetPath = fitArchivePath;
      if (!targetPath) {
        const picked = await handlePickArchiveFolder();
        if (!picked) {
          setArchiveUpdating(false);
          return;
        }
        targetPath = picked;
      }

      const res = await api.pb.importFitDir(targetPath, {
        origin: 'strava-archive',
        skipImported: false,
        savePath: true,
      });

      if (res.success) {
        setFitArchivePath(targetPath);
        setArchiveResult({
          imported: res.imported ?? 0,
          updated: res.updated ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        if (onAfterImport) await onAfterImport();
      } else {
        setArchiveError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setArchiveError((e as Error).message);
    } finally {
      setArchiveUpdating(false);
      setImportProgress(null);
    }
  };

  const handleChangeArchiveFolder = async () => {
    const picked = await handlePickArchiveFolder();
    if (!picked) return;
    setFitArchivePath(picked);
    try {
      await api.pb.importFitDir(picked, {
        skipImported: true,
        savePath: true,
      });
    } catch {
      /* ignore */
    }
  };

  const handleCancelImport = async () => {
    try {
      await api.pb.importCancel?.();
    } catch {
      /* ignore */
    }
  };

  const runImportPaths = async (
    paths: string[],
    opts?: { origin?: string; skipImported?: boolean }
  ) => {
    if (!api?.pb?.importFiles) {
      setArchiveError('electronAPI.pb.importFiles недоступен');
      return;
    }
    if (paths.length === 0) return;

    setArchiveUpdating(true);
    setArchiveError('');
    setArchiveResult(null);
    try {
      const res = await api.pb.importFiles(paths, {
        origin: opts?.origin ?? 'manual-import',
        skipImported: opts?.skipImported === true,
      });
      if (res.success) {
        setArchiveResult({
          imported: res.imported ?? 0,
          updated: res.updated ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        if (onAfterImport) await onAfterImport();
      } else {
        setArchiveError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setArchiveError((e as Error).message);
    } finally {
      setArchiveUpdating(false);
      setImportProgress(null);
    }
  };

  const handlePickFiles = async () => {
    if (!api?.pb?.pickFiles) return;
    const res = await api.pb.pickFiles({ multiple: true });
    if (!res?.success || !Array.isArray(res.paths)) return;
    await runImportPaths(res.paths, { origin: importOrigin });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer?.files ?? []);
    const paths: string[] = [];
    for (const f of files) {
      try {
        const p = api.getPathForFile?.(f);
        if (p && typeof p === 'string') paths.push(p);
      } catch {
        /* ignore */
      }
    }
    await runImportPaths(paths, { origin: importOrigin });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleImportStravaCsv = async () => {
    if (!api?.pb?.pickCsv || !api?.pb?.importStravaCsv) {
      setArchiveError('electronAPI.pb.pickCsv / importStravaCsv недоступен');
      return;
    }
    const picked = await api.pb.pickCsv();
    if (!picked?.success || !picked.path) return;

    setArchiveUpdating(true);
    setArchiveError('');
    setArchiveResult(null);
    try {
      const res = await api.pb.importStravaCsv(picked.path);
      if (res.success) {
        setArchiveResult({
          imported: res.added ?? 0,
          updated: res.updated ?? 0,
          skipped: 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        if (onAfterImport) await onAfterImport();
      } else {
        setArchiveError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setArchiveError((e as Error).message);
    } finally {
      setArchiveUpdating(false);
    }
  };

  const handlePickZeppFolder = async (): Promise<string | null> => {
    if (!api?.pb?.pickDirectory) return null;
    const res = await api.pb.pickDirectory({
      title: 'Выберите папку с FIT-файлами Zepp',
      defaultPath: zeppArchivePath || undefined,
    });
    if (!res?.success || !res.path) return null;
    return res.path;
  };

  const handleChangeZeppFolder = async () => {
    const picked = await handlePickZeppFolder();
    if (!picked) return;
    setZeppArchivePath(picked);
    try {
      await api.pb.zeppArchivePathSet?.(picked);
    } catch {
      /* ignore */
    }
  };

  const handleUpdateZepp = async () => {
    if (!api?.pb?.importZeppDir) {
      setZeppError('electronAPI.pb.importZeppDir недоступен');
      return;
    }
    setZeppUpdating(true);
    setZeppError('');
    setZeppResult(null);

    try {
      let target = zeppArchivePath;
      if (!target) {
        const picked = await handlePickZeppFolder();
        if (!picked) {
          setZeppUpdating(false);
          return;
        }
        target = picked;
      }

      const res = await api.pb.importZeppDir(target, {
        skipIfFileExists: true,
        savePath: true,
      });

      if (res.success) {
        setZeppArchivePath(target);
        setZeppResult({
          imported: res.imported ?? 0,
          updated: res.updated ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        if (onAfterImport) await onAfterImport();
      } else {
        setZeppError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setZeppError((e as Error).message);
    } finally {
      setZeppUpdating(false);
      setImportProgress(null);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`pb-archive-dropzone ${
        dragActive ? 'pb-archive-dropzone--active' : ''
      } ${className ?? ''}`}
    >
      <Panel
        header="Импорт файлов"
        className="shadow-5 mb-3 pb-panel"
      >
        <div className="flex flex-column gap-2">
          <div className="pb-archive-origin">
            <label className="pb-label">Откуда файлы</label>
            <Dropdown
              value={importOrigin}
              options={IMPORT_ORIGIN_OPTIONS}
              onChange={(e) => setImportOrigin(e.value)}
              className="pb-archive-origin__dropdown"
              panelClassName="pb-dropdown-panel"
            />
            <small className="pb-hint">
              Метка источника сохраняется при первом импорте и не меняется
              при повторных загрузках того же файла.
            </small>
          </div>
        </div>

        <div className="flex flex-column gap-2">
          <label className="pb-label">
            Путь к папке с FIT/TCX-файлами
          </label>
          <div className="flex gap-2 flex-wrap align-items-center">
            <span
              className="pb-archive-path"
              title={fitArchivePath || undefined}
            >
              {fitArchivePath || <i>папка не выбрана</i>}
            </span>
            <Button
              label={fitArchivePath ? 'Сменить папку' : 'Выбрать папку'}
              icon="pi pi-folder-open"
              className="pb-soft p-button-sm"
              onClick={handleChangeArchiveFolder}
              disabled={archiveUpdating}
            />
            <Button
              label={
                archiveUpdating ? 'Обновление…' : 'Обновить архив'
              }
              icon={
                archiveUpdating
                  ? 'pi pi-spin pi-spinner'
                  : 'pi pi-refresh'
              }
              className="pb p-button-sm"
              onClick={handleUpdateFitArchive}
              disabled={archiveUpdating}
            />
            <Button
              label="Импортировать файлы"
              icon="pi pi-upload"
              className="pb-soft p-button-sm"
              onClick={handlePickFiles}
              disabled={archiveUpdating}
              tooltip="Выбрать отдельные FIT/TCX файлы для импорта"
            />
            <Button
              label="Импорт Strava CSV"
              icon="pi pi-file-import"
              className="pb-soft p-button-sm"
              onClick={handleImportStravaCsv}
              disabled={archiveUpdating}
              tooltip="Импортировать activities.csv из архива Strava"
            />
          </div>
          <small className="pb-hint">
            Перетащите FIT/TCX файлы в эту панель, чтобы импортировать их
            без выбора папки.
          </small>
        </div>

        {archiveUpdating && importProgress && (
          <div className="pb-import-progress">
            <div className="pb-import-progress__header">
              <span>
                {importProgress.current} / {importProgress.total}
                {' · '}
                <code>{importProgress.filename}</code>
              </span>
              <Button
                label="Отмена"
                icon="pi pi-times"
                className="pb-soft p-button-sm"
                onClick={handleCancelImport}
              />
            </div>
            <ProgressBar
              value={Math.round(
                (importProgress.current / importProgress.total) * 100
              )}
              showValue={false}
              style={{ height: '6px' }}
            />
            <div className="pb-import-progress__stats">
              <span>+{importProgress.imported}</span>
              <span>~{importProgress.updated}</span>
              <span>·{importProgress.skipped}</span>
              {importProgress.failed > 0 && (
                <span className="pb-import-progress__fail">
                  ✗{importProgress.failed}
                </span>
              )}
            </div>
          </div>
        )}

        {archiveError && (
          <Message
            severity="error"
            text={archiveError}
            className="w-full mt-2"
          />
        )}

        {archiveResult && (
          <Message
            severity={archiveResult.failed > 0 ? 'warn' : 'success'}
            className="w-full mt-2"
            content={
              <span>
                Добавлено <b>{archiveResult.imported}</b>
                {' · '}обновлено <b>{archiveResult.updated}</b>
                {archiveResult.skipped > 0 && (
                  <> · пропущено <b>{archiveResult.skipped}</b></>
                )}
                {archiveResult.failed > 0 && (
                  <> · ошибок <b>{archiveResult.failed}</b></>
                )}
                {' · '}всего файлов <b>{archiveResult.total}</b>
              </span>
            }
          />
        )}

        <hr className="pb-sep" />

        <div className="flex flex-column gap-2">
          <label className="pb-label">
            Папка с FIT-файлами Zepp (Yandex.Disk)
          </label>
          <div className="flex gap-2 flex-wrap align-items-center">
            <span
              className="pb-archive-path"
              title={zeppArchivePath || undefined}
            >
              {zeppArchivePath || <i>папка не выбрана</i>}
            </span>
            <Button
              label={zeppArchivePath ? 'Сменить папку' : 'Выбрать папку'}
              icon="pi pi-folder-open"
              className="pb-soft p-button-sm"
              onClick={handleChangeZeppFolder}
              disabled={zeppUpdating}
            />
            <Button
              label={zeppUpdating ? 'Обновление…' : 'Обновить Zepp'}
              icon={
                zeppUpdating ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'
              }
              className="pb p-button-sm"
              onClick={handleUpdateZepp}
              disabled={zeppUpdating}
              tooltip="Импортировать только те тренировки, которых ещё нет"
            />
          </div>
          <small className="pb-hint">
            Тренировки, уже загруженные через Strava-архив (± 2 мин
            по времени старта), будут пропущены.
          </small>
        </div>

        {zeppUpdating && importProgress && (
          <div className="pb-import-progress">
            <div className="pb-import-progress__header">
              <span>
                {importProgress.current} / {importProgress.total}
                {' · '}
                <code>{importProgress.filename}</code>
              </span>
              <Button
                label="Отмена"
                icon="pi pi-times"
                className="pb-soft p-button-sm"
                onClick={handleCancelImport}
              />
            </div>
            <ProgressBar
              value={Math.round(
                (importProgress.current / importProgress.total) * 100
              )}
              showValue={false}
              style={{ height: '6px' }}
            />
            <div className="pb-import-progress__stats">
              <span>+{importProgress.imported}</span>
              <span>·{importProgress.skipped}</span>
              {importProgress.failed > 0 && (
                <span className="pb-import-progress__fail">
                  ✗{importProgress.failed}
                </span>
              )}
            </div>
          </div>
        )}

        {zeppError && (
          <Message
            severity="error"
            text={zeppError}
            className="w-full mt-2"
          />
        )}

        {zeppResult && (
          <Message
            severity={zeppResult.failed > 0 ? 'warn' : 'success'}
            className="w-full mt-2"
            content={
              <span>
                Zepp: добавлено <b>{zeppResult.imported}</b>
                {' · '}пропущено <b>{zeppResult.skipped}</b>
                {zeppResult.failed > 0 && (
                  <> · ошибок <b>{zeppResult.failed}</b></>
                )}
                {' · '}всего <b>{zeppResult.total}</b>
              </span>
            }
          />
        )}
      </Panel>
    </div>
  );
};