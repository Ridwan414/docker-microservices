#!/usr/bin/env bash
# seed.sh — populate the microservices stack with data from ./data/*.json
#
# Usage:
#   ./seed.sh                 # seed against default URLs
#   USER_URL=... ./seed.sh    # override user-service base URL
#   RESET=1 ./seed.sh         # delete products first (best-effort)
#
# Required tools: bash 4+, curl, jq
#
# Order matters because of service dependencies:
#   1. users    → POST /auth/register, then POST /users/me/addresses
#   2. products → POST /products  (also seeds inventory on the inventory-service)
#   3. orders   → POST /orders    (requires a user_id + product_id + address)
#
# Inventory records are not seeded directly — they're auto-created by the
# product-service when each product is POSTed.

set -euo pipefail

# --- Config ----------------------------------------------------------------

USER_URL="${USER_URL:-http://localhost:8010}"
PRODUCT_URL="${PRODUCT_URL:-http://localhost:8001}"
ORDER_URL="${ORDER_URL:-http://localhost:8003}"
# If set, this single base URL is used for every request. Must route by
# /api/v1/<service>/... (e.g. the frontend container at :3000, or a custom
# reverse proxy). Leave empty to hit each service directly on its host port.
API_BASE="${API_BASE:-}"
DATA_DIR="${DATA_DIR:-$(cd "$(dirname "$0")" && pwd)/data}"
RESET="${RESET:-0}"

if [[ -n "$API_BASE" ]]; then
  USER_BASE="${API_BASE%/}"
  PRODUCT_BASE="${API_BASE%/}"
  ORDER_BASE="${API_BASE%/}"
else
  USER_BASE="$USER_URL"
  PRODUCT_BASE="$PRODUCT_URL"
  ORDER_BASE="$ORDER_URL"
fi

# --- Pretty output ---------------------------------------------------------

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_DIM=$'\033[2m'
  C_BOLD=$'\033[1m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_BLUE=$'\033[34m'
else
  C_RESET="" C_DIM="" C_BOLD="" C_GREEN="" C_YELLOW="" C_RED="" C_BLUE=""
fi

step()  { printf "\n%s==>%s %s\n" "$C_BLUE" "$C_RESET" "$*"; }
ok()    { printf "  %s✓%s %s\n" "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf "  %s!%s %s\n" "$C_YELLOW" "$C_RESET" "$*"; }
err()   { printf "  %s✗%s %s\n" "$C_RED"   "$C_RESET" "$*" >&2; }
dim()   { printf "    %s%s%s\n" "$C_DIM" "$*" "$C_RESET"; }

# --- Pre-flight ------------------------------------------------------------

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "missing required tool: $1"
    exit 1
  fi
}
require curl
require jq

# Best-effort health probe so we don't blow up with cryptic errors later.
check_service() {
  local name="$1" url="$2"
  if ! curl -fsS -o /dev/null --max-time 5 "$url" 2>/dev/null; then
    err "$name not reachable at $url"
    err "start the stack first: make up"
    exit 1
  fi
}

step "Checking services are reachable"
check_service "user-service"     "${USER_BASE%/api/v1}/health"
check_service "product-service"  "${PRODUCT_BASE%/api/v1}/health"
check_service "order-service"    "${ORDER_BASE%/api/v1}/health"

# --- Helpers ---------------------------------------------------------------

# http POST that captures both body and status code.
# usage: http_post <base_url> <path> <json> [bearer_token]
http_post() {
  local base="$1" path="$2" body="$3" token="${4:-}"
  local url="${base%/api/v1}${path}"
  local args=(-sS -w '\n%{http_code}' -H 'Content-Type: application/json'
              -X POST --data "$body")
  if [[ -n "$token" ]]; then args+=(-H "Authorization: Bearer $token"); fi
  curl "${args[@]}" "$url"
}

http_delete() {
  local base="$1" path="$2" token="${3:-}"
  local url="${base%/api/v1}${path}"
  local args=(-sS -w '\n%{http_code}' -X DELETE)
  if [[ -n "$token" ]]; then args+=(-H "Authorization: Bearer $token"); fi
  curl "${args[@]}" "$url"
}

# Split the curl output (body\ncode) into BODY and CODE.
split_response() {
  BODY="$(printf '%s' "$1" | sed '$d')"
  CODE="$(printf '%s' "$1" | tail -n1)"
}

# --- Optional reset (best-effort) ------------------------------------------

if [[ "$RESET" == "1" ]]; then
  step "Resetting existing products (best-effort)"
  existing_ids=$(curl -fsS "${PRODUCT_BASE%/api/v1}/api/v1/products?limit=100" \
    | jq -r '.[]._id' || true)
  if [[ -n "${existing_ids:-}" ]]; then
    echo "$existing_ids" | while read -r pid; do
      [[ -z "$pid" ]] && continue
      out=$(http_delete "$PRODUCT_BASE" "/api/v1/products/$pid" "" || true)
      split_response "$out"
      if [[ "$CODE" =~ ^2 ]]; then ok "deleted $pid"; else dim "skip $pid ($CODE)"; fi
    done
  else
    dim "no existing products"
  fi
fi

# --- 1. Users --------------------------------------------------------------

step "Seeding users (from $(basename "$DATA_DIR")/users.json)"
declare -A USER_IDS   # email -> user id
declare -A USER_TOKENS

users_count=$(jq 'length' "$DATA_DIR/users.json")
for ((i = 0; i < users_count; i++)); do
  user_json=$(jq -c ".[$i]" "$DATA_DIR/users.json")
  email=$(jq -r '.email' <<<"$user_json")

  # Register (ignore 400 "already registered").
  out=$(http_post "$USER_BASE" "/api/v1/auth/register" "$user_json" "")
  split_response "$out"
  case "$CODE" in
    201)
      uid=$(jq -r '.id' <<<"$BODY")
      ok "registered $email (id=$uid)"
      ;;
    400)
      warn "$email already registered, will log in instead"
      # We need an id. Fetch /users/me after login to get it.
      uid=""
      ;;
    *)
      err "register failed for $email: $CODE $BODY"
      exit 1
      ;;
  esac

  # Login (form-encoded for OAuth2PasswordRequestForm).
  password=$(jq -r '.password' <<<"$user_json")
  login_body="username=$(printf '%s' "$email" | jq -sRr @uri)&password=$(printf '%s' "$password" | jq -sRr @uri)"
  login_out=$(curl -sS -w '\n%{http_code}' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data "$login_body" \
    "${USER_BASE%/api/v1}/api/v1/auth/login")
  split_response "$login_out"
  if [[ "$CODE" != "200" ]]; then
    err "login failed for $email: $CODE $BODY"
    exit 1
  fi
  token=$(jq -r '.access_token' <<<"$BODY")
  ok "logged in $email"

  # Resolve user id if we didn't get one from registration.
  if [[ -z "${uid:-}" ]]; then
    me_out=$(curl -sS -H "Authorization: Bearer $token" \
      "${USER_BASE%/api/v1}/api/v1/users/me")
    uid=$(jq -r '.id' <<<"$me_out")
  fi

  USER_IDS["$email"]="$uid"
  USER_TOKENS["$email"]="$token"

  # Attach default address if provided.
  addr=$(jq -c '.address // null' <<<"$user_json")
  if [[ "$addr" != "null" ]]; then
    out=$(http_post "$USER_BASE" "/api/v1/users/me/addresses" "$addr" "$token")
    split_response "$out"
    if [[ "$CODE" =~ ^2 ]]; then
      ok "  + default address"
    elif [[ "$CODE" == "400" ]] && grep -qi "is_default" <<<"$BODY"; then
      dim "  address already exists"
    else
      warn "  address create returned $CODE: $BODY"
    fi
  fi
done

# --- 2. Products -----------------------------------------------------------

step "Seeding products (from $(basename "$DATA_DIR")/products.json)"
declare -A PRODUCT_IDS   # name -> product id
declare -A PRODUCT_PRICES

prod_count=$(jq 'length' "$DATA_DIR/products.json")
for ((i = 0; i < prod_count; i++)); do
  p_json=$(jq -c ".[$i]" "$DATA_DIR/products.json")
  name=$(jq -r '.name' <<<"$p_json")

  out=$(http_post "$PRODUCT_BASE" "/api/v1/products/" "$p_json" "")
  split_response "$out"
  case "$CODE" in
    201)
      pid=$(jq -r '._id' <<<"$BODY")
      price=$(jq -r '.price' <<<"$BODY")
      PRODUCT_IDS["$name"]="$pid"
      PRODUCT_PRICES["$name"]="$price"
      ok "created $name (id=$pid, price=$price)"
      ;;
    400)
      # Likely duplicate or validation error; look it up by name to keep going.
      warn "$name not created ($CODE). Trying lookup…"
      existing=$(curl -fsS "${PRODUCT_BASE%/api/v1}/api/v1/products?limit=100" \
        | jq --arg n "$name" '.[] | select(.name == $n) | ._id' \
        | head -n1 || true)
      if [[ -n "${existing:-}" ]]; then
        PRODUCT_IDS["$name"]="$existing"
        PRODUCT_PRICES["$name"]=$(jq -r '.price' <<<"$p_json")
        ok "  using existing id=$existing"
      else
        err "  could not resolve existing product for $name"
      fi
      ;;
    *)
      err "create product failed for $name: $CODE $BODY"
      exit 1
      ;;
  esac
done

# --- 3. Orders -------------------------------------------------------------

step "Seeding orders (from $(basename "$DATA_DIR")/orders.json)"

order_count=$(jq 'length' "$DATA_DIR/orders.json")
for ((i = 0; i < order_count; i++)); do
  o_json=$(jq -c ".[$i]" "$DATA_DIR/orders.json")
  email=$(jq -r '.user_email' <<<"$o_json")
  token="${USER_TOKENS[$email]:-}"
  uid="${USER_IDS[$email]:-}"

  if [[ -z "$token" || -z "$uid" ]]; then
    err "no token/uid for $email — cannot create order"
    continue
  fi

  # Resolve product ids/names to {product_id, quantity, price} entries.
  items_json="[]"
  item_names=$(jq -r '.items | length' <<<"$o_json")
  for ((j = 0; j < item_names; j++)); do
    item_name=$(jq -r ".items[$j].name" <<<"$o_json")
    item_qty=$(jq -r ".items[$j].quantity" <<<"$o_json")
    pid="${PRODUCT_IDS[$item_name]:-}"
    price="${PRODUCT_PRICES[$item_name]:-}"
    if [[ -z "$pid" || -z "$price" ]]; then
      err "  unknown product in order: $item_name"
      continue 2
    fi
    items_json=$(jq --argjson arr "$items_json" \
      --arg pid "$pid" --argjson qty "$item_qty" --argjson price "$price" \
      '$arr + [{product_id: $pid, quantity: $qty, price: $price}]' <<<"null")
  done

  order_payload=$(jq -n \
    --arg uid "$uid" \
    --argjson items "$items_json" \
    --argjson addr "$(jq -c '.shipping_address' <<<"$o_json")" \
    '{user_id: $uid, items: $items, shipping_address: $addr}')

  out=$(http_post "$ORDER_BASE" "/api/v1/orders/" "$order_payload" "")
  split_response "$out"
  if [[ "$CODE" =~ ^2 ]]; then
    oid=$(jq -r '._id' <<<"$BODY")
    total=$(jq -r '.total_price' <<<"$BODY")
    ok "order for $email — id=$oid total=$total"
  else
    err "order failed for $email: $CODE $BODY"
  fi
done

# --- Summary ---------------------------------------------------------------

step "Done"
printf "  users:    %d\n" "$users_count"
printf "  products: %d\n" "$prod_count"
printf "  orders:   %d\n" "$order_count"
dim "frontend: http://localhost:3000"
dim "user-service:     $USER_BASE"
dim "product-service:  $PRODUCT_BASE"
dim "order-service:    $ORDER_BASE"