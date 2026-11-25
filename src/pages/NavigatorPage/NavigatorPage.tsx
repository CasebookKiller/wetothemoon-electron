// src/pages/NavigatorPage/NavigatorPage.tsx

/**
 * NavigatorPage — корневая страница модуля Navigator.
 *
 * Layout: sidebar (GigaChat-профили) + chat (стрим).
 * Тема — neon cyan #00e5ff, активируется через `data-module="navigator"` (theme.css).
 *
 * @module pages/NavigatorPage
 */

import React, { useCallback, useEffect, useState } from 'react';
import { NavigatorSidebar } from './NavigatorSidebar';
import { NavigatorChat } from './NavigatorChat';

import './NavigatorPage.css';
// Prism CSS — подсветка кода в чате (GigaChat отдаёт уже подсвеченный HTML с токенами).
// Тема tomorrow — тёмная, совместима с neon cyan. Не конфликтует с Gateway:
// Gateway использует свои стили, а токены `.token` глобальны — но в Gateway
// подсветка рендерится через свой CSS, и наши стили там просто не сработают
// (у Gateway-компонентов нет класса .navigator-markdown).
import 'prismjs/themes/prism-tomorrow.css';

export const NavigatorPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);

  // Обновляем имя профиля при смене selection (для шапки чата).
  useEffect(() => {
    let cancelled = false;
    const api = (window as any).electronAPI;
    if (!selectedId || !api?.gatewayProfilesList) { setProfileName(''); return; }
    api.gatewayProfilesList().then((r: any) => {
      if (cancelled || !r?.success) return;
      const found = (r.data?.profiles ?? []).find((p: any) => p.id === selectedId);
      setProfileName(found?.name ?? '');
    }).catch(() => { if (!cancelled) setProfileName(''); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  return (
    <div
      data-module="navigator"
      style={{
        height: '100vh', width: '100%',
        display: 'flex', overflow: 'hidden',
        background: '#0f1419', color: '#f5f5f5',
      }}
    >
      <NavigatorSidebar
        selectedId={selectedId}
        onSelect={(id) => { setSelectedConversationId(null); handleSelect(id); }}
        selectedConversationId={selectedConversationId}
        onSelectConversation={(convId) => {
          // Синхронизацию делает Sidebar (единственный источник). Page только:
          // 1) выбирает диалог, 2) ремаунтит Chat для перечитывания БД.
          // Раньше Page дублировал syncMessages — 3 вызова на клик, race → порча данных.
          setSelectedConversationId(convId);
          setChatKey((k) => k + 1);
        }}
      />
      <NavigatorChat
        key={chatKey}
        profileId={selectedId || null}
        profileName={profileName}
        conversationId={selectedConversationId}
      />
    </div>
  );
};

export default NavigatorPage;