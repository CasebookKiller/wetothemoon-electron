import React, { FC } from 'react';

import './LlamaPage.css';
import LlamaInterface from '@/components/LlamaInterface/LlamaInterface';

export const LlamaPage: FC = () => {
  const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
  console.log('LlamaPage.tsx: electronAPI: ', electronAPI);
  return (
    <React.Fragment>
      <div className='LlamaPage'>LlamaPage</div>
      <LlamaInterface/>
    </React.Fragment>
    
  );
};