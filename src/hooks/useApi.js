export const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:3003' : '');

export async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${res.status}`);
  }
  return res.json();
}

export async function apiPost(endpoint, body = {}) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${res.status}`);
  }
  return res.json();
}

export async function apiDelete(endpoint) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${res.status}`);
  }
  return res.json();
}

export async function apiPut(endpoint, body = {}) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${res.status}`);
  }
  return res.json();
}
