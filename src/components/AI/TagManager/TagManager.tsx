import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Conversation } from '../../../shared/types/chat';

import './TagManager.css';

interface TagManagerProps {
  conversation: Conversation;
  onTagsChange: (tags: Tag[]) => void; // Обработчик изменений тегов
}

const TagManager: React.FC<TagManagerProps> = ({ conversation, onTagsChange }) => {
  const [localTags, setLocalTags] = useState<Tag[]>(conversation.tags || []);
  const [newTagName, setNewTagName] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Функция для уведомления родителя об изменениях
  const notifyParent = useCallback((updatedTags: Tag[]) => {
    onTagsChange(updatedTags);
  }, [onTagsChange]);

  const addTag = useCallback(() => {
    if (!newTagName.trim()) return;

    const newTag: Tag = {
      id: Date.now().toString(),
      name: newTagName.trim(),
      color: getRandomColor()
    };

    setLocalTags(prev => [...prev, newTag]);
    setNewTagName('');
    setIsAddingTag(false);
    notifyParent([...localTags, newTag]); // Уведомляем родителя
  }, [newTagName, localTags, notifyParent]);

  const removeTag = useCallback((tagId: string) => {
    const updatedTags = localTags.filter(tag => tag.id !== tagId);
    setLocalTags(updatedTags);
    notifyParent(updatedTags); // Уведомляем родителя
  }, [localTags, notifyParent]);

  const getRandomColor = (): string => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div className="tag-manager p-2">
      <div className="tags-list flex-wrap gap-2 mb-2">
        {localTags.map(tag => (
          <div
            key={tag.id}
            className="tag-item align-items-center gap-2 p-2 border-round"
            style={{ backgroundColor: 'transparent', color: tag.color, border: `1px solid ${tag.color}` }}
          >
            <span>{tag.name}</span>
            <i
              className="pi pi-times cursor-pointer"
              onClick={() => removeTag(tag.id)}
            />
          </div>
        ))}
      </div>

      {isAddingTag ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            placeholder="Название тега"
            className="p-2 border-round flex-1"
          />
          <button
            onClick={addTag}
            className="p-button p-button-primary"
          >
            Добавить
          </button>
          <button
            onClick={() => setIsAddingTag(false)}
            className="p-button p-button-secondary"
          >
            Отмена
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingTag(true)}
          className="p-button p-button-accent-outlined"
        >
          + Добавить тег
        </button>
      )}
    </div>
  );
};

export default TagManager;
