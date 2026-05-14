import { FC, useState } from 'react';

import { ToggleButton, ToggleButtonChangeEvent } from 'primereact/togglebutton';

import './BookmarkButton.css';

export interface IBookmarkProps {
  isin?: string,
  bookmark?: boolean,
  callback?: (isin: string) => void
}

export const BookmarkButton : FC<IBookmarkProps> = ({ isin, bookmark, callback}) => {
  const [checked, setChecked] = useState<boolean>(bookmark||false);
  return (
    <ToggleButton
      onLabel=''
      offLabel=''
      onIcon='pi pi-bookmark-fill'
      offIcon='pi pi-bookmark'
      className='profile p-button-rounded'
      checked={checked}
      onChange={(e: ToggleButtonChangeEvent) => {
        setChecked(e.value);
        callback?.(isin || '');
      }}
    />
  );
}