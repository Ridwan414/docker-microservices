// Single API client for all four backend services.
//
// Routing strategy:
//   - In production (docker-compose + nginx), the browser hits the frontend on
//     port 80 and `/api/...` is reverse-proxied through an internal nginx
//     gateway. Each `/api/<service>/...` is forwarded to the right FastAPI.
//   - In dev (vite), we set `VITE_API_TARGET` and the dev server proxies
//     `/api` to a single host running the gateway (or you can change the
//     gateway to one node process forwarding to all four).
//
// API endpoints follow the convention:
//   /api/v1/auth/...    -> user-service
//   /api/v1/users/...   -> user-service
//   /api/v1/products/.. -> product-service
//   /api/v1/inventory/.. -> inventory-service
//   /api/v1/orders/...  -> order-service

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearAuth,
} from '../utils/storage.js';

const BASE = '/api/v1';

// --- Token refresh (single-flight) -----------------------------------------
// Multiple parallel 401s can happen. We share one in-flight refresh promise
// so we only call /auth/refresh once.

let refreshInFlight = null;

async function refreshTokens() {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token');

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
      const data = await res.json();
      setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
      return data.access_token;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// --- Core fetch ------------------------------------------------------------

async function parseResponse(res) {
  // 204 / empty body
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return res.text();
}

async function request(method, path, { body, auth = true, retry = true, headers } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const reqHeaders = { Accept: 'application/json', ...(headers || {}) };

  // Normalize the body and pick the right Content-Type up front. We don't
  // rely on the body type to decide — we rely on the Content-Type the caller
  // has already declared. If the caller didn't set one and the body isn't a
  // raw string, we default to JSON.
  let serializedBody;
  if (body === undefined || body === null) {
    serializedBody = undefined;
  } else if (typeof body === 'string') {
    serializedBody = body;
  } else if (body instanceof FormData) {
    serializedBody = body;
  } else {
    if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  if (auth) {
    const token = getAccessToken();
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: serializedBody,
  });

  if (res.status === 401 && auth && retry && getRefreshToken()) {
    try {
      await refreshTokens();
      return request(method, path, { body, auth, retry: false, headers });
    } catch {
      clearAuth();
      // Force navigation to login on next render by reloading
      window.dispatchEvent(new CustomEvent('ms:auth-expired'));
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const errBody = await parseResponse(res);
    const detail =
      errBody && typeof errBody === 'object' && 'detail' in errBody
        ? errBody.detail
        : typeof errBody === 'string'
          ? errBody
          : `Request failed: ${res.status}`;
    throw new ApiError(res.status, detail, errBody);
  }

  return parseResponse(res);
}

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...(opts || {}), body }),
  put: (path, body, opts) => request('PUT', path, { ...(opts || {}), body }),
  patch: (path, body, opts) => request('PATCH', path, { ...(opts || {}), body }),
  delete: (path, opts) => request('DELETE', path, opts),
};