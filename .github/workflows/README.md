# CI Pipeline

`.github/workflows/ci.yml` builds and pushes a Docker image per service to Docker
Hub, but only for services whose source changed.

## How it works

Triggered on every `push` to `main`.

1. **`changes` job** uses `dorny/paths-filter` to flag each service whose files
   (or `docker-compose*.yml` or this workflow file) changed in the push. Each
   flag is exposed as a job output.
2. **One job per service** (`user-service`, `product-service`, `inventory-service`,
   `order-service`, `frontend`) runs only if its flag is `true`. Unchanged
   services are skipped entirely.
3. Each job builds the service's `Dockerfile` and pushes it to Docker Hub
   with two tags: `:latest` and `:v0.0.<run-number>` (the workflow's GitHub
   Actions run counter, e.g. `v0.0.42`).

## Required secrets

Set in **Settings -> Secrets and variables -> Actions**:

| Secret | Purpose |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub account — also used as the image namespace. |
| `DOCKERHUB_TOKEN` | Docker Hub access token (or password). |

Resulting image names:

```
<username>/docker-microservices-user-service
<username>/docker-microservices-product-service
<username>/docker-microservices-inventory-service
<username>/docker-microservices-order-service
<username>/docker-microservices-frontend
```

## What triggers a rebuild

A service rebuilds when **any** of these change:

- its own directory (e.g. `user-service/**`)
- `docker-compose*.yml` (compose affects every service)
- `.github/workflows/ci.yml` (workflow changed)

A change to docs (`README.md`), `Makefile`, etc. will not rebuild anything.

## Examples

| Push contents | What runs |
| --- | --- |
| `user-service/app/main.py` | `user-service` only |
| `frontend/src/App.jsx` | `frontend` only |
| `docker-compose.yml` | all 5 services |
| `.github/workflows/ci.yml` | all 5 services |
| `README.md` | nothing |
