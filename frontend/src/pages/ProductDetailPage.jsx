import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { productsApi, inventoryApi } from '../api/services.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import { ErrorBanner, LoadingRow } from '../components/StateView.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [product, setProduct] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const p = await productsApi.get(id);
        if (cancelled) return;
        setProduct(p);
        try {
          const inv = await inventoryApi.get(id);
          if (!cancelled) setInventory(inv);
        } catch {
          // No inventory record yet — fine.
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
  }, [id]);

  async function handleDelete() {
    if (!confirm(`Delete "${product.name}"? This also removes its inventory record.`)) return;
    setBusy(true);
    try {
      await productsApi.remove(id);
      navigate('/products', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleBuyNow() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/products/${id}` } } });
      return;
    }
    // Simple flow: send the user to /checkout with one item preloaded.
    const address = user?.addresses?.find((a) => a.is_default) || user?.addresses?.[0];
    navigate('/checkout', {
      state: {
        items: [{ product_id: id, quantity: 1 }],
        shipping_address: address
          ? {
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              state: address.state,
              postal_code: address.postal_code,
              country: address.country,
            }
          : null,
      },
    });
  }

  if (loading) return <LoadingRow />;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-8"><ErrorBanner error={error} /></div>;
  if (!product) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
        No image
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-brand-600">{product.category}</div>
        <h1 className="text-3xl font-semibold mt-1">{product.name}</h1>
        <div className="text-2xl font-medium mt-3">{formatCurrency(product.price)}</div>

        <p className="mt-4 text-gray-700 leading-relaxed">{product.description}</p>

        {inventory && (
          <div className="mt-6 text-sm">
            <div className="flex gap-4">
              <div>
                <span className="text-gray-500">In stock:</span>{' '}
                <span className="font-medium">{inventory.available_quantity}</span>
              </div>
              <div>
                <span className="text-gray-500">Reserved:</span>{' '}
                <span className="font-medium">{inventory.reserved_quantity}</span>
              </div>
              {inventory.available_quantity <= inventory.reorder_threshold && (
                <span className="badge bg-yellow-100 text-yellow-800">Low stock</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button onClick={handleBuyNow} className="btn-primary" disabled={busy}>
            Buy now
          </button>
          <Link to={`/products/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <button onClick={handleDelete} className="btn-danger" disabled={busy}>
            Delete
          </button>
        </div>

        <div className="mt-8 text-xs text-gray-500">
          <div>Created: {formatDate(product.created_at)}</div>
          <div>Updated: {formatDate(product.updated_at)}</div>
        </div>
      </div>
    </div>
  );
}