# Seed data

JSON files in this folder are the source of truth for the demo data that
`make seed` (or `./seed.sh`) loads into the backend. Edit them, re-run
`make seed`, and the stack reflects the new state.

## Files

| File          | Drives                                       | Endpoint(s) hit                                                    |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `users.json`  | `POST /auth/register` + `POST /users/me/addresses` | user-service                                                    |
| `products.json` | `POST /products` (also auto-creates inventory) | product-service                                                 |
| `orders.json` | `POST /orders` (refs product name + user email) | order-service                                                  |

Inventory records are **not** seeded directly — they are auto-created by the
product-service every time a product is posted. To bulk-edit stock, hit the
inventory-service directly or use the frontend's inventory page after seeding.

## File formats

### `users.json`

Top-level: array of users.

```json
{
  "email": "alice@example.com",
  "password": "password123",
  "first_name": "Alice",
  "last_name": "Anderson",
  "phone": "+1-555-0101",
  "address": {
    "line1": "742 Evergreen Terrace",
    "city": "Springfield",
    "state": "OR",
    "postal_code": "97477",
    "country": "USA",
    "is_default": true
  }
}
```

- `phone` and `address` are optional (`null` to skip).
- The seeder logs in after registering, so `password` must be the plaintext
  password — it's not the bcrypt hash.

### `products.json`

```json
{
  "name": "Mechanical Keyboard",
  "description": "75% layout, hot-swappable switches, RGB backlight, USB-C.",
  "category": "Electronics",
  "price": 129.99,
  "quantity": 25
}
```

`quantity` seeds the initial available stock via the inventory auto-create.

### `orders.json`

Orders reference users and products **by display name/email** — the seeder
resolves them to internal IDs at runtime. That makes orders portable: you
can rename a product in `products.json` and the order will still match.

```json
{
  "user_email": "alice@example.com",
  "items": [
    { "name": "Mechanical Keyboard", "quantity": 1 }
  ],
  "shipping_address": {
    "line1": "742 Evergreen Terrace",
    "city": "Springfield",
    "state": "OR",
    "postal_code": "97477",
    "country": "USA"
  }
}
```

If a referenced product name is missing, the order is skipped with an error
printed to stderr.

## How to use

```bash
# 1. Start the stack
make up

# 2. (optional) Validate the JSON without touching the API
make seed-check

# 3. Seed everything
make seed

# Or wipe existing products first, then reseed (best-effort)
make seed-reset
```

### Overriding endpoints

The seeder uses the host ports from `docker-compose.yml` by default. To
talk to a different host (e.g. a deployed stack), override the env vars:

```bash
USER_URL=https://api.example.com \
  PRODUCT_URL=https://api.example.com \
  ORDER_URL=https://api.example.com \
  make seed
```

Or point at the frontend nginx (single base URL that routes by `/api/v1/<service>/...`):

```bash
API_BASE=http://localhost:3000 ./seed.sh
```

## Idempotency

- **Users**: a 400 from `/auth/register` is treated as "already exists" and
  the seeder logs in instead. Safe to re-run.
- **Products**: a 400 (e.g. duplicate name) is also tolerated; the seeder
  looks up the existing product by name and continues. *Note:* the
  product-service has no `name` uniqueness constraint, so duplicates may
  accumulate across runs. Use `make seed-reset` to wipe products first.
- **Orders**: always appended. Re-running `make seed` will create duplicate
  orders. Use `make down-v` for a clean DB, or delete orders manually
  through the order-service.

## Reset to a known state

```bash
make down-v        # deletes postgres + mongo volumes
make up            # rebuild + start
make seed          # load data/users.json, data/products.json, data/orders.json
```