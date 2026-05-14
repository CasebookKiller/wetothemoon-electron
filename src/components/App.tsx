import React, { useEffect, useState } from 'react';

import { Navigate, Route, Routes, HashRouter } from 'react-router-dom';

import { routes } from '@/navigation/routes.tsx';

export function App() {
  // Состояние для определения типа окна
  const [isAIWindow, setIsAIWindow] = useState(false);
  const [isMDWindow, setIsMDWindow] = useState(false);
  
  routes.push();

  useEffect(() => {
    if (window.location.hash === '#/ai') {
      setIsAIWindow(true);
    }

    if (window.location.hash === '#/md') {
      setIsMDWindow(true);
    }
  }, []); // Пустой массив зависимостей, чтобы код выполнился только один раз при монтировании


  return (
    <React.Fragment>
      {true && <div>
        <HashRouter>
          <Routes>
            {routes.map((route) => <Route key={route.path} {...route} />)}
            {isAIWindow ? <Route path='*' element={<Navigate to='/ai'/>}/> : <Route path='*' element={<Navigate to='/'/>}/>}
            {isMDWindow ? <Route path='*' element={<Navigate to='/md'/>}/> : <Route path='*' element={<Navigate to='/'/>}/>}
          </Routes>
        </HashRouter>
      </div>}
    </React.Fragment>
  );
}
