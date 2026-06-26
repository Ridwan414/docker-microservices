import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { productsApi } from '../api/services.js';
import { formatCurrency } from '../utils/format.js';
import { LoadingRow, ErrorBanner } from '../components/StateView.jsx';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    productsApi
      .list({ limit: 8 })
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <section className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Shop the catalog
        </h1>
        <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
          A small storefront that talks to a microservices backend: user auth, products, inventory, and orders.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/products" className="btn-primary">Browse products</Link>
          <Link to="/register" className="btn-secondary">Create an account</Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Featured</h2>
          <Link to="/products" className="text-sm text-brand-600 hover:underline">See all →</Link>
        </div>

        {error && <ErrorBanner error={error} />}
        {loading ? (
          <LoadingRow />
        ) : products.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No products yet — add some via the API.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
      </section>
    </div>
  );
}