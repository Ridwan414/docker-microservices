// Service-specific functions grouped by backend. Each function returns
// a promise and throws ApiError on non-2xx (handled by `api`).
//
// Note on trailing slashes: FastAPI's default `redirect_slashes=True` 307s
// mismatched paths on POST. The three services that define their index
// route as `@router.post("/")` (mounted under /api/v1/products,
// /api/v1/inventory, /api/v1/orders) canonicalize on the TRAILING slash
// — POST /api/v1/products (no slash) → 307 → POST /api/v1/products/.
// Routes defined as `/auth/register`, `/users/me/addresses`, etc. are
// non-root paths and canonicalize on NO trailing slash.

import { api } from './client.js';

// --- Auth -----------------------------------------------------------------

export const authApi = {
  // The login endpoint is OAuth2PasswordRequestForm, which expects form-encoded
  // `username` + `password`. We post URLSearchParams instead of JSON.
  login: async (email, password) => {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);
    return api.post('/auth/login', body, {
      auth: false,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  register: (data) => api.post('/auth/register', data, { auth: false }),
};

// --- Users ----------------------------------------------------------------

export const usersApi = {
  me: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  changePassword: (data) => api.put('/users/me/password', data),
  listAddresses: () => api.get('/users/me/addresses'),
  createAddress: (data) => api.post('/users/me/addresses', data),
  deleteAddress: (id) => api.delete(`/users/me/addresses/${id}`),
};

// --- Products -------------------------------------------------------------

function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const productsApi = {
  list: (filters) => api.get(`/products/${buildQuery(filters)}`),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products/', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  remove: (id) => api.delete(`/products/${id}`),
  categories: () => api.get('/products/category/list'),
};

// --- Inventory ------------------------------------------------------------

export const inventoryApi = {
  list: (filters) => api.get(`/inventory/${buildQuery(filters)}`),
  get: (productId) => api.get(`/inventory/${productId}`),
  check: (productId, quantity) =>
    api.get(`/inventory/check?product_id=${encodeURIComponent(productId)}&quantity=${quantity}`),
  lowStock: () => api.get('/inventory/low-stock'),
  history: (productId, limit = 50) =>
    api.get(`/inventory/history/${encodeURIComponent(productId)}?limit=${limit}`),
  update: (productId, data) => api.put(`/inventory/${productId}`, data),
  reserve: (data) => api.post('/inventory/reserve', data),
  release: (data) => api.post('/inventory/release', data),
  adjust: (data) => api.post('/inventory/adjust', data),
};

// --- Orders ---------------------------------------------------------------

export const ordersApi = {
  list: (filters) => api.get(`/orders/${buildQuery(filters)}`),
  get: (id) => api.get(`/orders/${id}`),
  byUser: (userId, filters) => api.get(`/orders/user/${userId}${buildQuery(filters)}`),
  create: (data) => api.post('/orders/', data),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  cancel: (id) => api.delete(`/orders/${id}`),
};