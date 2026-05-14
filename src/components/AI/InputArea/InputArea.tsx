import React, { useState, useRef, useCallback } from 'react';

import { FloatLabel } from 'primereact/floatlabel';
import { InputTextarea } from 'primereact/inputtextarea';

import './InputArea.css'

interface InputAreaProps {
  onSend: (text: string) => void;
  onAbort: () => void; // Новая проп-свойство для обработки прерывания
  isLoading: boolean;
  isAborted: boolean; // Флаг состояния прерывания
  className?: string;
}

const InputArea: React.FC<InputAreaProps> = ({ 
  onSend,
  onAbort,
  isLoading,
  isAborted,
  className 
}) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<{ path: string; content: string }[]>([]);
  const [FileLoading, setFileLoading] = useState<boolean>(false); // Состояние загрузки файлов [oading]

  // Функция для автоматического изменения высоты textarea
  const autoResize = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    textarea.style.height = 'auto'; // Сбрасываем высоту для корректного расчёта
    const scrollHeight = Math.min(
      textarea.scrollHeight,
      textarea.clientHeight * 5 // Ограничиваем максимум 5 строками
    );
    textarea.style.height = `${scrollHeight}px`;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    autoResize();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSend(inputText);
      setInputText('');
      // Сбрасываем высоту после отправки
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleFilePicker = async () => {
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

    setFileLoading(true);
    try {
      // Шаг 1: Получаем пути к файлам
      const filePaths = await electronAPI.openFilePicker();
      
      if (filePaths && filePaths.length > 0) {
        // Шаг 2: Читаем содержимое файлов
        const files = await electronAPI.readFilesContents(filePaths);

        // Шаг 3: Обновляем состояние с содержимым файлов
        setSelectedFiles(files);
        console.log('Содержимое файлов:', files);

        // Шаг 4: Обрабатываем содержимое файлов
        files.forEach((file: any) => {
          const fileContent = file.content;
          const language = file.language;

          // Форматируем вставку в формате Markdown
          let formattedCode = `> ${file.filename}\n`;
          if (language) {
            formattedCode += ` \`\`\`${language}\n`;
          } else {
            formattedCode += ' \`\`\`\n';
          }
          formattedCode += `${fileContent}\n\`\`\``;

          setInputText(prev => prev + (prev ? '\n\n' : '') + formattedCode);
          setTimeout(autoResize, 0); // Даём время для обновления состояния
        });
      } else {
        console.log('Выбор отменён или произошла ошибка');
      }
    } catch (error) {
      console.error('Ошибка при выборе и чтении файлов:', error);
    } finally {
      setFileLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex flex-column gap-2 ${className}`}>
      <div className="flex align-items-top gap-2">
        {true &&<textarea
          ref={textareaRef}
          value={inputText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Введите сообщение... (Enter - новая, Ctrl+Enter - отправить) Вы можете вставить код из файла или перетащить файл сюда"
          className="flex-1 p-3 border-round border-1 surface-border outline-none resize-none overflow-auto"
          disabled={isLoading}
          rows={4} // Начальное количество строк
          style={{
            minHeight: '80px',
            maxHeight: '200px', // ~5 строк при стандартной высоте строки
            overflow: 'auto'
          }}
        />}

        {false && <FloatLabel>
          <InputTextarea 
            id="inputarea"
            ref={textareaRef}
            value={inputText}
            onChange={handleTextChange}
            rows={5}
            disabled={isLoading}
            style={{
              width: '100%',
            }}
          />
          <label htmlFor="inputarea">Введите сообщение... Вы можете вставить код из файла или перетащить файл сюда</label>
        </FloatLabel>}
        <div 
          className="flex-wrap align-items-top gap-2"
          style={{maxWidth: '105px'}}
        >
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3 border-round bg-primary border-none cursor-pointer flex-none align-items-center justify-content-center"
          >
            {isLoading ? (
              <i className="pi pi-spin pi-spinner" />
            ) : (
              <i className="pi pi-send" />
            )}
          </button>
          {/* Кнопка прерывания */}
          <button
            type="button"
            onClick={onAbort}
            disabled={!isLoading || isAborted}
            className="ml-2 p-3 border-round bg-danger border-none cursor-pointer flex-none align-items-center justify-content-center abort-button"
          >
            <i className="pi pi-stop" />
          </button>
          {/* Кнопка загрузки файлов */}
          <button
            type="button"
            
            className="mt-2 p-3 border-round surface-border border-1 cursor-pointer flex-none align-items-center justify-content-center"
            onClick={handleFilePicker}
            disabled={FileLoading}
            style={{
              //padding: '10px 20px',
              backgroundColor: FileLoading ? '#ccc' : '#3b3b3b',
              color: 'white',
              //border: 'none',
              maxWidth: '48px',
              borderRadius: '4px',
              cursor: FileLoading ? 'not-allowed' : 'pointer'
            }}
          >
            { FileLoading ? <i className='pi pi-spin pi-spinner'/> : <i className="pi pi-file-import" /> }
          </button>
          
        </div>
      </div>
      

      
    </form>
  );
};

export default InputArea;
