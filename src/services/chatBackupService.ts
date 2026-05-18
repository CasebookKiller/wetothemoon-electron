import SBase from '../supabaseClient';
import { Conversation } from '../shared/types/chat';

export class ChatBackupService {
  /**
   * Бэкап диалога в Supabase
   * @param conversation Диалог для сохранения
   * @param userId ID пользователя
   */
  static async backupToSupabase(conversation: Conversation, userId: string) {
    try {
      // Подготавливаем данные для сохранения
      const backupData = {
        user_id: userId,
        conversation_id: conversation.id,
        title: conversation.title,
        // Преобразуем данные в JSON-строку (поле data имеет тип text)
        data: JSON.stringify({
          id: conversation.id,
          title: conversation.title,
          messages: conversation.messages.map(msg => {
            // Безопасное преобразование timestamp в Date
            const timestamp = msg.timestamp instanceof Date
              ? msg.timestamp
              : new Date(msg.timestamp);

            return {
              id: msg.id,
              text: msg.text,
              sender: msg.sender,
              timestamp: timestamp.toISOString(),
              isComplete: msg.isComplete,
              responseTimeMs: msg.responseTimeMs
            };
          }),
          // Преобразуем даты в ISO-строки
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString()
        }),
        // created_at заполняется автоматически (DEFAULT now())
      };

      const { data, error } = await SBase
        .from('neuro_chats')
        .insert([backupData])
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка бэкапа в Supabase:', error);
      throw error;
    }
  }

  /**
   * Восстановление диалога из Supabase
   * @param userId ID пользователя
   * @param conversationId ID диалога
   */
  static async restoreFromSupabase(userId: string, conversationId: string) {
    try {
      const { data, error } = await SBase
        .from('neuro_chats')
        .select('data')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Парсим JSON-строку из поля data
      const savedConv = (typeof data[0].data === 'string' ? JSON.parse(data[0].data): data[0].data) as {
        id: string;
        title: string;
        messages: Array<{
          id: string;
          text: string;
          sender: 'user' | 'assistant';
          timestamp: string; // ISO-строка
          codeBlocks?: { language: string; content: string }[];
          isComplete?: boolean;
          responseTimeMs?: number;
        }>;
        createdAt: string; // ISO-строка
        updatedAt: string;  // ISO-строка
      };

      // Восстанавливаем даты из ISO-строк
      return {
        ...savedConv,
        createdAt: new Date(savedConv.createdAt),
        updatedAt: new Date(savedConv.updatedAt),
        messages: savedConv.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      } as Conversation;
    } catch (error) {
      console.error('Ошибка восстановления из Supabase:', error);
      throw error;
    }
  }

  /**
   * Получение списка всех диалогов пользователя
   * @param userId ID пользователя
   */
  static async getUserConversations(userId: string) {
    try {
      const { data, error } = await SBase
        .from('neuro_chats')
        .select('conversation_id, title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка получения списка диалогов:', error);
      throw error;
    }
  }
}
