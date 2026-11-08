// src/components/GATEWAY/GatewayLiveAssistant/GatewayLiveAssistant.tsx

import React from 'react';

interface GatewayLiveAssistantProps {
  html: string;
}

/**
 * Отображает стримящийся ответ ассистента до его полного завершения.
 * Использует ту же структуру классов, что и GatewayMessageAssistant,
 * чтобы стили из main.css применились как в обычном сообщении.
 * Кнопок и футера нет — они появятся в финальном сообщении.
 */
export const GatewayLiveAssistant: React.FC<GatewayLiveAssistantProps> = ({ html }) => {
  return (
    <div
      className="_4f9bf79 d7dc56a8 _43c05b5"
      data-virtual-list-item-key="assistant"
    >
      <div className="ds-message _63c77b1">
        <div
          className="ds-markdown ds-assistant-message-main-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};