// src/components/SIETCH/SensitiveVaultDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';


export interface SensitiveVaultDialogProps {
  visible: boolean;
  entityId: number | null;
  entityLabel?: string;
  onHide: () => void;
}

interface SensitiveStatus {
  initialized: boolean;
  mode: 'passphrase' | 'system-key' | null;
  unlocked: boolean;
  autoUnlockAvailable: boolean;
  hasStoredPassphrase: boolean;
}

interface SensitiveRecordMeta {
  id: number;
  entity_id: number;
  field_name: string;
  created_at: string;
  legal_basis: string;
  retention_until: string | null;
  notes: string | null;
}

type Phase = 'checking' | 'setup' | 'locked' | 'unlocked';

export const SensitiveVaultDialog: React.FC<SensitiveVaultDialogProps> = ({
  visible,
  entityId,
  entityLabel,
  onHide,
}) => {
  const api = (window as any).electronAPI;

  const [phase, setPhase] = useState<Phase>('checking');
  const [status, setStatus] = useState<SensitiveStatus | null>(null);
  const [records, setRecords] = useState<SensitiveRecordMeta[]>([]);
  const [fieldNames, setFieldNames] = useState<string[]>([]);

  // --- Setup (инициализация) ---
  const [setupMode, setSetupMode] = useState<'passphrase' | 'system-key'>('passphrase');
  const [setupLang, setSetupLang] = useState<'en' | 'ru'>('en');
  const [setupWordCount, setSetupWordCount] = useState(12);
  const [setupPhrase, setSetupPhrase] = useState('');
  const [setupPhraseConfirm, setSetupPhraseConfirm] = useState('');
  const [setupSaveAuto, setSetupSaveAuto] = useState(true);
  const [setupRuReady, setSetupRuReady] = useState(false);
  const [setupEnReady, setSetupEnReady] = useState(false);

  // --- Unlock ---
  const [unlockPhrase, setUnlockPhrase] = useState('');
  const [unlockSaveAuto, setUnlockSaveAuto] = useState(false);

  // --- Сообщения ---
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // --- Раскрытые значения ---
  const [revealedValues, setRevealedValues] = useState<Record<number, string>>({});

  // --- Форма добавления ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    field_name: '',
    field_value: '',
    legal_basis: '',
    retention_until: '',
    notes: '',
  });

  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  // ============ Инициализация ============
  useEffect(() => {
    if (!visible || !entityId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entityId]);

  // Проверка словников
  useEffect(() => {
    if (import.meta.env.DEV) {
      import('@/shared/sensitive/wordlists').then(({ diagnoseWordlist }) => {
        console.log('[wordlist:ru]', diagnoseWordlist('ru'));
        console.log('[wordlist:en]', diagnoseWordlist('en'));
      });
    }
  }, []);

  // Сброс раскрытых значений при закрытии диалога
  useEffect(() => {
    if (!visible) {
      setRevealedValues({});
      setMessage('');
      setShowAddForm(false);
      setUnlockPhrase('');
      setSetupPhrase('');
      setSetupPhraseConfirm('');
    }
  }, [visible]);

  const refresh = async () => {
    setBusy(true);
    setMessage('');
    try {
      const [statusRes, fieldsRes, enRes, ruRes] = await Promise.all([
        api.sensitiveStatus(),
        api.sensitiveFieldNames(),
        api.sensitiveWordlistReady('en'),
        api.sensitiveWordlistReady('ru'),
      ]);

      if (!statusRes.success) {
        setMessage(`Ошибка: ${statusRes.error}`);
        setPhase('checking');
        return;
      }
      const st: SensitiveStatus = statusRes.data;
      setStatus(st);
      setFieldNames(fieldsRes.items || []);
      setSetupEnReady(!!enRes.ready);
      setSetupRuReady(!!ruRes.ready);
      setSetupLang(enRes.ready ? 'en' : ruRes.ready ? 'ru' : 'en');

      if (!st.initialized) {
        setPhase('setup');
        return;
      }

      if (st.unlocked) {
        setPhase('unlocked');
        await loadRecords();
        return;
      }

      // Попытка авто-разблокировки
      if (st.hasStoredPassphrase) {
        const autoRes = await api.sensitiveTryAutoUnlock();
        if (autoRes?.success) {
          setPhase('unlocked');
          await loadRecords();
          return;
        }
        // не удалось — падаем в locked
      }
      setPhase('locked');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const loadRecords = async () => {
    if (!entityId) return;
    const res = await api.sensitiveList(entityId);
    if (res.success) setRecords(res.items || []);
    else setMessage(`Ошибка загрузки списка: ${res.error}`);
  };

  // ============ Setup: генерация и валидация ============
  const handleGeneratePhrase = async () => {
    if (!setupLang) return;
    const ready = setupLang === 'en' ? setupEnReady : setupRuReady;
    if (!ready) {
      setMessage(`Словник "${setupLang}" не загружен`);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await api.sensitiveGeneratePhrase(setupLang, setupWordCount);
      if (res.success) {
        setSetupPhrase(res.phrase);
        setSetupPhraseConfirm('');
      } else {
        setMessage(`Ошибка: ${res.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSetupInit = async () => {
    if (setupMode === 'passphrase') {
      if (!setupPhrase.trim()) { setMessage('Введите фразу'); return; }
      if (setupPhrase !== setupPhraseConfirm) { setMessage('Фразы не совпадают'); return; }
      const checkRes = await api.sensitiveValidatePhrase(setupPhrase, setupLang);
      if (!checkRes.valid) { setMessage(`Фраза невалидна: ${checkRes.error}`); return; }
    }
    setBusy(true);
    setMessage('');
    try {
      const input =
        setupMode === 'passphrase'
          ? { mode: 'passphrase' as const, passphrase: setupPhrase, saveAutoUnlock: setupSaveAuto }
          : { mode: 'system-key' as const, saveAutoUnlock: setupSaveAuto };
      const res = await api.sensitiveInit(input);
      if (res.success) {
        setMessage('Хранилище создано');
        await refresh();
      } else {
        setMessage(`Ошибка: ${res.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  // ============ Unlock ============
  const handleUnlock = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (status?.mode === 'passphrase') {
        if (!unlockPhrase.trim()) { setMessage('Введите фразу'); setBusy(false); return; }
        const res = await api.sensitiveUnlock(unlockPhrase, unlockSaveAuto);
        if (res.success) {
          setUnlockPhrase('');
          await refresh();
        } else {
          setMessage(`Ошибка: ${res.error}`);
        }
      } else {
        const res = await api.sensitiveTryAutoUnlock();
        if (res.success) await refresh();
        else setMessage(`Ошибка: ${res.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleForgetAuto = async () => {
    if (!window.confirm('Забыть сохранённую фразу? Придётся вводить её вручную.')) return;
    await api.sensitiveForgetAuto();
    await refresh();
  };

  // ============ Reveal / Delete ============
  const handleReveal = async (id: number) => {
    if (revealedValues[id]) {
      const next = { ...revealedValues };
      delete next[id];
      setRevealedValues(next);
      return;
    }
    const res = await api.sensitiveReveal(id);
    if (res.success) {
      setRevealedValues((prev) => ({ ...prev, [id]: res.value }));
    } else {
      setMessage(`Ошибка: ${res.error}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить sensitive-запись безвозвратно?')) return;
    const res = await api.sensitiveDelete(id);
    if (res.success) {
      setRevealedValues((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadRecords();
    } else {
      setMessage(`Ошибка: ${res.error}`);
    }
  };

  // ============ Add ============
  const handleAdd = async () => {
    if (!entityId) return;
    if (!addForm.field_name.trim()) { setMessage('Укажите поле'); return; }
    if (!addForm.field_value.trim()) { setMessage('Укажите значение'); return; }
    if (!addForm.legal_basis.trim()) { setMessage('Укажите основание хранения'); return; }
    setBusy(true);
    setMessage('');
    try {
      const res = await api.sensitiveAdd({
        entity_id: entityId,
        field_name: addForm.field_name.trim(),
        field_value: addForm.field_value,
        legal_basis: addForm.legal_basis.trim(),
        retention_until: addForm.retention_until || null,
        notes: addForm.notes || null,
      });
      if (res.success) {
        setAddForm({ field_name: '', field_value: '', legal_basis: '', retention_until: '', notes: '' });
        setShowAddForm(false);
        await loadRecords();
      } else {
        setMessage(`Ошибка: ${res.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const performReset = async () => {
    if (resetConfirmText.trim() !== 'СБРОСИТЬ') {
      setMessage('Введите слово СБРОСИТЬ заглавными буквами');
      return;
    }
    setResetBusy(true);
    try {
      const res = await api.sensitiveReset();
      if (res.success) {
        setResetConfirmVisible(false);
        setResetConfirmText('');
        setMessage('');
        // Возврат в фазу setup
        await refresh();
      } else {
        setMessage(`Ошибка: ${res.error}`);
      }
    } finally {
      setResetBusy(false);
    }
  };

  // ============ Рендер помощники ============
  const fieldOptions = fieldNames.map((n) => ({ label: n, value: n }));

  const renderValue = (row: SensitiveRecordMeta) => {
    const revealed = revealedValues[row.id];
    return (
      <div className="flex align-items-center gap-2">
        <Button
          icon={revealed ? 'pi pi-eye-slash' : 'pi pi-eye'}
          className="osint-soft p-button-sm"
          onClick={() => handleReveal(row.id)}
          tooltip={revealed ? 'Скрыть' : 'Показать'}
        />
        {revealed ? (
          <code style={{ wordBreak: 'break-all' }}>{revealed}</code>
        ) : (
          <span className="text-500">••••••••</span>
        )}
      </div>
    );
  };

  const renderDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : '—';

  // ============ Футер ============
  const renderFooter = () => {
    if (phase === 'setup') {
      return (
        <div className="p-panel-footer flex justify-content-end gap-2">
          <Button label="Отмена" icon="pi pi-times" className="osint-soft" onClick={onHide} disabled={busy} />
          <Button
            label={busy ? 'Создание...' : 'Инициализировать'}
            icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="osint"
            onClick={handleSetupInit}
            disabled={busy}
          />
        </div>
      );
    }
    if (phase === 'locked') {
      return (
        <div className="p-panel-footer flex justify-content-between align-items-center gap-2 flex-wrap">
          <Button
            label="Сбросить хранилище"
            icon="pi pi-trash"
            className="osint-destructive-soft p-button-sm"
            onClick={() => { setResetConfirmText(''); setResetConfirmVisible(true); }}
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button label="Закрыть" icon="pi pi-times" className="osint-soft" onClick={onHide} disabled={busy} />
            <Button
              label={busy ? 'Разблокировка...' : 'Разблокировать'}
              icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-lock-open'}
              className="osint"
              onClick={handleUnlock}
              disabled={busy}
            />
          </div>
        </div>
      );
    }
    if (phase === 'unlocked') {
      return (
        <div className="p-panel-footer flex justify-content-between align-items-center gap-2 flex-wrap">
          <Button
            label="Сбросить хранилище"
            icon="pi pi-trash"
            className="osint-destructive-soft p-button-sm"
            onClick={() => { setResetConfirmText(''); setResetConfirmVisible(true); }}
          />
          <div className="flex gap-2">
            <Button
              label="Заблокировать"
              icon="pi pi-lock"
              className="osint-soft"
              onClick={async () => { await api.sensitiveLock(); await refresh(); }}
            />
            <Button label="Закрыть" icon="pi pi-times" className="osint-soft" onClick={onHide} />
          </div>
        </div>
      );
    }
    return null;
  };

  // ============ Рендер контента ============
  const renderContent = () => {
    if (phase === 'checking') {
      return <p>Загрузка...</p>;
    }

    if (phase === 'setup') {
      return (
        <div className="p-fluid">
          <div
            className="p-3 border-round mb-3 flex align-items-start gap-2"
            style={{
              background: 'rgba(236, 156, 66, 0.08)',
              border: '1px solid rgba(236, 156, 66, 0.4)',
            }}
          >
            <i className="pi pi-shield mt-1" style={{ color: '#ec9c42' }} />
            <div className="text-sm">
              <b>Чувствительные данные</b> хранятся в отдельной зашифрованной базе.
              Выберите, как будет защищено хранилище. <b>Паспорт, СНИЛС, домашний
              адрес, личные телефоны</b> не должны попадать в основную БД — только сюда.
            </div>
          </div>

          <div className="field">
            <label className="font-bold mb-2">Режим защиты</label>
            <div className="flex flex-column gap-2">
              <label className="flex align-items-center gap-2">
                <input
                  type="radio"
                  name="setupMode"
                  value="passphrase"
                  checked={setupMode === 'passphrase'}
                  onChange={() => setSetupMode('passphrase')}
                  disabled={busy}
                />
                <span>
                  <b>Фраза восстановления</b> (портативно)
                  <div className="text-sm text-500">
                    10–24 слова. Можно перенести sensitive_data.db на другую машину и
                    расшифровать той же фразой. Передавайте фразу отдельно от файлов.
                  </div>
                </span>
              </label>
              <label className="flex align-items-center gap-2">
                <input
                  type="radio"
                  name="setupMode"
                  value="system-key"
                  checked={setupMode === 'system-key'}
                  onChange={() => setSetupMode('system-key')}
                  disabled={busy || !status?.autoUnlockAvailable}
                />
                <span>
                  <b>Системный ключ</b> (только эта машина)
                  <div className="text-sm text-500">
                    Не потребуется вводить фразу. Данные нельзя перенести на другую
                    машину или передать доверенному лицу.
                    {!status?.autoUnlockAvailable && (
                      <> <b>Недоступно:</b> системный keyring не отвечает.</>
                    )}
                  </div>
                </span>
              </label>
            </div>
          </div>

          {setupMode === 'passphrase' && (
            <>
              <div className="grid mt-3">
                <div className="col-6 field">
                  <label className="font-bold">Язык словника</label>
                  <Dropdown
                    value={setupLang}
                    options={[
                      { label: `English${setupEnReady ? '' : ' (не загружен)'}`, value: 'en', disabled: !setupEnReady },
                      { label: `Русский${setupRuReady ? '' : ' (не загружен)'}`, value: 'ru', disabled: !setupRuReady },
                    ]}
                    onChange={(e) => setSetupLang(e.value)}
                    disabled={busy}
                  />
                </div>
                <div className="col-6 field">
                  <label className="font-bold">Слов</label>
                  <InputText
                    type="number"
                    value={String(setupWordCount)}
                    onChange={(e) => setSetupWordCount(Math.max(10, Math.min(24, parseInt(e.target.value) || 12)))}
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="flex gap-2 mb-2">
                <Button
                  label="Сгенерировать"
                  icon="pi pi-refresh"
                  className="osint-soft p-button-sm"
                  onClick={handleGeneratePhrase}
                  disabled={busy || !(setupLang === 'en' ? setupEnReady : setupRuReady)}
                />
                <Button
                  label="Ввести свою"
                  icon="pi pi-pencil"
                  className="osint-soft p-button-sm"
                  onClick={() => { setSetupPhrase(''); setSetupPhraseConfirm(''); }}
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label className="font-bold">Фраза *</label>
                <InputTextarea
                  value={setupPhrase}
                  onChange={(e) => setSetupPhrase(e.target.value)}
                  rows={3}
                  autoResize
                  placeholder="10–24 слова через пробел"
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label className="font-bold">Подтверждение *</label>
                <InputTextarea
                  value={setupPhraseConfirm}
                  onChange={(e) => setSetupPhraseConfirm(e.target.value)}
                  rows={3}
                  autoResize
                  disabled={busy}
                />
              </div>

              <div
                className="p-2 border-round mb-2 flex align-items-start gap-2"
                style={{
                  background: 'rgba(236, 57, 66, 0.08)',
                  border: '1px solid rgba(236, 57, 66, 0.4)',
                }}
              >
                <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec3942' }} />
                <div className="text-sm">
                  <b>Сохраните фразу в надёжном месте.</b> Без неё данные восстановить
                  нельзя. Не передавайте фразу вместе с файлами sensitive_data.db.
                </div>
              </div>
            </>
          )}

          {status?.autoUnlockAvailable && (
            <div className="field-checkbox mt-3">
              <Checkbox
                inputId="setupSaveAuto"
                checked={setupSaveAuto}
                onChange={(e) => setSetupSaveAuto(e.checked ?? false)}
                disabled={busy}
              />
              <label htmlFor="setupSaveAuto" className="ml-2">
                Сохранить в системном хранилище для авторазблокировки
                <div className="text-sm text-500">
                  Не придётся вводить фразу при следующем запуске на этой машине.
                </div>
              </label>
            </div>
          )}

          {message && <p className="p-error mt-2">{message}</p>}
        </div>
      );
    }

    if (phase === 'locked') {
      return (
        <div className="p-fluid">
          <div
            className="p-3 border-round mb-3 flex align-items-start gap-2"
            style={{
              background: 'rgba(236, 156, 66, 0.08)',
              border: '1px solid rgba(236, 156, 66, 0.4)',
            }}
          >
            <i className="pi pi-lock mt-1" style={{ color: '#ec9c42' }} />
            <div className="text-sm">
              Хранилище защищено режимом{' '}
              <b>{status?.mode === 'passphrase' ? 'фразы восстановления' : 'системного ключа'}</b>.
            </div>
          </div>

          {status?.mode === 'passphrase' && (
            <>
              <div className="field">
                <label className="font-bold">Фраза восстановления</label>
                <InputText
                  type="password"
                  value={unlockPhrase}
                  onChange={(e) => setUnlockPhrase(e.target.value)}
                  placeholder="10–24 слова через пробел"
                  disabled={busy}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                />
              </div>

              {status.autoUnlockAvailable && (
                <div className="field-checkbox mb-2">
                  <Checkbox
                    inputId="unlockSaveAuto"
                    checked={unlockSaveAuto}
                    onChange={(e) => setUnlockSaveAuto(e.checked ?? false)}
                    disabled={busy}
                  />
                  <label htmlFor="unlockSaveAuto" className="ml-2">
                    Сохранить для авторазблокировки
                  </label>
                </div>
              )}
            </>
          )}

          {status?.hasStoredPassphrase && (
            <Button
              label="Забыть сохранённую фразу"
              icon="pi pi-trash"
              className="osint-destructive-soft p-button-sm"
              onClick={handleForgetAuto}
              disabled={busy}
            />
          )}

          {message && <p className="p-error mt-2">{message}</p>}
        </div>
      );
    }

    // phase === 'unlocked'
    return (
      <div className="p-fluid">
        <div className="flex justify-content-between align-items-center mb-3 gap-2 sensitive-header-row">
          <div className="sensitive-entity-label">
            <span className="text-sm text-500">Сущность: </span>
            <b title={entityLabel || `#${entityId}`}>
              {entityLabel || `#${entityId}`}
            </b>
          </div>
          <Button
            icon="pi pi-plus"
            className="osint-soft p-button-sm sensitive-add-button"
            tooltip="Добавить чувствительную запись"
            tooltipOptions={{ position: 'left' }}
            onClick={() => setShowAddForm((v) => !v)}
          />
        </div>

        {showAddForm && (
          <div
            className="p-3 border-round mb-3"
            style={{
              border: '1px solid var(--tg-theme-hint-color)',
            }}
          >
            <div className="grid">
              <div className="col-12 md:col-6 field">
                <label className="font-bold">Поле *</label>
                <Dropdown
                  value={addForm.field_name}
                  options={fieldOptions}
                  onChange={(e) => setAddForm({ ...addForm, field_name: e.value })}
                  placeholder="Выберите поле"
                  editable
                  disabled={busy}
                />
              </div>
              <div className="col-12 md:col-6 field">
                <label className="font-bold">Хранить до</label>
                <InputText
                  type="date"
                  value={addForm.retention_until}
                  onChange={(e) => setAddForm({ ...addForm, retention_until: e.target.value })}
                  disabled={busy}
                />
              </div>
              <div className="col-12 field">
                <label className="font-bold">Значение *</label>
                <InputTextarea
                  value={addForm.field_value}
                  onChange={(e) => setAddForm({ ...addForm, field_value: e.target.value })}
                  rows={2}
                  autoResize
                  disabled={busy}
                />
              </div>
              <div className="col-12 field">
                <label className="font-bold">Основание хранения *</label>
                <InputText
                  value={addForm.legal_basis}
                  onChange={(e) => setAddForm({ ...addForm, legal_basis: e.target.value })}
                  placeholder="Например: служебная необходимость, согласие субъекта"
                  disabled={busy}
                />
              </div>
              <div className="col-12 field">
                <label className="font-bold">Заметки</label>
                <InputTextarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  rows={2}
                  autoResize
                  disabled={busy}
                />
              </div>
            </div>
            <div className="flex justify-content-end gap-2">
              <Button
                label="Отмена"
                icon="pi pi-times"
                className="osint-soft p-button-sm"
                onClick={() => setShowAddForm(false)}
                disabled={busy}
              />
              <Button
                label={busy ? 'Сохранение...' : 'Сохранить'}
                icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
                className="osint p-button-sm"
                onClick={handleAdd}
                disabled={busy}
              />
            </div>
          </div>
        )}

        <DataTable
          value={records}
          emptyMessage="Нет чувствительных записей"
          responsiveLayout="scroll"
          size="small"
          scrollable
          scrollHeight="300px"
        >
          <Column field="id" header="ID" style={{ width: '4rem' }} />
          <Column field="field_name" header="Поле" style={{ width: '12rem' }} />
          <Column header="Значение" body={renderValue} style={{ minWidth: '14rem' }} />
          <Column
            field="created_at"
            header="Создано"
            body={(r: SensitiveRecordMeta) => renderDate(r.created_at)}
            style={{ width: '11rem' }}
          />
          <Column field="legal_basis" header="Основание" style={{ minWidth: '12rem' }} />
          <Column
            field="retention_until"
            header="Хранить до"
            body={(r: SensitiveRecordMeta) => r.retention_until || '—'}
            style={{ width: '8rem' }}
          />
          <Column
            header=""
            style={{ width: '4rem' }}
            body={(r: SensitiveRecordMeta) => (
              <Button
                icon="pi pi-trash"
                className="osint-destructive-soft p-button-sm"
                onClick={() => handleDelete(r.id)}
                tooltip="Удалить"
              />
            )}
          />
        </DataTable>

        {message && <p className="p-error mt-2">{message}</p>}
      </div>
    );
  };

  return (
    <Dialog
      visible={visible}
      style={{ width: '800px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={
        <span className="p-panel-title">
          <i className="pi pi-shield mr-2" />
          Чувствительные данные
        </span>
      }
      footer={renderFooter()}
    >
      {renderContent()}
      <Dialog
        visible={resetConfirmVisible}
        style={{ width: '520px', maxWidth: '95vw' }}
        modal
        onHide={() => { if (!resetBusy) setResetConfirmVisible(false); }}
        header={
          <span className="p-panel-title" style={{ color: 'var(--tg-theme-destructive-text-color, #ec3942)' }}>
            <i className="pi pi-exclamation-triangle mr-2" />
            Сбросить хранилище
          </span>
        }
        footer={
          <div className="p-panel-footer flex justify-content-end gap-2">
            <Button
              label="Отмена"
              icon="pi pi-times"
              className="osint-soft"
              onClick={() => setResetConfirmVisible(false)}
              disabled={resetBusy}
            />
            <Button
              label={resetBusy ? 'Сброс...' : 'Сбросить'}
              icon={resetBusy ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
              className="osint-destructive"
              onClick={performReset}
              disabled={resetBusy || resetConfirmText.trim() !== 'СБРОСИТЬ'}
            />
          </div>
        }
      >
        <div className="p-fluid">
          <div
            className="p-3 border-round mb-3 flex align-items-start gap-2"
            style={{
              background: 'rgba(236, 57, 66, 0.08)',
              border: '1px solid rgba(236, 57, 66, 0.4)',
            }}
          >
            <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec3942' }} />
            <div className="text-sm">
              <b>Все sensitive-данные будут безвозвратно удалены.</b> Файл
              <code> sensitive_data.db</code>, WAL/SHM и сохранённая в keyring фраза
              будут стёрты. После сброса хранилище вернётся в режим настройки —
              нужно будет задать новую фразу.
            </div>
          </div>

          <p className="text-sm">
            Если вы хотите сохранить текущие данные — сначала сделайте внешний
            backup <code>sensitive_data.db</code> и запишите текущую фразу.
          </p>

          <div className="field mt-3">
            <label htmlFor="resetConfirm" className="font-bold">
              Для подтверждения введите <code>СБРОСИТЬ</code>:
            </label>
            <InputText
              id="resetConfirm"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="СБРОСИТЬ"
              disabled={resetBusy}
              className="w-full"
            />
          </div>

          {message && <p className="p-error mt-2">{message}</p>}
        </div>
      </Dialog>
    </Dialog>
  );
};