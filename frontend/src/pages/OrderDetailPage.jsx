import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersApi } from '../api/services.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency, formatDate, statusBadgeClass } from '../utils/format.js';
import { ErrorBanner, LoadingRow } from '../components/StateView.jsx';

const NEXT_STATES = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await ordersApi.get(id);
      setOrder(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus(next) {
    setBusy(true);
    setError(null);
    try {
      await ordersApi.updateStatus(id, next);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!confirm('Cancel this order? Inventory will be released.')) return;
    setBusy(true);
    setError(null);
    try {
      await ordersApi.cancel(id);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingRow />;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-8"><ErrorBanner error={error} /></div>;
  if (!order) return null;

  const isMine = String(order.user_id) === String(user?.id);
  const nextStates = NEXT_STATES[order.status] || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-gray-500">
            <Link to="/orders" className="hover:underline">My orders</Link>
          </div>
          <h1 className="text-2xl font-semibold mt-1">Order {order._id.slice(-8)}</h1>
          <div className="text-sm text-gray-500">Placed {formatDate(order.created_at)}</div>
        </div>
        <span className={`badge ${statusBadgeClass(order.status)} text-sm px-3 py-1`}>
          {order.status}
        </span>
      </header>

      <section className="card">
        <h2 className="font-semibold mb-3">Items</h2>
        <ul className="divide-y divide-gray-100">
          {order.items.map((it, idx) => (
            <li key={idx} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{it.product_id}</div>
                <div className="text-sm text-gray-700">Qty {it.quantity}</div>
              </div>
              <div className="text-sm font-medium">{formatCurrency(it.price * it.quantity)}</div>
            </li>
          ))}
        </ul>
        <div className="border-t pt-3 mt-3 flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(order.total_price)}</span>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Shipping address</h2>
        <div className="text-sm text-gray-700">
          {order.shipping_address.line1}
          {order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ''}
          <br />
          {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
          <br />
          {order.shipping_address.country}
        </div>
      </section>

      {isMine && (nextStates.length > 0) && (
        <section className="card">
          <h2 className="font-semibold mb-3">Manage</h2>
          <div className="flex flex-wrap gap-2">
            {nextStates.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={busy}
                className={
                  s === 'cancelled'
                    ? 'btn-danger'
                    : s === 'delivered' || s === 'shipped'
                      ? 'btn-primary'
                      : 'btn-secondary'
                }
              >
                Mark as {s}
              </button>
            ))}
            {(order.status === 'pending' || order.status === 'paid') && (
              <button onClick={cancelOrder} disabled={busy} className="btn-danger">
                Cancel order
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Cancelling an order automatically releases its reserved inventory.
          </p>
        </section>
      )}
    </div>
  );
}