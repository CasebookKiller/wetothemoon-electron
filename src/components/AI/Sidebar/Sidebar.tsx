import React from 'react';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { ChatState, Conversation, ModelSettings, Tag } from '../../../shared/types/chat';
import './Sidebar.css';
import { ModelSettingsPanel } from '../ModelSettingsPanel/ModelSettingsPanel';
import { ConversationPanel } from '../ConversationPanel/ConversationPanel';
import TagManager from '../TagManager/TagManager';

interface SidebarProps {
  settings: ModelSettings;
  onSettingsChange: (newSettings: Partial<ModelSettings>) => void;
  conversations: Record<string, Conversation>;
  currentConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
  onTitleChange: (conversationId: string, newTitle: string) => void;
  setChatState: React.Dispatch<React.SetStateAction<ChatState>>; // Добавляем
  saveChatState: () => void; // Добавляем
  className?: string;
  handleTagsUpdate: (conversationId: string, tags: Tag[]) => void;
}


const Sidebar: React.FC<SidebarProps> = ({
  settings,
  onSettingsChange,
  className,
  conversations,
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  onTitleChange,
  setChatState, // Добавляем
  saveChatState,
  handleTagsUpdate
}) => {
  console.log('Sidebar props:', { currentConversationId });
  const handleResetToDefaults = () => {
    onSettingsChange({
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      maxTokens: 4000,
      topK: 40,
      contextLength: 4096,
      model: 't-tech/T-lite-it-2.1:q4_K_M'
    });
  };

  const handleSaveSettings = () => {
    localStorage.setItem('ai-model-settings', JSON.stringify(settings));
  };

  return (
    <div className={`p-2 border-right-1 surface-border ${className} sidebar-with-scroll`}>
      <div id="pr_info_1" className="p-accordion p-component" data-pc-name="accordion" data-pc-section="root">
        {/* Статистика диалога */}
        <div className="p-accordion-tab p-accordion-tab-active"
          data-pc-name=""
          data-pc-section="root"
        >
          <div className="p-accordion-header p-highlight"
            data-p-highlight="true"
            data-p-disabled="false"
            data-pc-section="header"
          >
            <a id="pr_info_1_header_0"
              href="#pr_info_1_content_0"
              className="p-accordion-header-link" 
              role="button"
              tabIndex={0}
              aria-disabled="false"
              aria-controls="pr_info_1_content_0"
              aria-expanded="true"
              data-pc-section="headeraction"
            >
              <div style={{width: '14px', height: '14px'}}></div>
              <span className="p-accordion-header-text" data-pc-section="headertitle">
                <span className="text-base">Статистика диалога</span>
              </span>
            </a>
          </div>
          {/* Управление тэгов */}
          <div 
            id="pr_info_2_content_0"
            className="p-toggleable-content p-toggleable-content-enter-done"
            role="region"
            aria-labelledby="pr_info_2_header_0"
            data-pc-section="toggleablecontent"
          >
            <div className="p-accordion-content" data-pc-section="content">
              {currentConversationId && conversations[currentConversationId] && (<div className="conversation-stats p-3">
                <div className="text-sm">Всего ответов: {conversations[currentConversationId].messages.filter(m => m.sender === 'assistant').length}</div>
                <div className="text-sm">Общее время ответов: {((conversations[currentConversationId].totalResponseTimeMs || 0) / 1000).toFixed(1)} с</div>
              </div>)}
            </div>
          </div>
        </div>
        <div className="p-accordion-tab p-accordion-tab-active"
          data-pc-name=""
          data-pc-section="root"
        >
          <div className="p-accordion-header p-highlight"
            data-p-highlight="true"
            data-p-disabled="false"
            data-pc-section="header"
          >
            <a
              id="pr_info_2_header_0"
              href="#pr_info_2_content_0"
              className="p-accordion-header-link"
              role="button"
              tabIndex={0}
              aria-disabled="false"
              aria-controls="pr_info_2_content_0"
              aria-expanded="true"
              data-pc-section="headeraction"
            >
              <div style={{width: '14px', height: '14px'}}></div>
              <span className="p-accordion-header-text" data-pc-section="headertitle">
                <span className="text-base">Управление тегами</span>
              </span>
            </a>
          </div>
          <div id="pr_info_2_content_0"
            className="p-toggleable-content"
            role="region"
            aria-labelledby="pr_info_2_header_0"
            data-pc-section="toggleablecontent"
          >
            <div className="p-accordion-content" data-pc-section="content">
              {currentConversationId && conversations[currentConversationId] && (
                <TagManager
                  conversation={conversations[currentConversationId]}
                  onTagsChange={(tags) => {
                    handleTagsUpdate(currentConversationId, tags);
                  }}
                />
              )}
              {!currentConversationId && (
                <div className="p-3 text-center text-500">
                  Выберите диалог для управления тегами
                </div>
              )}    
            </div>
          </div>
        </div>
      </div>
      <Accordion activeIndex={0}>

        {/* Статистика диалога */}
        {/*<AccordionTab header={<span className='text-base'>Статистика диалога</span>}>
          {currentConversationId && conversations[currentConversationId] && (
            <div className='conversation-stats p-3'>
              <div className='text-sm'>Всего ответов: {conversations[currentConversationId].messages.filter(m => m.sender === 'assistant').length}</div>
              <div className='text-sm'>Общее время ответов: {((conversations[currentConversationId].totalResponseTimeMs || 0) / 1000).toFixed(1)} с</div>
            </div>
          )}
        </AccordionTab>*/}

        {/* Управление тэгов */}
        {/*<AccordionTab header={<span className='text-base'>Управление тегами</span>}>
          {currentConversationId && conversations[currentConversationId] && (
            <TagManager
              conversation={conversations[currentConversationId]}
              onTagsChange={(tags) => {
                handleTagsUpdate(currentConversationId, tags);
              }}
            />
          )}
          {!currentConversationId && (
            <div className="p-3 text-center text-500">
              Выберите диалог для управления тегами
            </div>
          )}
        </AccordionTab>*/}

        {/* Раздел истории диалогов */}
        <AccordionTab header={<span className='text-base'>История диалогов</span>}>
          <ConversationPanel
            conversations={conversations}
            currentConversationId={currentConversationId}
            onConversationSelect={onConversationSelect}
            onTitleChange={onTitleChange}
            onNewConversation={onNewConversation}
            setChatState={setChatState} // Передаём дальше
            saveChatState={saveChatState} // Передаём дальше
            
          />
        </AccordionTab>

        {/* Раздел настроек модели */}
        <AccordionTab
          header={<span className='text-base'>Настройки модели</span>}

        >
          <ModelSettingsPanel
            settings={settings}
            onSettingsChange={onSettingsChange} extended={settings.extended || false}
          />
          <div className="flex gap-2">
            <button
              className="p-button p-button-secondary w-full justify-content-center"
              onClick={handleResetToDefaults}
            >
              Сбросить
            </button>
            <button
              className="p-button p-button-accent w-full justify-content-center"
              onClick={handleSaveSettings}
            >
              Сохранить
            </button>
          </div>
        </AccordionTab>


      </Accordion>
    </div>
  );
};

export default Sidebar;
