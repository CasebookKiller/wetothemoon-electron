import React, { useState } from 'react';

const LlamaInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendToLlama = async () => {
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

    setIsLoading(true);
    try {
      const result = await electronAPI.sendMessageToLlama(input);
      setResponse(result);
    } catch (error) {
      console.error('Error communicating with Llama:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Llama 3.2 Interface</h2>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Введите запрос для Llama..."
      />
      <button onClick={sendToLlama} disabled={isLoading}>
        {isLoading ? 'Обработка...' : 'Отправить'}
      </button>
      <div>
        <h3>Ответ:</h3>
        <p>{response}</p>
      </div>
    </div>
  );
};

export default LlamaInterface;
