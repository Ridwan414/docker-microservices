import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { inventoryApi, productsApi } from '../api/services.js';
import { ErrorBanner, LoadingRow } from '../components/StateView.jsx';
import { formatDate } from '../utils/format.js';

export default function InventoryDetailPage() {
  const { productId } = useParams();
  const decodedId = decodeURIComponent(productId);

  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Forms
  const [threshold, setThreshold] = useState('');
  const [adjust, setAdjust] = useState({ quantity_change: '', reason: '' });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [inv, hist, prod] = await Promise.all([
        inventoryApi.get(decodedId),
        inventoryApi.history(decodedId, 50).catch(() => []),
        productsApi.get(decodedId).catch(() => null),
      ]);
      setItem(inv);
      setHistory(hist);
      setProduct(prod);
      setThreshold(String(inv.reorder_threshold));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedId]);

  async function handleThreshold(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await inventoryApi.update(decodedId, { reorder_threshold: Number(threshold) });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjust(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        product_id: decodedId,
        quantity_change: Number(adjust.quantity_change),
        reason: adjust.reason || undefined,
      };
      await inventoryApi.adjust(payload);
      setAdjust({ quantity_change: '', reason: '' });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingRow />;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-8"><ErrorBanner error={error} /></div>;
  if (!item) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header>
        <div className="text-xs text-gray-500">
          <Link to="/inventory" className="hover:underline">Inventory</Link> / <span>{decodedId}</span>
        </div>
        <h1 className="text-2xl font-semibold mt-1">
          {product ? product.name : 'Inventory item'}
        </h1>
        <p className="text-sm text-gray-500 font-mono">{decodedId}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-xs text-gray-500 uppercase">Available</div>
          <div className="text-2xl font-semibold mt-1">{item.available_quantity}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase">Reserved</div>
          <div className="text-2xl font-semibold mt-1">{item.reserved_quantity}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase">Reorder at</div>
          <div className="text-2xl font-semibold mt-1">{item.reorder_threshold}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form onSubmit={handleThreshold} className="card space-y-3">
          <h2 className="font-semibold">Reorder threshold</h2>
          <div>
            <label className="label">Threshold</label>
            <input
              type="number"
              min="0"
              className="input"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            Update threshold
          </button>
        </form>

        <form onSubmit={handleAdjust} className="card space-y-3">
          <h2 className="font-semibold">Adjust quantity</h2>
          <div>
            <label className="label">Quantity change (positive or negative)</label>
            <input
              type="number"
              required
              className="input"
              value={adjust.quantity_change}
              onChange={(e) => setAdjust((a) => ({ ...a, quantity_change: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <input
              className="input"
              value={adjust.reason}
              onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            Apply adjustment
          </button>
        </form>
      </div>

      <section className="card">
        <h2 className="font-semibold mb-3">Recent history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No history yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-5 py-2 font-medium">When</th>
                  <th className="px-5 py-2 font-medium">Type</th>
                  <th className="px-5 py-2 font-medium">Change</th>
                  <th className="px-5 py-2 font-medium">From → To</th>
                  <th className="px-5 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-5 py-2 text-gray-600">{formatDate(h.timestamp)}</td>
                    <td className="px-5 py-2 capitalize">{h.change_type}</td>
                    <td className={`px-5 py-2 font-mono ${h.quantity_change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {h.quantity_change > 0 ? `+${h.quantity_change}` : h.quantity_change}
                    </td>
                    <td className="px-5 py-2 font-mono text-gray-600">
                      {h.previous_quantity} → {h.new_quantity}
                    </td>
                    <td className="px-5 py-2 text-xs text-gray-500 font-mono">{h.reference_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}