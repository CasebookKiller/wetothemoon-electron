import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { PromptTemplate } from '@/types/promptgenerator';

interface TemplateSelectorDialogProps {
  visible: boolean;
  templates: PromptTemplate[];
  selectedTemplateId: string | null;
  onSelect: (templateId: string) => void;
  onCreateNew: () => void;
  onDelete: (templateId: string) => void; // Новый пропс
  onHide: () => void;
}

export const TemplateSelectorDialog: React.FC<TemplateSelectorDialogProps> = ({
  visible,
  templates,
  selectedTemplateId,
  onSelect,
  onCreateNew,
  onDelete, // Добавляем пропс
  onHide
}) => {
  const handleTemplateSelect = (templateId: string) => {
    onSelect(templateId);
  };

  const handleDeleteTemplate = (templateId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Останавливаем всплытие события клика

    if (window.confirm(`Вы уверены, что хотите удалить шаблон "${templates.find(t => t.id === templateId)?.title}"?`)) {
      onDelete(templateId);
    }
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Выбор шаблона промта"
      style={{ width: '50vw' }}
      maximized
      modal
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '10px',
          maxHeight: '90%',
          overflowY: 'auto'
        }}>
          {templates.map((template) => (
            <div
              key={template.id}
              style={{
                padding: '15px',
                border: selectedTemplateId === template.id
                  ? '2px solid var(--tg-theme-accent-text-color)'
                  : '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: selectedTemplateId === template.id ? 'var(--tg-theme-bg-color)' : 'transparent',
                position: 'relative' // Для позиционирования кнопки удаления
              }}
              onClick={() => handleTemplateSelect(template.id)}
            >
              {/* Кнопка удаления в правом верхнем углу */}
              <Button
                icon="pi pi-times"
                className="p-button-text p-button-sm p-1"
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  color: 'var(--tg-theme-accent-text-color)',
                  backgroundColor: 'transparent',
                  width: '24px',
                }}
                onClick={(e) => handleDeleteTemplate(template.id, e)}
                aria-label="Удалить шаблон"
              />

              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                {template.title}
              </h4>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                {template.description?.substring(0, 100)}
                {template.description && template.description.length > 100 && '...'}
              </p>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <span style={{
                  fontSize: '12px',
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  borderRadius: '4px'
                }}>
                  v{template.version}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: '#9ca3af'
                }}>
                  Обновлено: {template.updatedAt}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <Button
            label="Новый шаблон"
            icon="pi pi-plus"
            onClick={onCreateNew}
            className="p-button-accent"
          />
          <div>
            <Button
              label="Отмена"
              onClick={onHide}
              className="p-button-hint"
              style={{ marginRight: '10px' }}
            />
            <Button
              label="Выбрать"
              icon="pi pi-check"
              onClick={() => {
                if (selectedTemplateId) {
                  onSelect(selectedTemplateId);
                  onHide();
                }
              }}
              disabled={!selectedTemplateId}
              className="p-button-accent"
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

/*import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { PromptTemplate } from '@/types/promptgenerator';

interface TemplateSelectorDialogProps {
  visible: boolean;
  templates: PromptTemplate[];
  selectedTemplateId: string | null;
  onSelect: (templateId: string) => void;
  onCreateNew: () => void;
  onHide: () => void;
}

export const TemplateSelectorDialog: React.FC<TemplateSelectorDialogProps> = ({
  visible,
  templates,
  selectedTemplateId,
  onSelect,
  onCreateNew,
  onHide
}) => {
  const handleTemplateSelect = (templateId: string) => {
    onSelect(templateId);
    //onHide();
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Выбор шаблона промта"
      style={{ width: '50vw' }}
      maximized
      modal
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '10px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {templates.map((template) => (
            <div
              key={template.id}
              style={{
                padding: '15px',
                border: selectedTemplateId === template.id
                  ? '2px solid var(--tg-theme-accent-text-color)'
                  : '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: selectedTemplateId === template.id ? 'var(--tg-theme-bg-color)': 'transparent',
              }}
              onClick={() => handleTemplateSelect(template.id)}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                {template.title}
              </h4>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                {template.description?.substring(0, 100)}
                {template.description && template.description.length > 100 && '...'}
              </p>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <span style={{
                  fontSize: '12px',
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  borderRadius: '4px'
                }}>
                  v{template.version}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: '#9ca3af'
                }}>
                  Обновлено: {template.updatedAt}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <Button
            label="Новый шаблон"
            icon="pi pi-plus"
            onClick={onCreateNew}
            className="p-button-accent"
          />
          <div>
            <Button
              label="Отмена"
              onClick={onHide}
              className="p-button-hint"
              style={{ marginRight: '10px' }}
            />
            <Button
              label="Выбрать"
              icon="pi pi-check"
              onClick={() => {
                if (selectedTemplateId) {
                  onSelect(selectedTemplateId);
                  onHide();
                }
              }}
              disabled={!selectedTemplateId}
              className="p-button-accent"
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
*/