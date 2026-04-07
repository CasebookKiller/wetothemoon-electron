import React from 'react';

const LocaleContext = React.createContext({
  locale: 'ru',
  setLocale: () => {}
});

export default LocaleContext;