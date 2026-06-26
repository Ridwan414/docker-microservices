import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../api/services.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency, formatDate, statusBadgeClass } from '../utils/format.js';
import { ErrorBanner, LoadingRow, EmptyState } from '../components/StateView.jsx';

const STATUS_OPTIONS = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ordersApi.byUser(String(user.id), {
        status: status || undefined,
        limit: 50,
      });
      setOrders(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">My orders</h1>
        <Link to="/products" className="btn-primary text-sm">Continue shopping</Link>
      </div>

      <div className="card mb-6 flex items-center gap-3">
        <label className="text-sm text-gray-600">Filter by status:</label>
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <ErrorBanner error={error} />}
      {loading ? (
        <LoadingRow />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Place your first order from the product catalog."
          action={<Link to="/products" className="btn-primary">Browse products</Link>}
        />
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o._id}>
                  <td className="px-4 py-2 font-mono text-xs">{o._id.slice(-8)}</td>
                  <td className="px-4 py-2">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-2">{o.items.length}</td>
                  <td className="px-4 py-2">{formatCurrency(o.total_price)}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/orders/${o._id}`} className="text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}