// src/components/GATEWAY/GatewayShareModal/GatewayShareModal.tsx

import React, { useState } from 'react';
import { CopyIcon, CheckIcon, CloseIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import { classNames } from '@/css/classnames';

interface GatewayShareModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateLink: () => Promise<string>;
  onCreated?: () => void;
}

const GatewayShareModal: React.FC<GatewayShareModalProps> = ({
  visible,
  onClose,
  onCreateLink,
  onCreated,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!visible) return null;

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const createdUrl = await onCreateLink();
      setUrl(createdUrl);
      onCreated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch (err) {
      console.error('Ошибка копирования:', err);
    }
  };

  return (
    <>
      <div className="ds-modal-overlay" style={{ zIndex: 1024 }} />
      <div className="ds-theme ds-modal-wrapper" data-transform-origin="center" style={{ zIndex: 1025 }}>
        <div className="ds-modal" aria-modal="true">
          <div data-focus-guard="true" tabIndex={0} style={{ width: 1, height: 0, padding: 0, overflow: 'hidden', position: 'fixed', top: 1, left: 1 }} />
          <div data-focus-lock-disabled="false" className="ds-modal-focus-lock">
            <div tabIndex={-1} className="ds-modal-content ds-elevated ds-modal-content--dialog" role="dialog" style={{ width: 408 }}>
              <div className="ds-modal-content__header-wrapper">
                <div className="ds-modal-content__title">Создать публичную ссылку</div>
                <div
                  role="button"
                  className="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--xs ds-button--icon-relative-m ds-button--sizing-content ds-modal-content__close"
                  tabIndex={0}
                  onClick={onClose}
                >
                  <div className="ds-button__background" />
                  <div className="ds-button__icon ds-button__icon--last-child">
                    <CloseIcon size={16} />
                  </div>
                </div>
              </div>

              <div className="ds-modal-content__main">
                <div>
                  Любой, у кого есть ссылка, может просмотреть ваш общий диалог. Проверьте наличие конфиденциальной или личной информации. Управлять общими ссылками можно в Настройки &gt; Данные.
                </div>
                {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
              </div>

              <div className="ds-modal-content__footer">
                {url === null ? (
                  <div
                    role="button"
                    className={classNames({
                      'ds-button': true,
                      'ds-button--primary': true,
                      'ds-button--filled': true,
                      'ds-button--capsule': true,
                      'ds-button--block': true,
                      'ds-button--xl': true,
                      'ds-button--icon-relative-m': true,
                      'ds-button--min-width': true,
                    })}
                    tabIndex={0}
                    onClick={handleCreate}
                    style={{ pointerEvents: creating ? 'none' : 'auto' }}
                  >
                    <div className="ds-button__background" />
                    <span className="ds-button__content">
                      {creating ? 'Создание...' : 'Создать и скопировать'}
                    </span>
                  </div>
                ) : (
                  <div className="ds-copyable-text-line">
                    <div className="ds-copyable-text-line__scroll">
                      <span className="ds-copyable-text-line__text">{url}</span>
                    </div>
                    <div className="ds-copyable-text-line__action">
                      <div className="ds-copyable-text-line__mask" style={{ display: 'block' }} />
                      <div
                        role="button"
                        className={classNames({
                          'ds-button': true,
                          'ds-button--primary': true,
                          'ds-button--filled': true,
                          'ds-button--capsule': true,
                          'ds-button--m': true,
                          'ds-button--icon-relative-m': true,
                          'ds-button--min-width': true,
                        })}
                        tabIndex={0}
                        onClick={handleCopy}
                        style={
                          copyState === 'copied'
                            ? ({
                                pointerEvents: 'none',
                                '--dsl-button-opacity-disabled': 1,
                                '--dsl-button-color': 'var(--dsw-alias-button-primary-dimmed)',
                              } as React.CSSProperties)
                            : ({
                                pointerEvents: 'auto',
                                '--dsl-button-opacity-disabled': 1,
                              } as React.CSSProperties)
                        }
                      >
                        <div className="ds-button__background" />
                        <div className="ds-button__icon">
                          {copyState === 'copied' ? <CheckIcon size={14} /> : <CopyIcon size={16} />}
                        </div>
                        <span className="ds-button__content">
                          {copyState === 'copied' ? 'Скопировано' : 'Копировать'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div data-focus-guard="true" tabIndex={0} style={{ width: 1, height: 0, padding: 0, overflow: 'hidden', position: 'fixed', top: 1, left: 1 }} />
        </div>
      </div>
    </>
  );
};

export default GatewayShareModal;