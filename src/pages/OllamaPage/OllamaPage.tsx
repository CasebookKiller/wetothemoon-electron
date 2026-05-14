import { FC, useEffect } from 'react';

import { OllamaClient } from '@/api/ollama/ollamaClient';
import OllamaChat from '@/components/AI/OllamaChat/OllamaChat';

export const OllamaPage:FC = () => {
  useEffect(()=>{

  },[])
  return (
    <div
      className='p-2'
    >
      <h3>Тест клиента Ollama</h3>
      <OllamaChat />
    </div>
  );
}