import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { BasicInfoSection } from './BasicInfoSection';
import { RoleSection } from './RoleSection';
import { ProjectContextSection } from './ProjectContextSection';
import { TaskAndExpectationsSection } from './TaskAndExpectationsSection';
import { TechnicalRequirementsSection } from './TechnicalRequirementsSection';
import { ResponseStructureSection } from './ResponseStructureSection';
import { SpecialScenariosSection } from './SpecialScenariosSection';
import { RestrictionsAndRulesSection } from './RestrictionsAndRulesSection';
import { AdditionalPreferencesSection } from './AdditionalPreferencesSection';
import { CodeContextSection } from './CodeContextSection'; // новый импорт
import { DevelopmentContextSection } from './DevelopmentContextSection'; // новый импорт
import { PromptTemplate, TreeNode } from '@/shared/types/promptgenerator';
import { PackageJson } from '@/shared/types/types';

interface PromptEditorDialogProps {
  visible: boolean;
  onHide: () => void;
  template: PromptTemplate;
  onSave: (template: PromptTemplate) => void;
  packageJson?: PackageJson | null;
  configFiles?: Record<string, unknown> | null;
  projectTree?: TreeNode[] | null;
}

export const PromptEditorDialog: React.FC<PromptEditorDialogProps> = ({
  visible,
  onHide,
  template,
  onSave,
  packageJson,
  configFiles,
  projectTree
}) => {
  const [localTemplate, setLocalTemplate] = useState<PromptTemplate>(template);

  // Синхронизируем localTemplate с пропсом template при его изменении
  useEffect(() => {
    // Обновляем только если ID отличается (значит, выбран другой шаблон)
    if (localTemplate.id !== template.id) {
      setLocalTemplate(template);
    }
  }, [template.id]); // Зависимость только от ID — меньше рендеров

  const handleUpdate = (updates: Partial<PromptTemplate>) => {
    const updatedTemplate = {
      ...localTemplate,
      ...updates,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    setLocalTemplate(updatedTemplate);
  };

  const handleSave = () => {
    onSave(localTemplate);
    onHide();
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Редактирование промпта"
      style={{ width: '90vw', maxWidth: '1200px' }}
      maximized
    >
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - 150px)' /* можно подобрать под размер диалога */ 
      }}>
        {/* Скроллящаяся область с секциями */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          paddingRight: '8px' /* чтобы контент не прилипал к скроллбару */ 
        }}>
          <BasicInfoSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} />
          <RoleSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <ProjectContextSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles} projectTree={projectTree}/>
          <TaskAndExpectationsSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <TechnicalRequirementsSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <ResponseStructureSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <SpecialScenariosSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <RestrictionsAndRulesSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <AdditionalPreferencesSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <CodeContextSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles}/>
          <DevelopmentContextSection template={localTemplate} onUpdate={handleUpdate} packageJson={packageJson} configFiles={configFiles} projectTree={projectTree}/>
        </div>

        {/* Нижняя панель всегда видна */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #e9e9e9',
          flexShrink: 0
        }}>
          <Button
            label="Отмена"
            icon="pi pi-times"
            onClick={onHide}
            className="p-button-hint"
          />
          <Button
            label="Сохранить"
            icon="pi pi-check"
            onClick={handleSave}
            className="p-button-accent"
            disabled={localTemplate.id === "web-app-dev-001"}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default PromptEditorDialog;