import { CONFIG } from './config';

interface ApiOptions {
  method?: 'GET' | 'POST';
  payload?: any;
}

export async function callApi(action: string, params: Record<string, string> = {}, options: ApiOptions = { method: 'GET' }) {
  const url = new URL(CONFIG.GAS_WEB_APP_URL);
  url.searchParams.set('action', action);
  
  const token = sessionStorage.getItem('worship_session_token');
  if (token) {
    url.searchParams.set('token', token);
  }

  // Tambahkan query string params
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let fetchOptions: RequestInit = {
    method: options.method,
  };

  // Google Apps Script doPost terkadang bermasalah dengan body JSON kompleks karena CORS.
  // Salah satu workaround terbaik adalah mengirim payload lewat 'payload' query param,
  // atau menggunakan method POST dengan `application/x-www-form-urlencoded`
  if (options.method === 'POST' && options.payload) {
    fetchOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(options.payload));
    fetchOptions.body = formData.toString();
  }

  try {
    const res = await fetch(url.toString(), fetchOptions);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json();
    return json;
  } catch (error) {
    console.error(`Error calling API (${action}):`, error);
    throw error;
  }
}
