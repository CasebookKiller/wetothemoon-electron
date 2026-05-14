const MessageActions: React.FC<{ messageText: string; messageId: string }> = ({
  messageText,
  messageId
}) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      alert('Ответ скопирован в буфер обмена!');
    } catch (err) {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = messageText;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Ответ скопирован (fallback)');
    }
  };

  const handleSave = () => {
    const blob = new Blob([messageText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${messageId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2 mt-2 justify-content-start">
      <button
        onClick={handleCopy}
        className={`copy-button`}
        title="Копировать весь ответ"
      >
        📋 Копировать ответ
      </button>
      <button
        onClick={handleSave}
        className="save-button"
        title="Сохранить код в файл"
      >
        💾 Сохранить .md
      </button>
    </div>
  );
};

export default MessageActions;