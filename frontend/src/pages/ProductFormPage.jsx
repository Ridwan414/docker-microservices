import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '../api/services.js';
import { ErrorBanner } from '../components/StateView.jsx';

const empty = { name: '', description: '', category: '', price: '', quantity: '' };

export default function ProductFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    productsApi
      .get(id)
      .then((p) =>
        setForm({
          name: p.name || '',
          description: p.description || '',
          category: p.category || '',
          price: String(p.price ?? ''),
          quantity: String(p.quantity ?? ''),
        }),
      )
      .catch(setError)
      .finally(() => setLoading(false));
  }, [mode, id]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      description: form.description,
      category: form.category.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
    };
    try {
      if (mode === 'edit') {
        // ProductUpdate has all fields optional — only send what the user changed.
        const updatePayload = Object.fromEntries(
          Object.entries(payload).filter(([, v]) => v !== '' && v !== null && !Number.isNaN(v)),
        );
        await productsApi.update(id, updatePayload);
        navigate(`/products/${id}`);
      } else {
        const created = await productsApi.create(payload);
        navigate(`/products/${created._id}`);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="max-w-xl mx-auto px-4 py-12 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">
        {mode === 'edit' ? 'Edit product' : 'New product'}
      </h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && <ErrorBanner error={error} onClose={() => setError(null)} />}
        <div>
          <label className="label">Name</label>
          <input className="input" required value={form.name} onChange={update('name')} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[100px]"
            required
            value={form.description}
            onChange={update('description')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <input className="input" required value={form.category} onChange={update('category')} />
          </div>
          <div>
            <label className="label">Price (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className="input"
              value={form.price}
              onChange={update('price')}
            />
          </div>
        </div>
        <div>
          <label className="label">Initial quantity</label>
          <input
            type="number"
            min="0"
            required
            className="input"
            value={form.quantity}
            onChange={update('quantity')}
          />
          <p className="text-xs text-gray-500 mt-1">
            Creating a product also seeds its inventory record.
          </p>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create product'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}