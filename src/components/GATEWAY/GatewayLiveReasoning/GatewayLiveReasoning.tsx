// src/components/GATEWAY/GatewayLiveReasoning/GatewayLiveReasoning.tsx

import './GatewayLiveReasoning.css';
import React, { useState } from 'react';
import { BrainIcon, ChevronIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';

interface GatewayLiveReasoningProps {
  text: string;
}

/**
 * Блок «Размышление…», который показывается, пока reasoning идёт.
 * Структура соответствует оригинальному ._74c0879 + ._245c867 + .e1675d8b,
 * чтобы стили из main.css применились как в обычном сообщении.
 */
export const GatewayLiveReasoning: React.FC<GatewayLiveReasoningProps> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="_4f9bf79 d7dc56a8 _43c05b5" data-virtual-list-item-key="assistant">
      <div className="ds-message _63c77b1">
        <div className="_74c0879">
          <div
            className="_245c867"
            role="button"
            tabIndex={0}
            onClick={() => setExpanded((prev) => !prev)}
          >
            <div className="_5ab5d64">
              <div className="ds-icon _970ac5e" style={{ fontSize: 16, width: 16, height: 16 }}>
                <BrainIcon size={16} />
              </div>
              <span className="_5255ff8 _4d41763 gateway-live-reasoning__title">
                Размышление
                <span className="gateway-live-reasoning__dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </span>
              <div className="ds-icon" style={{ fontSize: 14, width: 14, height: 14 }}>
                <ChevronIcon size={14} expanded={expanded} />
              </div>
            </div>
          </div>

          {expanded && (
            <div className="e1675d8b ds-think-content _767406f">
              <div className="ddd26891 _9b52f6c" style={{ width: 16, height: 16 }}>
                <div className="a510c7ce _0652043" />
              </div>
              <div className="_9ecc93a" />
              <div className="ds-markdown">
                <p className="ds-markdown-paragraph">{text || '…'}</p>
              </div>
            </div>
          )}

          <div className="c2b72bb8" />
        </div>
      </div>
    </div>
  );
};