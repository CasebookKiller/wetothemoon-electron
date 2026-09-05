// src/components/GATEWAY/GatewayChatHeader/GatewayChatHeader.tsx

import React from 'react';

interface GatewayChatHeaderProps {
  title: string;
  modelType: 'default' | 'expert' | 'vision';
  onSelectModel: (model: 'default' | 'expert' | 'vision') => void;
  showTitle?: boolean;
  onToggleSelectMode?: () => void;
}

export const GatewayChatHeader: React.FC<GatewayChatHeaderProps> = ({
  title,
  modelType,
  onSelectModel,
  showTitle = true,
  onToggleSelectMode,
}) => {
  const modeLabel =
    modelType === 'default' ? 'Быстрый' : modelType === 'expert' ? 'Эксперт' : 'Распознавание';

  // Оригинальные SVG-иконки
  const expertIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.0289 2.0918C11.6941 2.09186 12.3154 2.42299 12.6871 2.97461L14.8414 6.1709C15.0959 6.54892 15.0625 7.05142 14.7604 7.39258L8.74866 14.1768C8.35077 14.6257 7.64952 14.6257 7.25159 14.1768L1.23987 7.39258C0.937742 7.05136 0.905152 6.54892 1.15979 6.1709L3.31213 2.97461C3.68383 2.42281 4.306 2.0918 4.97131 2.0918H11.0289ZM3.41858 5.46484V6.76562H12.5817V5.46484H3.41858Z" fill="currentColor" />
    </svg>
  );

  const fastIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.1631 6.76904L6.6497 14.7572C6.52129 14.9147 6.26708 14.8025 6.29685 14.6015L7.00998 9.78665C7.02788 9.66585 6.93427 9.55735 6.81214 9.55735L2.99201 9.55735C2.82344 9.55735 2.73048 9.36161 2.837 9.23096L9.35037 1.2428C9.47879 1.08531 9.73299 1.19748 9.70322 1.39849L8.99009 6.21335C8.9722 6.33416 9.06581 6.44265 9.18793 6.44265L13.0081 6.44265C13.1766 6.44265 13.2696 6.6384 13.1631 6.76904Z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );

  const visionIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.274" y="2.115" width="13.452" height="11.771" rx="3.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12.2037 6.31862C12.2037 7.24729 11.4509 8.00013 10.5222 8.00013C9.59353 8.00013 8.8407 7.24729 8.8407 6.31862C8.8407 5.38995 9.59353 4.63712 10.5222 4.63712C11.4509 4.63712 12.2037 5.38995 12.2037 6.31862Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.27393 9.68155C2.48594 8.77254 3.09194 8.31804 3.74872 8.18241C4.28996 8.07064 4.85155 8.11055 5.37154 8.29774C6.00254 8.52489 6.53818 9.06052 7.60945 10.1318L11.363 13.8853" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );

  const modeIcon = modelType === 'expert' ? expertIcon : modelType === 'vision' ? visionIcon : fastIcon;

  return (
    <div className={`_2be88ba ${showTitle ? '' : '_1551317'}`}>
      {showTitle && (
        <div className="f8d1e4c0 the-header">
          <div className="_9fcbeda _7ee190f">
            <div className="afa34042 e0a1edb7 e37a04e4 _5a50d80" tabIndex={0}>
              {title}
            </div>
            <div className="c03d486a">
              <div className="ds-icon a1ac5b47" style={{ fontSize: 12, width: 12, height: 12 }}>
                {modeIcon}
              </div>
              <span className="_46a12ab">{modeLabel}</span>
            </div>
          </div>
        </div>
      )}

      <div className="_1aa2651 the-header">
        <div
          role="button"
          className="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--l ds-button--icon-relative-m _57370c5 _5dedc1e"
          tabIndex={0}
          onClick={onToggleSelectMode}
          style={{ '--dsl-button-height': '34px' } as React.CSSProperties}
        >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.2027 4.90034V6.43655H2.79724V4.90034H17.2027Z" fill="currentColor" />
              <path d="M10.9603 13.0634V14.5996H2.79724V13.0634H10.9603Z" fill="currentColor" />
            </svg>
        </div>

        {showTitle ? (
          <>
            <div className="_9986c0c">
              <div className="d00ed9c9">{title}</div>
              <div className="c03d486a">
                <div className="ds-icon a1ac5b47" style={{ fontSize: 12, width: 12, height: 12 }}>
                  {modeIcon}
                </div>
                <span className="_46a12ab">{modeLabel}</span>
              </div>
            </div>
            <div className="_19943ce" />
            <div className="_348bebe" />
          </>
        ) : (
          <>
            <div className="_9986c0c" />
            <div className="_19943ce" />
            <div className="_348bebe" />
          </>
        )}

        <div
          role="button"
          className="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--xl ds-button--icon-relative-m"
          tabIndex={0}
          onClick={onToggleSelectMode}   // <-- ЭТУ СТРОКУ ДОБАВИТЬ
          style={{ minWidth: 44 }}
        >
          <div className="ds-button__background" />
          <div className="ds-button__icon ds-button__icon--last-child">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9.99994 1.22943C5.15598 1.22943 1.22937 5.15604 1.22937 10C1.22937 11.3437 1.5319 12.6189 2.07359 13.7592L2.40673 14.4596L3.8065 13.7942L3.4743 13.0939L3.31625 12.7371C2.97051 11.8938 2.77962 10.97 2.77962 10C2.77962 6.01243 6.01237 2.77968 9.99994 2.77968C13.9875 2.77968 17.2203 6.01243 17.2203 10C17.2203 13.9876 13.9875 17.2203 9.99994 17.2203C9.18334 17.2203 8.5858 17.1622 8.05597 17.0159C7.53397 16.8717 7.03885 16.6305 6.44609 16.2171C5.57744 15.6112 4.33224 15.3975 3.30584 16.0458L3.28975 16.0562L3.27366 16.0676L2.59034 16.5484L3.10425 18.0825L4.14438 17.35C4.51831 17.1207 5.07296 17.1507 5.55834 17.4891C6.26058 17.9789 6.91499 18.3092 7.64333 18.5103C8.3639 18.7093 9.11779 18.7706 9.99994 18.7706C14.8439 18.7706 18.7705 14.844 18.7705 10C18.7705 5.15604 14.8439 1.22943 9.99994 1.22943ZM9.21913 6.36949V9.22487H6.36943V10.7751H9.21913V13.6305H10.7694V10.7751H13.6304V9.22487H10.7694V6.36949H9.21913Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>

      {showTitle && (
        <div
          role="button"
          className="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--l ds-button--icon-relative-m _57370c5 _5dedc1e"
          tabIndex={0}
          onClick={onToggleSelectMode}   // <-- ЭТУ СТРОКУ ДОБАВИТЬ
          style={{ '--dsl-button-height': '34px' } as React.CSSProperties}
        >
          <div className="ds-button__background" />
          <div className="ds-button__icon ds-button__icon--last-child">
            <div className="ds-icon" style={{ fontSize: 'inherit' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7.95889 1.52285C7.95888 0.826234 8.76055 0.467983 9.27669 0.875208L9.37524 0.967191L15.1317 7.18358C15.5582 7.64419 15.5582 8.35614 15.1317 8.81676L9.37524 15.0331C8.87034 15.578 7.95888 15.2205 7.95889 14.4775V10.8207C7.10614 10.8432 6.31361 10.9316 5.45468 11.2515C4.39484 11.6463 3.18248 12.413 1.64676 13.9425C1.4533 14.135 1.18329 14.1696 0.969086 14.0908C0.74748 14.0091 0.547307 13.7879 0.54859 13.4844L0.55516 13.1315C0.618924 11.3494 1.11153 9.29838 2.27656 7.63787C3.45289 5.96147 5.29554 4.71635 7.95889 4.54797V1.52285ZM9.20911 5.13366C9.20899 5.50567 8.9031 5.77687 8.56523 5.77755C5.99383 5.78282 4.33736 6.8762 3.29964 8.35496C2.54519 9.43014 2.10739 10.7283 1.9152 11.9939C3.04749 11.0323 4.0569 10.4385 5.01917 10.0801C6.29638 9.60449 7.4406 9.56343 8.56429 9.56295C8.9178 9.5628 9.20894 9.84909 9.20911 10.2068L9.20817 13.3737L14.1837 8.00017L9.20817 2.62571L9.20911 5.13366Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};