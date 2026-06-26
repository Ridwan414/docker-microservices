import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ordersApi, productsApi, inventoryApi } from '../api/services.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency } from '../utils/format.js';
import { ErrorBanner, LoadingRow } from '../components/StateView.jsx';

// Checkout page.
//
// Sources `items` and `shipping_address` either from router state (when arriving
// from a product page or cart) or from localStorage (when arriving directly).
// Falls back to the user's default address if none was supplied.

const STORAGE_KEY = 'ms.cart';

function readCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Items either from router state or saved cart
  const [items, setItems] = useState(() => {
    const fromState = location.state?.items;
    if (fromState && fromState.length) return fromState;
    return readCart();
  });

  const [address, setAddress] = useState(() => {
    const fromState = location.state?.shipping_address;
    if (fromState) return fromState;
    const def = user?.addresses?.find((a) => a.is_default) || user?.addresses?.[0];
    if (def) {
      return {
        line1: def.line1,
        line2: def.line2,
        city: def.city,
        state: def.state,
        postal_code: def.postal_code,
        country: def.country,
      };
    }
    return { line1: '', line2: '', city: '', state: '', postal_code: '', country: '' };
  });

  // Hydrate product details (price + name) for every line item
  const [details, setDetails] = useState({});
  const [checks, setChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const det = {};
        const chk = {};
        await Promise.all(
          items.map(async (it) => {
            try {
              const p = await productsApi.get(it.product_id);
              det[it.product_id] = p;
              const c = await inventoryApi.check(it.product_id, it.quantity).catch(() => null);
              chk[it.product_id] = c;
            } catch (err) {
              chk[it.product_id] = { error: err.message };
            }
          }),
        );
        if (!cancelled) {
          setDetails(det);
          setChecks(chk);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const total = useMemo(() => {
    return items.reduce((sum, it) => {
      const price = details[it.product_id]?.price ?? 0;
      return sum + price * it.quantity;
    }, 0);
  }, [items, details]);

  function updateItem(idx, patch) {
    setItems((arr) => {
      const next = arr.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      writeCart(next);
      return next;
    });
  }

  function removeItem(idx) {
    setItems((arr) => {
      const next = arr.filter((_, i) => i !== idx);
      writeCart(next);
      return next;
    });
  }

  function updateAddress(field) {
    return (e) => setAddress((a) => ({ ...a, [field]: e.target.value }));
  }

  async function handlePlaceOrder() {
    if (items.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      // Backend expects each item with price; we send the canonical product price.
      const payload = {
        user_id: String(user.id),
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          price: details[it.product_id]?.price ?? 0,
        })),
        shipping_address: {
          line1: address.line1,
          line2: address.line2 || undefined,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country,
        },
      };
      const order = await ordersApi.create(payload);
      writeCart([]);
      navigate(`/orders/${order._id}`, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingRow />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      {error && <ErrorBanner error={error} onClose={() => setError(null)} />}

      <section className="card">
        <h2 className="font-semibold mb-3">Items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Your cart is empty.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((it, idx) => {
              const d = details[it.product_id];
              const c = checks[it.product_id];
              const enough = c && c.sufficient;
              const lineTotal = (d?.price ?? 0) * it.quantity;
              return (
                <li key={`${it.product_id}-${idx}`} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">
                      {d?.name || it.product_id}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{it.product_id}</div>
                    {!c ? (
                      <div className="text-xs text-gray-400">Checking inventory…</div>
                    ) : c.error ? (
                      <div className="text-xs text-red-600">{c.error}</div>
                    ) : enough ? (
                      <div className="text-xs text-green-700">
                        In stock ({c.available} available)
                      </div>
                    ) : (
                      <div className="text-xs text-red-600">
                        Only {c.available} available — please reduce quantity.
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    className="input w-20"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <div className="text-sm font-medium w-24 text-right">
                    {formatCurrency(lineTotal)}
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-sm text-red-600 hover:underline"
                    aria-label="Remove item"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t pt-3 mt-3 flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Shipping address</h2>
        <div>
          <label className="label">Address line 1</label>
          <input className="input" required value={address.line1} onChange={updateAddress('line1')} />
        </div>
        <div>
          <label className="label">Address line 2 (optional)</label>
          <input className="input" value={address.line2 || ''} onChange={updateAddress('line2')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">City</label>
            <input className="input" required value={address.city} onChange={updateAddress('city')} />
          </div>
          <div>
            <label className="label">State</label>
            <input className="input" required value={address.state} onChange={updateAddress('state')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Postal code</label>
            <input className="input" required value={address.postal_code} onChange={updateAddress('postal_code')} />
          </div>
          <div>
            <label className="label">Country</label>
            <input className="input" required value={address.country} onChange={updateAddress('country')} />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/products')} className="btn-secondary">
          Continue shopping
        </button>
        <button
          onClick={handlePlaceOrder}
          className="btn-primary"
          disabled={busy || items.length === 0}
        >
          {busy ? 'Placing order…' : 'Place order'}
        </button>
      </div>
    </div>
  );
}