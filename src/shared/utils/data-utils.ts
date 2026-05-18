const HOST = import.meta.env.VITE_HOST;
const PORT = import.meta.env.VITE_PORT;

export const getData = async <T>(
  url: string,
  email: string,
  password: string,
  tgid: string
)
: Promise<T> => {
  const res = await fetch(url, {
    method: 'Post',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ email, password, tgid})
  });
  console.log(res);
  const result = await res.json();
  if (res.ok) {
    return result;  
  } else {
    throw new Error(result);
  }  
}

export const simpleConnect = async <T>(
  tgid: string
)
: Promise<T> => {
  const url = `http://${HOST}:${PORT}/connect`;
  const res = await fetch(url, {
    method: 'Post',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ tgid })
  });
  console.log(res);
  const result = await res.json();
  if (res.ok) {
    return result;  
  } else {
    throw new Error(result);
  }  
}

// Извлечение base64 из dataUrl
export function extractBase64(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:.*?base64,(.*)$/i);
  return match ? match[1].trim() : null;
}