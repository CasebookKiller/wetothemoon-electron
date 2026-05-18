// components/AI/ConversationTitleEditor/ConversationTitleEditor.tsx
import React, { useState, useEffect } from 'react';
import { Conversation } from '../../../shared/types/chat';

import './ConversationTitleEditor.css';

interface ConversationTitleEditorProps {
  conversation: Conversation;
  onTitleChange: (newTitle: string) => void;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

const ConversationTitleEditor: React.FC<ConversationTitleEditorProps> = ({
  conversation,
  onTitleChange,
  isEditing,
  setIsEditing
}) => {
  const [editedTitle, setEditedTitle] = useState(conversation.title);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedTitle(conversation.title);
    setHasChanges(false); // Сбрасываем флаг при обновлении пропсов
  }, [conversation.title]);

  const handleSave = () => {
    // Проверяем, что есть изменения и введённое название не пустое
    if (hasChanges && editedTitle.trim()) {
      onTitleChange(editedTitle.trim());
    }
    // Всегда выходим из режима редактирования
    setIsEditing(false);
    setHasChanges(false); // Сбрасываем флаг после сохранения
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(conversation.title);
      setHasChanges(false);
      setIsEditing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setEditedTitle(newValue);
    // Устанавливаем флаг, если значение отличается от оригинального
    setHasChanges(newValue.trim() !== conversation.title.trim());
  };

  if (!isEditing) {
    return (
      <div
        className="conversation-title"
        onClick={() => setIsEditing(true)}
        style={{ cursor: 'pointer' }}
      >
        {conversation.title}
      </div>
    );
  }

  return (
    <input
      type="text"
      value={editedTitle}
      onChange={handleChange} // Используем новый обработчик
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      className="p-inputtext w-full"
      placeholder="Введите название диалога"
      autoFocus
    />
  );
};

export default ConversationTitleEditor;
