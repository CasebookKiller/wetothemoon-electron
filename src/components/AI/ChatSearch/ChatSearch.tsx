import React, { useState, useCallback } from 'react';

interface ChatSearchProps {
  onSearch: (query: string) => void;
  className?: string;
}

const ChatSearch: React.FC<ChatSearchProps> = ({ onSearch, className }) => {
  const [query, setQuery] = useState('');

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    onSearch(searchQuery);
  }, [onSearch]);

  return (
    <div className={`p-3 border-bottom-1 surface-border ${className}`}>
      <div className="flex align-items-center gap-2">
        <i className="pi pi-search text-700" />
        <input
          type="text"
          placeholder="Поиск по чатам..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 p-2 border-round border-1 surface-border outline-none"
        />
        {query && (
          <button
            onClick={() => handleSearch('')}
            className="p-2 border-none bg-transparent cursor-pointer"
          >
            <i className="pi pi-times" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatSearch;