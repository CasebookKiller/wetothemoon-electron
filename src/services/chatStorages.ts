import { ChatSession, Message } from '../types/chat';

class ChatStorageService {
  private readonly STORAGE_KEY = 'chat_sessions';
  private autosaveTimer: NodeJS.Timeout | null = null;

  saveSession(session: ChatSession): void {
    const sessions = this.getSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    if (existingIndex !== -1) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
  }

  getSessions(): ChatSession[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];

    try {
      return (typeof stored === 'string'? JSON.parse(stored): stored).map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt)
      }));
    } catch {
      return [];
    }
  }

  startAutosave(session: ChatSession, interval: number = 30000): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);

    this.autosaveTimer = setTimeout(() => {
      this.saveSession(session);
      console.log('Автосохранение сессии:', session.title);
    }, interval);
  }

  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  searchSessions(query: string): ChatSession[] {
    const lowerQuery = query.toLowerCase();
    return this.getSessions().filter(session =>
      session.title.toLowerCase().includes(lowerQuery) ||
      session.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      session.messages.some(msg =>
        msg.text.toLowerCase().includes(lowerQuery)
      )
    );
  }

  exportSessionToJSON(session: ChatSession): string {
    return JSON.stringify(session, null, 2);
  }

  exportSessionToTXT(session: ChatSession): string {
    return session.messages.map(msg =>
      `${msg.sender === 'user' ? 'Вы' : 'Ассистент'} (${msg.timestamp.toLocaleTimeString()}):\n${msg.text}\n\n`
    ).join('');
  }
}

export default new ChatStorageService();