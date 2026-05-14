import { ChatSession, Message } from '../types/chat.ts';

class ChatStorageService {
  private readonly STORAGE_KEY = 'chat_sessions';

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
      return (typeof stored === 'string'? JSON.parse(stored):stored).map((session: ChatSession) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt)
      }));
    } catch {
      return [];
    }
  }

  deleteSession(sessionId: string): void {
    const sessions = this.getSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
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