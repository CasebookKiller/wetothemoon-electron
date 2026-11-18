// src/components/GATEWAY/GatewaySidebar/GatewaySidebar.tsx

import React, { useEffect, useRef, useState } from 'react';
import { 
  TrashIcon, 
  EditIcon, 
  PinIcon, 
  MoreIcon, 
  ChevronIcon,
  SearchIcon,
  NewChatIcon,
  MultiSelectIcon,
  CheckIcon,
  CloseIcon,
  LogoIcon,
  NewChatCircleIcon,
  WhaleIcon,
  PanelCollapseIcon
} from '../GatewayIcons/GatewayIcons';

import { GatewayProfileMenu } from '../GatewayProfileMenu/GatewayProfileMenu';

interface Conversation {
  id: string;
  title: string;
  group?: string;
}

interface GatewaySidebarProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onRefresh: () => void;
  isLoggedIn: boolean;
  onNewChat: () => void;
  onRenameRequest: (id: string, currentTitle: string) => void;
  onPinRequest: (id: string, pin: boolean) => void;
  onDeleteRequest: (id: string) => void;
  onMultiSelectRequest: () => void;

  isChatSelectMode: boolean;
  selectedChatIds: Set<string>;
  onToggleChatSelection: (id: string) => void;
  onToggleChatSelectMode: () => void;
  onBulkPinChats: () => void;
  onBulkDeleteChats: () => void;

  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
}

export const GatewaySidebar: React.FC<GatewaySidebarProps> = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  onRefresh,
  onNewChat,
  isLoggedIn,
  onRenameRequest,
  onPinRequest,
  onDeleteRequest,
  onMultiSelectRequest,
  isChatSelectMode,
  selectedChatIds,
  onToggleChatSelection,
  onToggleChatSelectMode,
  onBulkPinChats,
  onBulkDeleteChats,
  isCollapsed,
  onToggleCollapse,
  onOpenSearch,
}) => {
  const [openMenuForId, setOpenMenuForId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  useEffect(() => {
    if (!openMenuForId) return;
    const onDocClick = (e: MouseEvent) => {
      const path = e.composedPath();
      if (menuRef.current && !path.some((n) => n === menuRef.current)) {
        setOpenMenuForId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuForId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuForId]);

  const grouped: Record<string, Conversation[]> = {};
  conversations.forEach((conv) => {
    const g = conv.group || 'Все диалоги';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(conv);
  });

  const groupOrder = [
    'Pinned', 'Закреплено', 
    'Today', 'Сегодня', 
    'Yesterday', 'Вчера', 
    '7 Days', '7 дней', 
    '30 Days', '30 дней'
  ];
  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    const ia = groupOrder.indexOf(a);
    const ib = groupOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return b.localeCompare(a);
  });

    return (
    <>
      {/* Компактный сайдбар (свернутое состояние) — всегда в DOM */}
      <div 
        className="ca6d4be1 _5a20a69" 
        style={{ display: isCollapsed ? 'flex' : 'none' }}
      >
        <div className="_6acebc2">
          <WhaleIcon size={27} />
        </div>
        <div className="e5bf614e">
          <div style={{ width: '1px' }}></div>
          {/* Развернуть */}
          <div
            role="button"
            className="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m _4f3769f"
            tabIndex={0}
            onClick={onToggleCollapse}
            style={{ '--dsl-button-height': '34px' } as React.CSSProperties}
          >
            <div className="ds-button__background" />
            <div className="ds-button__icon ds-button__icon--last-child">
              <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                <PanelCollapseIcon size={16} />
              </div>
            </div>
          </div>
          {/* Поиск */}
          <div
            role="button"
            className="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m _4f3769f"
            tabIndex={0}
            onClick={onRefresh}
            style={{ '--dsl-button-height': '34px' } as React.CSSProperties}
          >
            <div className="ds-button__background" />
            <div className="ds-button__icon ds-button__icon--last-child">
              <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                <SearchIcon size={16} />
              </div>
            </div>
          </div>
          {/* Новый чат */}
          <div
            role="button"
            className="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m _4f3769f"
            tabIndex={0}
            onClick={onNewChat}
            style={{ '--dsl-button-height': '34px' } as React.CSSProperties}
          >
            <div className="ds-button__background" />
            <div className="ds-button__icon ds-button__icon--last-child">
              <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                <NewChatCircleIcon size={16} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Полный сайдбар (развернутое состояние) — всегда в DOM */}
      <div 
        className="b8812f16 a2f3d50e"
        style={{ display: isCollapsed ? 'none' : undefined }}
      >
        {/* Шапка */}
        <div className="_262baab">
          <div className="e066abb8">
            <LogoIcon size={143} />
          </div>
          {!isChatSelectMode && (
            <div className="_23e1c55">
              {/* Поиск — открывает модалку */}
              <div
                role="button"
                className="ds-button ds-button--iconLabelTertiary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--sizing-content"
                tabIndex={0}
                onClick={onOpenSearch}
                style={{ '--dsl-button-height': '34px' } as React.CSSProperties}
              >
                <div className="ds-button__background" />
                <div className="ds-button__icon ds-button__icon--last-child">
                  <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                    <SearchIcon size={16} />
                  </div>
                </div>
              </div>
              {/* Свернуть */}
              <div
                role="button"
                className="ds-button ds-button--iconLabelTertiary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--sizing-content"
                tabIndex={0}
                onClick={onToggleCollapse}
                style={{ '--dsl-button-height': '34px' } as React.CSSProperties}
              >
                <div className="ds-button__background" />
                <div className="ds-button__icon ds-button__icon--last-child">
                  <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                    <PanelCollapseIcon size={16} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Блок "Новый чат" / "Выбор чатов" */}
        <div className="_7b40dad">
          <div className="dc1f7bee _4bcc731">
            {isChatSelectMode ? (
              <div className="_3c15409" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 0 0 10px', height: '40px' }}>
                <span className="_271c083" style={{ fontSize: '16px', fontWeight: 500, lineHeight: '24px', color: '#f5f5f5' }}>Выбор чатов</span>
                <button 
                  type="button" 
                  onClick={onToggleChatSelectMode} 
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    width: '28px', height: '28px', borderRadius: '50%', 
                    background: 'rgb(44, 44, 46)', border: 'none', padding: 0, 
                    color: 'rgb(207, 211, 214)', cursor: 'pointer' 
                  }}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            ) : (
              <div className="_5a8ac7a" tabIndex={0} onClick={onNewChat}>
                <div className="ds-icon _1c42ad7" style={{ fontSize: 16, width: 16, height: 16 }}>
                  <NewChatCircleIcon size={16} />
                </div>
                <span>Новый чат</span>
                <div className="ds-focus-ring" />
              </div>
            )}
          </div>
        </div>

        {/* Список диалогов */}
        <div className="_3586175 ds-scroll-area ds-scroll-area--show-on-focus-within ds-scroll-area--enabled">
          <div className="_6d215eb ds-scroll-area ds-scroll-area--show-on-focus-within ds-scroll-area--enabled">
            <div className="_77cdc67 _8a693f3">
              <div className="e07f456c">
                {sortedGroups.map((groupName) => {
                  const isGroupCollapsed = collapsedGroups.has(groupName);
                  const count = grouped[groupName].length;

                  return (
                    <div key={groupName} className="_3098d02">
                      <div 
                        className="f3d18f6a" 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                      >
                        <div 
                          role="button" 
                          aria-expanded={!isGroupCollapsed}
                          onClick={() => toggleGroup(groupName)}
                          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '4px', flex: 1 }}
                        >
                          <span>{groupName} {isGroupCollapsed ? `${count} chats` : ''}</span>
                          <div className="ds-icon" style={{ fontSize: '14px', width: '14px', height: '14px', display: 'flex' }}>
                            <ChevronIcon size={14} expanded={!isGroupCollapsed} />
                          </div>
                        </div>

                        {!isChatSelectMode && (
                          <div
                            role="button"
                            className="ds-button ds-button--iconLabelTertiary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--sizing-content _8023265"
                            tabIndex={0}
                            title="Выбрать несколько"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMultiSelectRequest();
                            }}
                            style={{ '--dsl-button-height': '22px', '--dsl-button-icon-size': '12px' } as React.CSSProperties}
                          >
                            <div className="ds-button__background" />
                            <div className="ds-button__icon ds-button__icon--last-child">
                              <div className="ds-icon" style={{ fontSize: '12px', width: '12px', height: '12px', display: 'flex' }}>
                                <MultiSelectIcon size={16} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {!isGroupCollapsed && (
                        <div className="_62cad32">
                          {grouped[groupName].map((conv) => {
                            const isSelected = selectedChatIds.has(conv.id);
                            return (
                              <a
                                key={conv.id}
                                className={`_546d736 ${selectedConversation === conv.id ? 'b64fb9ae' : ''} ${isChatSelectMode ? 'd377ebc7' : ''}`}
                                tabIndex={0}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (isChatSelectMode) {
                                    onToggleChatSelection(conv.id);
                                  } else {
                                    onSelectConversation(conv.id);
                                  }
                                }}
                              >
                                <div className="ds-focus-ring" />
                                
                                {isChatSelectMode && (
                                  <span className="_8842fa1">
                                    <div 
                                      className="ds-checkbox-align-wrapper" 
                                      style={{ '--dsl-checkbox-opacity-disabled': '0.3', '--dsl-checkbox-size': '20px' } as React.CSSProperties}
                                    >
                                      <div 
                                        className={`ds-checkbox ds-checkbox--s ds-checkbox--circle ${isSelected ? 'ds-checkbox--active' : 'ds-checkbox--none'}`}
                                        tabIndex={-1}
                                        style={{ '--dsl-checkbox-size': '20px' } as React.CSSProperties}
                                      >
                                        {isSelected && <CheckIcon size={12} />}
                                      </div>
                                    </div>
                                  </span>
                                )}

                                <div className="c08e6e93">{conv.title}</div>
                                
                                {!isChatSelectMode && (
                                  <div className="_254829d">
                                    <div className="gateway-sidebar-actions">
                                      <div
                                        role="button"
                                        className="ds-button ds-button--iconLabelTertiary ds-button--icon ds-button--capsule ds-button--xs ds-button--icon-relative-l _2090548"
                                        tabIndex={0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setOpenMenuForId(openMenuForId === conv.id ? null : conv.id);
                                        }}
                                      >
                                        <div className="ds-button__background" />
                                        <div className="ds-button__icon ds-button__icon--last-child">
                                          <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                                            <MoreIcon size={16} />
                                          </div>
                                        </div>
                                      </div>
                                      {openMenuForId === conv.id && (
                                        <div
                                          className="gateway-sidebar-menu"
                                          ref={menuRef}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div
                                            role="menuitem"
                                            className="gateway-sidebar-menu__item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              setOpenMenuForId(null);
                                              onRenameRequest(conv.id, conv.title);
                                            }}
                                          >
                                            <EditIcon size={14} />
                                            <span>Переименовать</span>
                                          </div>
                                          <div
                                            role="menuitem"
                                            className="gateway-sidebar-menu__item"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              setOpenMenuForId(null);
                                              onPinRequest(conv.id, true);
                                            }}
                                          >
                                            <PinIcon size={14} />
                                            <span>Закрепить</span>
                                          </div>
                                          <div
                                            role="menuitem"
                                            className="gateway-sidebar-menu__item gateway-sidebar-menu__item--danger"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              setOpenMenuForId(null);
                                              onDeleteRequest(conv.id);
                                            }}
                                          >
                                            <TrashIcon size={14} />
                                            <span>Удалить</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </a>
                            );
                          })}
                          <div className="_33788b3" />
                        </div>
                      )}
                      <div className="_31ac179" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="_1d72f01" />
        </div>

        {/* Нижняя панель */}
        {isChatSelectMode ? (
          <div className="_7b40dad f14f3a6d" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div className="_35dde8c" style={{ display: 'flex', height: '62px', alignItems: 'center', justifyContent: 'space-around', width: '100%' }}>
              <button 
                type="button" 
                className="_82a287d" 
                disabled={selectedChatIds.size === 0} 
                onClick={onBulkPinChats}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: selectedChatIds.size === 0 ? 'rgb(129, 133, 140)' : '#f5f5f5', fontSize: '14px', cursor: selectedChatIds.size === 0 ? 'not-allowed' : 'pointer' }}
              >
                <PinIcon size={16} /> Закрепить
              </button>
              <div className="a8334b0d" style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
              <button 
                type="button" 
                className="_82a287d _2daabdb" 
                disabled={selectedChatIds.size === 0} 
                onClick={onBulkDeleteChats}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: selectedChatIds.size === 0 ? 'rgb(129, 133, 140)' : '#ec3942', fontSize: '14px', cursor: selectedChatIds.size === 0 ? 'not-allowed' : 'pointer' }}
              >
                <TrashIcon size={16} /> Удалить
              </button>
            </div>
          </div>
        ) : (
          <GatewayProfileMenu />
        )}
      </div>
    </>
  );
};