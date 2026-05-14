import React, { FC } from 'react';

import './AIPage.css';
import AIInterface from '@/components/AI/AIInterface/AIInterface';
import ChatInterface from '@/components/AI/ChatInterface/ChatInterface';
import { ChatSession } from '@/types/chat';
import ChatStorageService from '@/services/chatStorages';

export const AIPage: FC = () => {
  const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
  console.log('AIPage.tsx: electronAPI: ', electronAPI);
  const [lastSession, setLastSession] = React.useState<ChatSession | null>(null);

  React.useEffect(() => {
    const sessions = ChatStorageService.getSessions();
    if (sessions.length > 0) {
      // Загружаем последнюю активную сессию
      const latest = sessions.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      setLastSession(latest);
    }
  }, []);

  return (
    <React.Fragment>
      {/*<div className='AIPage'>AIPage</div>
      <AIInterface/>*/}
      <div className="h-screen">
        <ChatInterface />
      </div>
    </React.Fragment>
    
  );
};