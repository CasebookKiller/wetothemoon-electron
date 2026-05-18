export function fetchWithToken(url: string, token: string): Promise<Response> {  
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  return fetch(url, { headers });  
}

export function fetchInstrument(url: string, query: string, token: string): Promise<Response> {  
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = { query: query };

  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body)});  
}

// запрос списка облигаций
export function fetchBonds(url: string, ttoken: string, token: string): Promise<Response> {  
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = { ttoken: ttoken };

  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body)});  
}

export function fetchBondsAxios(url: string, ttoken: string, token: string): Promise<Response> {  
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = { ttoken: ttoken };

  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body)});  
}

// запрос информации об облигации
export function fetchBond(url: string, ticker: string, classcode: string, ttoken: string, token: string): Promise<Response> {  
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = { ticker: ticker, classcode: classcode, ttoken: ttoken };

  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body)});  
}

// запрос информации о событиях облигации
export function fetchBondEvents(url: string, from: string, to: string, instrumentId: string, type: string, ttoken: string, token: string): Promise<Response> {  
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = { from: from, to: to, instrumentId: instrumentId, type: type, ttoken: ttoken };

  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body)});  
}

export function getData(url: string, token: string): Promise<Response> {  
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  return fetch(url, { method: 'POST', headers });  
}