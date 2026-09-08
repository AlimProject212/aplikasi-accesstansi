const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

// ─── Convenience helpers ───────────────────────────────────────────────────
export const apiGet  = <T = any>(path: string) => apiFetch<T>(`/api${path}`);
export const apiPost = <T = any>(path: string, body: unknown) =>
  apiFetch<T>(`/api${path}`, { method: 'POST', body: JSON.stringify(body) });
export const apiPut  = <T = any>(path: string, body: unknown) =>
  apiFetch<T>(`/api${path}`, { method: 'PUT', body: JSON.stringify(body) });
export const apiDel  = <T = any>(path: string) =>
  apiFetch<T>(`/api${path}`, { method: 'DELETE' });

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem('accesstansi_token');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    const msg  = body.error || 'Sesi berakhir, silakan login ulang';
    // Hanya reload kalau user sudah login sebelumnya (ada token)
    // Kalau tidak ada token = sedang proses login → jangan reload, tampilkan pesan error
    if (token) {
      localStorage.removeItem('accesstansi_token');
      window.location.reload();
    }
    throw new ApiError(401, msg);
  }

  if (res.status === 402) {
    const body = await res.json().catch(() => ({}));
    window.dispatchEvent(new CustomEvent('subscription-expired', { detail: body }));
    throw new ApiError(402, body.error || 'Langganan tidak aktif');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const detail = body.detail
      ? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail))
      : null;
    const msg = body.error || 'Terjadi kesalahan';
    throw new ApiError(res.status, detail ? `${msg}: ${detail}` : msg);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json();
};
