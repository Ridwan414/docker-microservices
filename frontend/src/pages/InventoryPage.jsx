import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../api/services.js';
import { ErrorBanner, LoadingRow, EmptyState } from '../components/StateView.jsx';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lowOnly, setLowOnly] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = lowOnly
        ? await inventoryApi.lowStock()
        : await inventoryApi.list({ limit: 50 });
      setItems(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [lowOnly]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      {error && <ErrorBanner error={error} />}

      {loading ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <EmptyState
          title={lowOnly ? 'Nothing under threshold' : 'No inventory yet'}
          description={lowOnly ? 'All products are above their reorder thresholds.' : 'Create a product to seed its inventory.'}
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Product ID</th>
                <th className="px-4 py-2 font-medium">Available</th>
                <th className="px-4 py-2 font-medium">Reserved</th>
                <th className="px-4 py-2 font-medium">Reorder at</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => {
                const isLow = it.available_quantity <= it.reorder_threshold;
                return (
                  <tr key={it.id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{it.product_id}</td>
                    <td className="px-4 py-2">{it.available_quantity}</td>
                    <td className="px-4 py-2">{it.reserved_quantity}</td>
                    <td className="px-4 py-2">{it.reorder_threshold}</td>
                    <td className="px-4 py-2">
                      {isLow ? (
                        <span className="badge bg-yellow-100 text-yellow-800">Low</span>
                      ) : (
                        <span className="badge bg-green-100 text-green-800">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/inventory/${encodeURIComponent(it.product_id)}`}
                        className="text-brand-600 hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}