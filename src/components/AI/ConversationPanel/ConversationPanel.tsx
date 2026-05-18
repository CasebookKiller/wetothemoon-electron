// components/AI/ConversationPanel/ConversationPanel.tsx
import React, { useState } from 'react';
import { ChatState, Conversation } from '../../../shared/types/chat';
import ConversationTitleEditor from '../ConversationTitleEditor/ConversationTitleEditor';

import './ConversationPanel.css';

interface ConversationPanelProps {
  conversations: Record<string, Conversation>;
  currentConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
  onTitleChange: (conversationId: string, newTitle: string) => void;
  setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
  saveChatState: () => void;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversations,
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  onTitleChange
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  console.log('ConversationPanel render:', {
    currentConversationId,
    conversationsCount: Object.keys(conversations).length
  });

  return (
    <div className="conversation-panel">
      <button
        className="p-button p-button-accent w-full mb-3"
        onClick={onNewConversation}
      >
        Новый диалог
      </button>

      <div className="conversation-list">
        {Object.values(conversations)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(conv => {
            // Явно проверяем равенство ID
            const isCurrent = conv.id === currentConversationId;

            return (
              <div
                key={conv.id}
                className={`conversation-item p-2 border-round mb-2 ${
                  isCurrent ? 'surface-highlight font-bold' : 'surface-overlay'
                }`}
                onClick={() => onConversationSelect(conv.id)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ConversationTitleEditor
                  conversation={conv}
                  onTitleChange={(newTitle) => onTitleChange(conv.id, newTitle)}
                  isEditing={editingId === conv.id}
                  setIsEditing={(isEditing) =>
                    setEditingId(isEditing ? conv.id : null)
                  }
                />
                <div className="text-200 text-xs mt-1 ml-2">
                  Обновлено: {new Date(conv.updatedAt).toLocaleDateString()}
                </div>
                {/* Отображение тегов */}
                {conv.tags && conv.tags.length > 0 && (
                  <div className="tags-preview flex flex-wrap gap-1 mt-1">
                    {conv.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag.id}
                        className="tag-badge p-1 border-round text-xs"
                        style={{ backgroundColor: 'transparent', color: tag.color, border: `1px solid ${tag.color}` }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {conv.tags.length > 3 && (
                      <span className="text-xs text-500">
                        +{conv.tags.length - 3} ещё
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};