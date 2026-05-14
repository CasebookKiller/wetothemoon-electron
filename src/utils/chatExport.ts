import { Conversation, SavedConversation } from '../types/chat';

export const exportConversationToFile = (conversation: Conversation) => {
  try {
    const exportData: SavedConversation = {
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${conversation.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Ошибка экспорта в файл:', error);
  }
};

export const exportAllConversationsToFile = (conversations: Record<string, Conversation>) => {
  try {
    const exportData: Record<string, SavedConversation> = Object.fromEntries(
      Object.entries(conversations).map(([id, conv]) => [
        id,
        {
          ...conv,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString()
        }
      ])
    );
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-chats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Ошибка экспорта всех диалогов:', error);
  }
};
