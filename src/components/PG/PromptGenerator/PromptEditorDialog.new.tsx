import React, { useEffect, useState, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { BasicInfoSection } from './BasicInfoSection';
import { RoleSection } from './RoleSection';
import { ProjectContextSection } from './ProjectContextSection';
import { TaskAndExpectationsSection } from './TaskAndExpectationsSection';
import { TechnicalRequirementsSection } from './TechnicalRequirementsSection';
import { ResponseStructureSection } from './ResponseStructureSection';
import { SpecialScenariosSection } from './SpecialScenariosSection';
import { RestrictionsAndRulesSection } from './RestrictionsAndRulesSection';
import { AdditionalPreferencesSection } from './AdditionalPreferencesSection';
import { CodeContextSection } from './CodeContextSection';
import { DevelopmentContextSection } from './DevelopmentContextSection';
import { PromptTemplate, TreeNode } from '@/types/promptgenerator';
import { PackageJson } from '@/types/types';

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
  projectTree,
}) => {
  const [localTemplate, setLocalTemplate] = useState<PromptTemplate>(template);
  const [activeIndex, setActiveIndex] = useState<number[]>([]);
  const accordionRef = useRef<Accordion>(null);

  useEffect(() => {
    if (localTemplate.id !== template.id) {
      setLocalTemplate(template);
    }
  }, [template.id]);

  const handleUpdate = (updates: Partial<PromptTemplate>) => {
    const updatedTemplate = {
      ...localTemplate,
      ...updates,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setLocalTemplate(updatedTemplate);
  };

  const handleSave = () => {
    onSave(localTemplate);
    onHide();
  };

  const expandAll = () => {
    const allIndexes = Array.from({ length: 11 }, (_, i) => i);
    setActiveIndex(allIndexes);
  };

  const collapseAll = () => {
    setActiveIndex([]);
  };

  const sections = [
    {
      header: 'Основная информация',
      component: BasicInfoSection,
      props: { packageJson },
    },
    {
      header: 'Роль',
      component: RoleSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Контекст проекта',
      component: ProjectContextSection,
      props: { packageJson, configFiles, projectTree },
    },
    {
      header: 'Задача и ожидания',
      component: TaskAndExpectationsSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Технические требования',
      component: TechnicalRequirementsSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Структура ответа',
      component: ResponseStructureSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Специальные сценарии',
      component: SpecialScenariosSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Ограничения и правила',
      component: RestrictionsAndRulesSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Дополнительные предпочтения',
      component: AdditionalPreferencesSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Контекст кода',
      component: CodeContextSection,
      props: { packageJson, configFiles },
    },
    {
      header: 'Контекст разработки',
      component: DevelopmentContextSection,
      props: { packageJson, configFiles, projectTree },
    },
  ];

  // Функция для получения заголовка с toggle
  const getHeaderTemplate = (sectionTitle: string, index: number) => {
    // Определяем, какое поле отвечает за enabled для данной секции
    const enabledFieldMap: Record<string, keyof PromptTemplate> = {
      'Основная информация': 'role', // на самом деле BasicInfo не имеет enabled, но он всегда виден, поэтому toggle можно не показывать
      'Роль': 'role',
      'Контекст проекта': 'projectContext',
      'Задача и ожидания': 'taskAndExpectations',
      'Технические требования': 'technicalRequirements',
      'Структура ответа': 'responseStructure',
      'Специальные сценарии': 'specialScenarios',
      'Ограничения и правила': 'restrictionsAndRules',
      'Дополнительные предпочтения': 'additionalPreferences',
      'Контекст кода': 'codeContext',
      'Контекст разработки': 'developmentContext',
    };

    const field = enabledFieldMap[sectionTitle];
    // Для BasicInfo не показываем toggle
    if (sectionTitle === 'Основная информация') {
      return <span className="font-medium">{sectionTitle}</span>;
    }

    // Получаем значение enabled из localTemplate
    const enabled = field ? (localTemplate as any)[field]?.enabled : true;

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
        onClick={(e) => e.stopPropagation()} // предотвращаем сворачивание при клике на toggle
      >
        <span className="font-medium">{sectionTitle}</span>
        <div style={{ minWidth: '100px' }} onClick={(e) => e.stopPropagation()}>
          {/* При клике на toggle не даём событию всплыть, чтобы не переключался аккордеон */}
          <Button
            label={enabled ? 'Выкл.' : 'Вкл.'}
            className={`p-button-sm ${enabled ? 'p-button-outlined p-button-danger' : 'p-button-outlined'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (field) {
                const current = (localTemplate as any)[field];
                handleUpdate({
                  [field]: {
                    ...current,
                    enabled: !enabled,
                  },
                });
              }
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Редактирование промпта"
      style={{ width: '90vw', maxWidth: '1200px' }}
      maximized
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
        {/* Панель управления */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', gap: '8px' }}>
          <Button
            label="Развернуть всё"
            icon="pi pi-angle-double-down"
            onClick={expandAll}
            className="p-button-sm p-button-outlined"
          />
          <Button
            label="Свернуть всё"
            icon="pi pi-angle-double-up"
            onClick={collapseAll}
            className="p-button-sm p-button-outlined"
          />
        </div>

        {/* Аккордеон с секциями */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          <Accordion
            ref={accordionRef}
            multiple
            activeIndex={activeIndex}
            onTabChange={(e) => setActiveIndex(Array.isArray(e.index) ? e.index : [e.index])}
          >
            {sections.map((section, index) => (
              <AccordionTab
                key={index}
                header={getHeaderTemplate(section.header, index)}
                headerStyle={{ padding: '0.8rem 1rem' }}
              >
                <section.component
                  template={localTemplate}
                  onUpdate={handleUpdate}
                  {...section.props}
                />
              </AccordionTab>
            ))}
          </Accordion>
        </div>

        {/* Нижняя панель */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid #e9e9e9',
            flexShrink: 0,
          }}
        >
          <Button label="Отмена" icon="pi pi-times" onClick={onHide} className="p-button-hint" />
          <Button
            label="Сохранить"
            icon="pi pi-check"
            onClick={handleSave}
            className="p-button-accent"
            disabled={localTemplate.id === 'web-app-dev-001'}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default PromptEditorDialog;