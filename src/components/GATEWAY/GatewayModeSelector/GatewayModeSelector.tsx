// @/src/components/GATEWAY/GatewayModeSelector/GatewayModeSelector.tsx
import React from 'react';

interface GatewayModeSelectorProps {
  modelType: 'default' | 'expert' | 'vision';
  onSelectModel: (model: 'default' | 'expert' | 'vision') => void;
}

export const GatewayModeSelector: React.FC<GatewayModeSelectorProps> = ({ modelType, onSelectModel }) => {
  const modeLabel = {
    default: 'Быстрый режим',
    expert: 'Эксперт режим',
    vision: 'Распознавание режим',
  }[modelType];

  return (
    <div 
      className="_9a2f8e4" 
      style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      width: '100%', 
      maxWidth: '720px',
      margin: '0 auto', // <-- добавить 
      }}
    >
      {/* Заголовок с иконкой */}
      <div className="_5758a85">
        <div className="_6c7e7df">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 26" fill="none" className="ce41ed1b">
            <g clipPath="url(#a)">
              <path
                fill="var(--dsw-alias-brand-primary)"
                d="M33.615 2.598c-.36-.176-.515.16-.726.33-.072.055-.132.127-.193.193-.526.562-1.14.93-1.943.887-1.174-.067-2.176.302-3.062 1.2-.188-1.107-.814-1.767-1.766-2.191-.498-.22-1.002-.441-1.35-.92-.244-.341-.31-.721-.433-1.096-.077-.226-.154-.457-.415-.496-.282-.044-.393.193-.504.391-.443.81-.614 1.702-.598 2.605.04 2.033.898 3.652 2.603 4.803.193.132.243.264.182.457-.116.397-.254.782-.376 1.179-.078.253-.194.308-.465.198-.936-.391-1.744-.97-2.458-1.669-1.213-1.173-2.31-2.467-3.676-3.48a16.254 16.254 0 0 0-.975-.668c-1.395-1.354.183-2.467.548-2.599.382-.138.133-.612-1.102-.606-1.234.005-2.364.42-3.803.97a4.34 4.34 0 0 1-.66.193 13.577 13.577 0 0 0-4.08-.143c-2.667.297-4.799 1.558-6.365 3.712C.116 8.436-.327 11.378.215 14.444c.57 3.233 2.22 5.91 4.755 8.002 2.63 2.17 5.658 3.233 9.113 3.03 2.098-.122 4.434-.403 7.07-2.633.664.33 1.362.463 2.518.562.892.083 1.75-.044 2.414-.182 1.04-.22.97-1.184.593-1.36-3.05-1.421-2.38-.843-2.99-1.311 1.55-1.834 3.918-5.093 4.648-9.531.072-.49.164-1.18.153-1.577-.006-.242.05-.336.326-.364a5.903 5.903 0 0 0 2.187-.672c1.977-1.08 2.774-2.853 2.962-4.978.028-.325-.006-.661-.35-.832ZM16.39 21.73c-2.956-2.324-4.39-3.089-4.982-3.056-.554.033-.454.667-.332 1.08.127.407.293.688.526 1.046.16.237.271.59-.161.854-.952.589-2.607-.198-2.685-.237-1.927-1.134-3.537-2.632-4.673-4.68-1.096-1.972-1.733-4.087-1.838-6.345-.028-.545.133-.738.676-.837A6.643 6.643 0 0 1 5.086 9.5c3.017.441 5.586 1.79 7.74 3.927 1.229 1.217 2.159 2.671 3.116 4.092 1.02 1.509 2.115 2.946 3.51 4.125.494.413.887.727 1.263.958-1.135.127-3.028.154-4.324-.87v-.002Zm1.417-9.114a.434.434 0 0 1 .587-.408c.06.022.117.055.16.105a.426.426 0 0 1 .122.303.434.434 0 0 1-.437.435.43.43 0 0 1-.432-.435Zm4.402 2.257c-.283.116-.565.215-.836.226-.421.022-.88-.149-1.13-.358-.387-.325-.664-.506-.78-1.073-.05-.242-.022-.617.022-.832.1-.463-.011-.76-.338-1.03-.265-.22-.603-.28-.974-.28a.8.8 0 0 1-.36-.11c-.155-.078-.283-.27-.161-.508.039-.077.227-.264.271-.297.504-.286 1.085-.193 1.623.022.498.204.875.578 1.417 1.107.553.639.653.815.968 1.295.25.374.476.76.632 1.2.094.275-.028.5-.354.638Z"
              />
            </g>
          </svg>
          <span>{modeLabel}</span>
        </div>
      </div>

      {/* Радио-группа выбора режима */}
      <div
        className="e362e944"
        data-layout="inline"
        style={{
          marginBottom: 38,
          marginTop: 6,
          '--inline-item-width': '164px',
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        } as React.CSSProperties}
      >
        <div
          className="b0db7355"
          role="radiogroup"
          tabIndex={0}
          style={{
            '--item-count': 3,
            '--selected-index': modelType === 'default' ? 0 : modelType === 'expert' ? 1 : 2,
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
          } as React.CSSProperties}
        >
          <div className="c15ec89f">
            <div className="ds-focus-ring" style={{ borderRadius: 120 }} />
          </div>

          {/* Быстрый */}
          <div
            data-model-type="default"
            role="radio"
            aria-checked={modelType === 'default'}
            className={`_9f2341b _18572c1 ${modelType === 'default' ? '_31a22b0' : ''}`}
            style={{
              width: 164,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexShrink: 0,
            }}
            onClick={() => onSelectModel('default')}
          >
            <div className="dfb78875">
              <div className="ds-icon _2273214" style={{ fontSize: 15, width: 15, height: 15 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.1631 6.76904L6.6497 14.7572C6.52129 14.9147 6.26708 14.8025 6.29685 14.6015L7.00998 9.78665C7.02788 9.66585 6.93427 9.55735 6.81214 9.55735L2.99201 9.55735C2.82344 9.55735 2.73048 9.36161 2.837 9.23096L9.35037 1.2428C9.47879 1.08531 9.73299 1.19748 9.70322 1.39849L8.99009 6.21335C8.9722 6.33416 9.06581 6.44265 9.18793 6.44265L13.0081 6.44265C13.1766 6.44265 13.2696 6.6384 13.1631 6.76904Z" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </div>
            </div>
            <span className="_321831d">Быстрый</span>
          </div>

          {/* Эксперт */}
          <div
            data-model-type="expert"
            role="radio"
            aria-checked={modelType === 'expert'}
            className={`_9f2341b _18572c1 ${modelType === 'expert' ? '_31a22b0' : ''}`}
            style={{
              width: 164,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexShrink: 0,
            }}
            onClick={() => onSelectModel('expert')}
          >
            <div className="dfb78875">
              <div className="ds-icon _2273214" style={{ fontSize: 15, width: 15, height: 15 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7.99969 2.14671H10.7951C11.4603 2.14671 12.082 2.47747 12.4537 3.02915L14.4258 5.95608C14.6806 6.33422 14.6474 6.83683 14.3449 7.17809L8.74814 13.4937C8.35021 13.9427 7.64919 13.9427 7.25128 13.4937L1.65509 7.17801C1.35274 6.83679 1.31945 6.33426 1.57416 5.95614L3.54568 3.02935C3.91738 2.47755 4.53914 2.14671 5.20445 2.14671H7.99969Z" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M3.84998 6.08791H12.1504" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </div>
            </div>
            <span className="_321831d">Эксперт</span>
          </div>

          {/* Распознавание */}
          <div
            data-model-type="vision"
            role="radio"
            aria-checked={modelType === 'vision'}
            className={`_9f2341b _18572c1 ${modelType === 'vision' ? '_31a22b0' : ''}`}
            style={{
              width: 164,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexShrink: 0,
            }}
            onClick={() => onSelectModel('vision')}
          >
            <div className="dfb78875">
              <div className="ds-icon _2273214" style={{ fontSize: 15, width: 15, height: 15 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1.274" y="2.115" width="13.452" height="11.771" rx="3.2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M12.2037 6.31862C12.2037 7.24729 11.4509 8.00013 10.5222 8.00013C9.59353 8.00013 8.8407 7.24729 8.8407 6.31862C8.8407 5.38995 9.59353 4.63712 10.5222 4.63712C11.4509 4.63712 12.2037 5.38995 12.2037 6.31862Z" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M1.27393 9.68155C2.48594 8.77254 3.09194 8.31804 3.74872 8.18241C4.28996 8.07064 4.85155 8.11055 5.37154 8.29774C6.00254 8.52489 6.53818 9.06052 7.60945 10.1318L11.363 13.8853" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <span className="_321831d">Распознавание</span>
          </div>
        </div>
      </div>
    </div>
  );
};