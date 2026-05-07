const BASE = '/api/dmms';

function getToken(): string | null {
  return localStorage.getItem('dmms_token');
}

export function setToken(token: string): void {
  localStorage.setItem('dmms_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('dmms_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (headers['Content-Type'] === 'null' || !headers['Content-Type']) {
    delete headers['Content-Type'];
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed: ${res.status}`);
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>(path, { method: 'POST', body: fd, headers: { 'Content-Type': '' } as any });
  },
};
