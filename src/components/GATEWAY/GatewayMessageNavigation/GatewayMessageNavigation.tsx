// src/components/GATEWAY/GatewayMessageNavigation/GatewayMessageNavigation.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface PreviewMessage {
  role: 'user' | 'assistant';
  blocks: Array<{
    type: 'text' | 'code' | 'file';
    content: string;
    language?: string;
  }>;
  thinking?: string;
}

interface GatewayMessageNavigationProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messages: PreviewMessage[];
  isLoading?: boolean;
}

function getPreview(msg: PreviewMessage, maxLen = 80): string {
  if (msg.role === 'assistant' && msg.thinking && msg.blocks.length === 0) {
    return '💭 ' + msg.thinking.replace(/\s+/g, ' ').trim().slice(0, maxLen);
  }

  // 1) Текст имеет приоритет — как в PW
  const textBlocks = msg.blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.content);
  const joined = textBlocks.join(' ').replace(/\s+/g, ' ').trim();
  if (joined) return joined.slice(0, maxLen);

  // 2) Если текста нет — показываем имя первого file-чипа
  //    (для нескольких файлов — имя + счётчик остальных)
  const fileBlocks = msg.blocks.filter((b) => b.type === 'file');
  if (fileBlocks.length > 0) {
    const first = fileBlocks[0].content;
    const suffix = fileBlocks.length > 1 ? ` (+${fileBlocks.length - 1})` : '';
    return `${first}${suffix}`.slice(0, maxLen);
  }

  // 3) Код
  if (msg.blocks.some((b) => b.type === 'code')) return '(code)';

  return '(пусто)';
}

export const GatewayMessageNavigation: React.FC<GatewayMessageNavigationProps> = ({
  scrollContainerRef,
  messages,
  isLoading = false,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(
    Math.max(0, messages.length - 1)
  );
  const [hovered, setHovered] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; top: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const getChildren = useCallback((): HTMLElement[] => {
    const container = scrollContainerRef.current;
    if (!container) return [];
    const inner = container.querySelector(
      '.ds-virtual-list-visible-items'
    ) as HTMLElement | null;
    if (!inner) return [];
    // Берем только те элементы, которые реально отрисованы в DOM
    return Array.from(inner.children) as HTMLElement[];
  }, [scrollContainerRef]);

  const updateActive = useCallback(() => {
    // Если идет загрузка истории — ЖЕСТКО держим маркер на последнем сообщении.
    // Игнорируем любые скроллы и изменения высоты, чтобы не было дерганий.
    if (isLoading) {
      if (messages.length > 0) {
        setActiveIndex(messages.length - 1);
      }
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;
    const children = getChildren();
    if (children.length === 0) return;

    const distanceToBottom = Math.round(container.scrollHeight - container.clientHeight - container.scrollTop);

    // Если мы внизу, всегда ставим последнее сообщение
    if (distanceToBottom < 150) {
      setActiveIndex(messages.length - 1);
      return;
    }

    // 2. Если идет загрузка истории и мы не внизу, не пересчитываем маркер,
    // чтобы избежать дерганий, пока DOM не устоится.
    if (isLoading && distanceToBottom < 300) {
      setActiveIndex(messages.length - 1);
      return;
    }

    // 3. Поиск ближайшего к центру экрана
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let bestIdx = 0;
    let bestDist = Infinity;

    children.forEach((el, i) => {
      const elRect = el.getBoundingClientRect();
      const elCenter = elRect.top + elRect.height / 2;
      const dist = Math.abs(elCenter - containerCenter);
      
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });

    const safeIdx = Math.min(bestIdx, messages.length - 1);
    setActiveIndex(safeIdx);
  }, [scrollContainerRef, getChildren, messages.length, isLoading]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let raf: number | null = null;
    const onScroll = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        updateActive();
      });
    };

    updateActive();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [scrollContainerRef, updateActive]);

  // Обновляем активный индекс при любом изменении сообщений
  useEffect(() => {
    updateActive();
  }, [messages, updateActive]);

  // Прокручиваем список к активному элементу
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(
      '.gateway-message-nav__item--active'
    ) as HTMLElement | null;
    if (!active) return;
    
    const listRect = list.getBoundingClientRect();
    const itemRect = active.getBoundingClientRect();
    
    // Безопасный скролл только внутри списка (не трогает чат)
    if (itemRect.top < listRect.top) {
      list.scrollTop -= (listRect.top - itemRect.top);
    } else if (itemRect.bottom > listRect.bottom) {
      list.scrollTop += (itemRect.bottom - listRect.bottom);
    }
  }, [activeIndex]);

  const handleClick = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const children = getChildren();
    const el = children[index];
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll = container.scrollTop + (elRect.top - containerRect.top);
    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
  };

  if (messages.length < 2) return null;

  return (
    <div
      ref={navRef}
      className={`gateway-message-nav${
        hovered ? ' gateway-message-nav--hovered' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setTooltip(null);
      }}
    >
      {/* Popup — 242×302, при hover выезжает влево, содержит items */}
      <div className="gateway-message-nav__popup">
        <div className="gateway-message-nav__list" ref={listRef}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`gateway-message-nav__item${
                i === activeIndex ? ' gateway-message-nav__item--active' : ''
              }`}
              onClick={() => handleClick(i)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const navRect = navRef.current?.getBoundingClientRect();
                if (navRect) {
                  setTooltip({
                    text: getPreview(msg, 200),
                    top: rect.top - navRect.top + rect.height / 2,
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <div className="gateway-message-nav__preview">
                {getPreview(msg)}
              </div>
              <div className="gateway-message-nav__stripe-wrap">
                <div className="gateway-message-nav__stripe" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Кастомный тултип */}
      {tooltip && (
        <div className="gateway-message-nav__tooltip" style={{ top: tooltip.top }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
};

export default GatewayMessageNavigation;