import { type FC, type MouseEventHandler, useCallback } from 'react';
import { Link as RouterLink, type LinkProps } from 'react-router-dom';

import { classNames } from '@/css/classnames.ts';

import './Link.css';

//import { openLink } from '@tma.js/sdk-react';

// реализовать взамен фунции телеграмм
function openLink(arg0: string) {
  // сюда добавить определение платформы
  // использовать проверку и для браузера и через API Electron
  throw new Error('Function openLink() not implemented.');
}

export const Link: FC<LinkProps> = ({
  className,
  onClick: propsOnClick,
  to,
  ...rest
}) => {
  const onClick = useCallback<MouseEventHandler<HTMLAnchorElement>>((e) => {
    propsOnClick?.(e);

    // Проверяем, является ли целевой путь внешним. В этом случае мы хотели бы открыть
    // ссылку с помощью метода TMA.
    let path: string;
    if (typeof to === 'string') {
      path = to;
    } else {
      const { search = '', pathname = '', hash = '' } = to;
      path = `${pathname}?${search}#${hash}`;
    }

    const targetUrl = new URL(path, window.location.toString());
    const currentUrl = new URL(window.location.toString());
    const isExternal = targetUrl.protocol !== currentUrl.protocol
      || targetUrl.host !== currentUrl.host;

    if (isExternal) {
      e.preventDefault();
      openLink(targetUrl.toString());
    }
  }, [to, propsOnClick]);

  return (
    <RouterLink
      {...rest}
      to={to}
      onClick={onClick}
      className={classNames(className, 'link')}
    />
  );
};