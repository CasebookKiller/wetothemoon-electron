// src/components/GATEWAY/GatewaySelectionPreview/GatewaySelectionPreview.tsx

import React from 'react';

interface GatewaySelectionPreviewProps {
  messages: { role: 'user' | 'assistant'; blocks: { type: 'text' | 'code'; content: string; language?: string }[] }[];
  selectedIndices: Set<number>;
}

export const GatewaySelectionPreview: React.FC<GatewaySelectionPreviewProps> = ({
  messages,
  selectedIndices,
}) => {
  // Формируем массив выбранных сообщений в порядке индексов
  const selectedMessages = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map((idx) => messages[idx])
    .filter(Boolean);

  return (
    <div className="_189b4a0" style={{ '--scroll-nav-page-padding': '15px 0px 15px 24px' } as React.CSSProperties}>
      <div className="_6ffc3c9" />
      <div className="_4ce999d _42b9b3d ds-scroll-area ds-scroll-area--enabled">
        <div className="ds-scroll-area__gutters" style={{ '--dsl-scroll-area-gutters-disappear-delay': '0', '--container-height': '120px', position: 'sticky', top: '0px', left: '0px', right: '0px', width: '100%', height: '0px' } as React.CSSProperties}>
          <div className="ds-scroll-area__horizontal-gutter" style={{ left: '2px', right: '2px', display: 'block', top: 'calc(var(--container-height) - 8px)', height: '6px' }}>
            <div className="ds-scroll-area__horizontal-bar" style={{ display: 'none' }} />
          </div>
          <div className="ds-scroll-area__vertical-gutter" style={{ right: '2px', top: '8px', bottom: 'calc(0px - var(--container-height) + 8px)', width: '6px' }}>
            <div className="ds-scroll-area__vertical-bar" style={{ display: 'none' }} />
          </div>
        </div>
        <div className="ds-virtual-list" tabIndex={0} style={{ '--container-height': '120px', '--dsl-virtual-list-width': '240px' } as React.CSSProperties}>
          <div className="ds-virtual-list-items" style={{ boxSizing: 'content-box', paddingTop: '15px', paddingLeft: '24px', paddingRight: '0px', height: '90px' }}>
            <div className="ds-virtual-list-visible-items" style={{ position: 'relative', transform: 'translateY(0px)', '--dsl-virtual-list-transform-y': '0px', '--dsl-virtual-list-ios-compensation-y': '0px' } as React.CSSProperties}>
              {selectedMessages.map((msg, i) => {
                const text = msg.blocks
                  .filter((b) => b.type === 'text')
                  .map((b) => b.content)
                  .join('\n');
                return (
                  <div className={`_81e7b5e ${i === selectedMessages.length - 1 ? '_19d617c' : ''}`} key={i}>
                    <div className="_72b6158">{text}</div>
                    <div className="ef46fbc6">
                      <div className="fae5876e" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ paddingBottom: '15px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};