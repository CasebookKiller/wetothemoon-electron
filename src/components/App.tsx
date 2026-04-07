import React from 'react';

import { Navigate, Route, Routes, HashRouter } from 'react-router-dom';

import { routes } from '@/navigation/routes.tsx';

export function App() {
  routes.push();
  return (
    <React.Fragment>
      {true && <div>
        <HashRouter>
          <Routes>
            {routes.map((route) => <Route key={route.path} {...route} />)}
            <Route path='*' element={<Navigate to='/'/>}/>
          </Routes>
        </HashRouter>
      </div>}
    </React.Fragment>
  );
}
