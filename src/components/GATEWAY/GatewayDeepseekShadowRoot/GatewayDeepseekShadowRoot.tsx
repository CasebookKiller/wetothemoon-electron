// src/components/GATEWAY/GatewayDeepseekShadowRoot/GatewayDeepseekShadowRoot.tsx

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Импортируем CSS как сырые строки (raw) через Vite
import mainCss from '@/themes/deepseek-theme/main.css?raw';
import katexCss from '@/themes/deepseek-theme/katex.css?raw';
import gatewayPageCss from '@/pages/GatewayPage/GatewayPage.css?raw';

interface GatewayDeepseekShadowRootProps {
  children: React.ReactNode;
}

const GatewayDeepseekShadowRoot: React.FC<GatewayDeepseekShadowRootProps> = ({ children }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // 1. Прикрепляем shadow root
    const shadow = host.attachShadow({ mode: 'open' });

    // 2. Подготавливаем CSS: заменяем глобальные селекторы
    const combinedCss = mainCss + '\n' + katexCss + '\n' + gatewayPageCss;
    const processedCss = combinedCss
      .replace(/:root/g, ':host')          // :root -> :host
      .replace(/body\b/g, '.gateway-deepseek-root'); // body -> .gateway-deepseek-root

    // 3. Создаём <style> внутри shadow root
    const style = document.createElement('style');
    const css = `
      :host {
        all: initial;
        display: block;
        flex: 1;
        min-width: 0;
        height: 100%;
      }
      .gateway-deepseek-root {
        all: initial;
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        overflow: hidden;
      }
      ${processedCss}`;

      const cssPlus = `


      /* Восстанавливаем flex-раскладку сообщений */
      ._4f9bf79,
      ._9663006 {
        /*display: flex !important;
        align-items: flex-start !important;*/
        gap: 8px !important;
      }

      /* Убираем возможный сдвиг текста при выборе */
      .ds-message._6e8caf5._7729a77 {
        padding-left: 0 !important;
        margin-left: 0 !important;
      }

      /* Подсветка выбранного сообщения */
      .ds-message._7729a77 {
        position: relative;
      }
      .ds-message._7729a77::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: calc(100% + 32px);
        height: calc(100% + 40px);
        border-radius: 12px;
        background-color: transparent;
        pointer-events: none;
        /*transition: background-color 0.01s ease;*/
        z-index: 0;
      }
      .ds-message._7729a77._6e8caf5::before {
        background-color: #212123; /* фон выделения */
      }

      /* Контент поверх псевдоэлемента */
      .ds-message._7729a77 > * {
        position: relative;
        z-index: 1;
      }

      

      /* Кнопка в неактивном состоянии (disabled) */
.ds-button--disabled {
  pointer-events: none !important;
  opacity: 0.5 !important;
  background-color: var(--dsw-alias-bg-secondary, #2a2a2e) !important;
  color: var(--dsw-alias-text-disabled, #777) !important;
  border-color: transparent !important;
}

/* Возвращаем синий фон для активной primary-кнопки */
.ds-button--primary.ds-button--filled:not(.ds-button--disabled) {
  background-color: var(--dsw-alias-brand-primary, #005fd0) !important;
  color: #fff !important;
}
      

/* Позиционирование кнопки сворачивания/разворачивания */
.fbb737a4 {
  position: relative !important;
}

.ds-collapsible-text-toggle-button._5b3c8cd {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 30px !important;
  pointer-events: none !important; /* чтобы не мешать выделению текста */
}

.d077096d {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

._08f18f6 {
  pointer-events: all !important;
  background: var(--dsw-alias-bg-layer-3);
  cursor: pointer;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-inverted);
  border-radius: 100px;
  justify-content: center;
  align-items: center;
  width: 30px;
  height: 20px;
  display: flex;
  position: absolute;
  bottom: 10px;
  right: 10px;
}

.ds-copyable-text-line {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.ds-copyable-text-line__scroll {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
}
.ds-copyable-text-line__action {
  position: relative;
  flex-shrink: 0;
}
.ds-copyable-text-line__mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to left, rgba(42,42,46,0), rgba(42,42,46,1));
  border-radius: 100px;
}


      `;

      const cssPlus2 = `

/* Прозрачность только для заголовка размышления, не затрагивая синюю точку */
.ds-message._7729a77._6e8caf5 ._74c0879,
.ds-message._7729a77._6e8caf5 ._245c867,
.ds-message._7729a77._6e8caf5 ._5ab5d64,
.ds-message._7729a77._6e8caf5 ._5255ff8,
.ds-message._7729a77._6e8caf5 ._970ac5e {
  background-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
}




/* Гарантированная прозрачность всего выбранного сообщения */
.ds-message._7729a77._6e8caf5,
.ds-message._7729a77._6e8caf5 *,
.ds-message._7729a77._6e8caf5 *::before,
.ds-message._7729a77._6e8caf5 *::after {
  background-color: transparent !important;
  background-image: none !important;
  background: transparent !important;
  box-shadow: none !important;
  border-color: transparent !important;
  border: none !important;
}

/* Гарантированно убираем фон у выбранного сообщения и всех его потомков */
.ds-message._7729a77._6e8caf5,
.ds-message._7729a77._6e8caf5 *,
.ds-message._7729a77._6e8caf5 *::before,
.ds-message._7729a77._6e8caf5 *::after {
  background-color: transparent !important;
  background-image: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* Убираем фон у псевдоэлемента заголовка при выборе */
._245c867:after {
  background-color: transparent !important;
}




    `;

    style.textContent = css + cssPlus //+ cssPlus2;
    shadow.appendChild(style);

    // 4. Создаём корневой контейнер для содержимого
    const container = document.createElement('div');
    container.className = 'gateway-deepseek-root dark';
    container.setAttribute('data-ds-dark-theme', 'dark');
    shadow.appendChild(container);

    setPortalContainer(container);
  }, []);

  return (
    <div ref={hostRef} style={{ flex: 1, minWidth: 0, display: 'flex' }}>
      {portalContainer && createPortal(children, portalContainer)}
    </div>
  );
};

export default GatewayDeepseekShadowRoot;