import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../api/services.js';
import { formatCurrency } from '../utils/format.js';
import { ErrorBanner, LoadingRow, EmptyState } from '../components/StateView.jsx';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ category: '', min_price: '', max_price: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.list(filters);
      setProducts(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    productsApi.categories().then((d) => setCategories(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function update(field) {
    return (e) => setFilters((f) => ({ ...f, [field]: e.target.value }));
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link to="/products/new" className="btn-primary text-sm">Add product</Link>
      </div>

      <div className="card mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Category</label>
          <select className="input" value={filters.category} onChange={update('category')}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Min price</label>
          <input type="number" min="0" className="input" value={filters.min_price} onChange={update('min_price')} />
        </div>
        <div>
          <label className="label">Max price</label>
          <input type="number" min="0" className="input" value={filters.max_price} onChange={update('max_price')} />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => setFilters({ category: '', min_price: '', max_price: '' })}
            className="btn-secondary w-full"
          >
            Reset
          </button>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}
      {loading ? (
        <LoadingRow />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products match"
          description="Try clearing your filters, or add the first product."
          action={<Link to="/products/new" className="btn-primary">Add product</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <Link
              key={p._id}
              to={`/products/${p._id}`}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center text-gray-400 text-sm">
                No image
              </div>
              <div className="text-xs text-brand-600 uppercase tracking-wide">{p.category}</div>
              <div className="font-medium text-gray-900 truncate">{p.name}</div>
              <div className="mt-1 text-sm text-gray-700">{formatCurrency(p.price)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}