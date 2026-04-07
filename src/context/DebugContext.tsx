// src/context/DebugContext.tsx
import { createContext, useContext } from 'react';

interface DebugContextType {
  isDebug: boolean;
  debugLog: (...args: any[]) => void;
}

export const DebugContext = createContext<DebugContextType>({
  isDebug: false,
  debugLog: () => {},
});

export const useDebug = () => useContext(DebugContext);
