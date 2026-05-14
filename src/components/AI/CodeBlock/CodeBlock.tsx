import React, { useState, useRef } from 'react';
import './CodeBlock.css'

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  language?: string;
  codeString?: string; // строка кода для операций копирования/сохранения
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  className = '',
  language = 'text',
  codeString = ''
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);


  // Копирование в буфер обмена
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      // Fallback для старых браузеров
      if (codeRef.current) {
        const range = document.createRange();
        range.selectNode(codeRef.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        document.execCommand('copy');
        window.getSelection()?.removeAllRanges();

        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    }
  };

  // Сохранение в файл
  const handleSave = () => {
    const blob = new Blob([codeString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toLocaleString().replaceAll('.', '-').replaceAll(' ', '').replaceAll(',', ' ').replaceAll(':', '-');
    console.log(date);
    a.href = url;
    a.download = `code ${date}.${getFileExtension(language)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Определение расширения файла по языку
  const getFileExtension = (lang: string): string => {
    const extensions: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'c++': 'cpp',
      'c#': 'cs',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'yaml': 'yaml',
      'bash': 'sh',
      'sql': 'sql'
    };
    return extensions[lang.toLowerCase()] || 'txt';
  };

  return (
    <div className={`code-block ${className}`}>
      <div className="code-header">
        <span className="language-label">{language.toUpperCase()}</span>
        <div className="button-group">
          <button
            onClick={handleCopy}
            className={`copy-button ${isCopied ? 'copied' : ''}`}
            title={isCopied ? 'Скопировано!' : 'Копировать код'}
          >
            {isCopied ? '✓ Скопировано' : '📋 Копировать'}
          </button>
          <button
            onClick={handleSave}
            className="save-button"
            title="Сохранить код в файл"
          >
            💾 Сохранить
          </button>
        </div>
      </div>
      <pre className={`language-${language}`} ref={codeRef}>
        <code>{children}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
