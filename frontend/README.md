# Frontend — Microservices Shop

React + Vite single-page app that talks to the four FastAPI backend services
(user, product, inventory, order). Nginx inside the frontend container serves
the SPA and reverse-proxies `/api/*` to the right FastAPI service.

## Stack

- **Vite 5** + **React 18** (JavaScript)
- **Tailwind CSS v3** for styling
- **React Router v6** for routing
- No global state library — `AuthContext` + service modules only

## Project layout

```
frontend/
├── Dockerfile             # Multi-stage: Node build → nginx runtime
├── nginx.conf             # Serves SPA, routes /api/<service>/... to FastAPI
├── index.html             # Vite entry
├── vite.config.js         # Dev proxy for /api (configurable via VITE_API_TARGET)
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── main.jsx           # ReactDOM bootstrap
    ├── App.jsx            # BrowserRouter + AuthProvider + Navbar
    ├── index.css          # Tailwind layers + reusable component classes
    ├── routes/AppRoutes.jsx
    ├── api/
    │   ├── client.js      # Fetch wrapper: auth, refresh, ApiError
    │   └── services.js    # Per-backend service modules
    ├── context/AuthContext.jsx
    ├── components/        # Navbar, ProtectedRoute, StateView, etc.
    ├── pages/             # One file per top-level route
    └── utils/             # format.js (money/dates), storage.js (tokens)
```

## How requests reach the backend

```
Browser → frontend:80 (nginx) → user-service:8000 / product-service:8001 /
                                inventory-service:8002 / order-service:8003
```

- In **Docker** the frontend container's nginx serves the static SPA and
  reverse-proxies `/api/<service>/...` to the matching FastAPI container by
  URL prefix (see `nginx.conf`).
- In **dev** (`npm run dev`), Vite's dev server proxies `/api` to whatever
  `VITE_API_TARGET` points at (defaults to `http://localhost:8080`). The
  easiest way to run this locally is to start the backend stack with
  `make up` and either:
  - point `VITE_API_TARGET` at the frontend container's exposed port
    (`http://localhost:3000`) — its nginx will route the same way as in
    production, or
  - point `VITE_API_TARGET` at a single FastAPI service for one-off testing.

## Auth flow

- Login posts to `/api/v1/auth/login` as `application/x-www-form-urlencoded`
  (the backend uses `OAuth2PasswordRequestForm`).
- `access_token` and `refresh_token` are persisted to `localStorage`.
- The API client attaches `Authorization: Bearer <access>` to every request.
- On a `401`, it transparently calls `/api/v1/auth/refresh` (single-flight,
  so concurrent requests share one refresh) and retries the original request.
- If refresh fails, tokens are cleared and a `ms:auth-expired` event is
  dispatched, which logs the user out and redirects to `/login`.

## Scripts

```bash
npm install          # install deps
npm run dev          # dev server on :5173 with HMR
npm run build        # production build into ./dist
npm run preview      # serve the built bundle locally
```

## Environment variables

| Var               | Used by     | Default                  | Purpose                              |
| ----------------- | ----------- | ------------------------ | ------------------------------------ |
| `VITE_API_TARGET` | dev only    | `http://localhost:3000`  | Where Vite's dev server proxies /api (default = frontend nginx) |

In Docker, the API URL is fixed at `/api` (same-origin via nginx) so no env
vars are required.

## Endpoints covered

| Page                | Backend calls                                                                  |
| ------------------- | ------------------------------------------------------------------------------ |
| `/login`            | `POST /auth/login` → `GET /users/me`                                           |
| `/register`         | `POST /auth/register` → `POST /auth/login` → `GET /users/me`                   |
| `/products`         | `GET /products?…`, `GET /products/category/list`                               |
| `/products/:id`     | `GET /products/:id`, `GET /inventory/:id`, `DELETE /products/:id`              |
| `/products/new`     | `POST /products`                                                               |
| `/products/:id/edit`| `GET /products/:id`, `PUT /products/:id`                                       |
| `/profile`          | `GET/PUT /users/me`, `PUT /users/me/password`, `GET/POST/DELETE /users/me/addresses` |
| `/orders`           | `GET /orders/user/:id`                                                         |
| `/orders/:id`       | `GET /orders/:id`, `PUT /orders/:id/status`, `DELETE /orders/:id`              |
| `/checkout`         | `GET /products/:id`, `GET /inventory/check`, `POST /orders`                    |
| `/inventory`        | `GET /inventory?…`, `GET /inventory/low-stock`                                 |
| `/inventory/:pid`   | `GET /inventory/:id`, `GET /products/:id`, `GET /inventory/history/:id`, `PUT /inventory/:id`, `POST /inventory/adjust` |

## Docker

The frontend is part of the main `docker-compose.yml`. From the repo root:

```bash
docker compose up -d --build frontend    # build & run just the frontend
docker compose up -d --build            # or build everything
```

The frontend will be available on `http://localhost:3000`. The four FastAPI
services remain reachable directly on `8010/8001/8002/8003` for debugging.