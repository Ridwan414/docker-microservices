import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usersApi } from '../api/services.js';
import { ErrorBanner } from '../components/StateView.jsx';

function ProfileForm() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function update(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setSuccess(false);
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await usersApi.updateMe({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
      });
      await refreshUser();
      setSuccess(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-4">Profile</h2>
      {error && <div className="mb-4"><ErrorBanner error={error} onClose={() => setError(null)} /></div>}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded text-sm">
          Profile updated.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" value={form.first_name} onChange={update('first_name')} required />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" value={form.last_name} onChange={update('last_name')} required />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={update('email')} required />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={update('phone')} />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ current_password: '', new_password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      await usersApi.changePassword(form);
      setForm({ current_password: '', new_password: '' });
      setSuccess(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-4">Change password</h2>
      {error && <div className="mb-4"><ErrorBanner error={error} onClose={() => setError(null)} /></div>}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded text-sm">
          Password updated.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current password</label>
          <input
            type="password"
            required
            className="input"
            value={form.current_password}
            onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            type="password"
            required
            minLength={6}
            className="input"
            value={form.new_password}
            onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}

function AddressesSection({ addresses, onChanged }) {
  const empty = {
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    is_default: false,
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function update(field) {
    return (e) => {
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [field]: v }));
    };
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.line2) delete payload.line2;
      await usersApi.createAddress(payload);
      setForm(empty);
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this address?')) return;
    try {
      await usersApi.deleteAddress(id);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-4">Addresses</h2>

      {error && <div className="mb-4"><ErrorBanner error={error} onClose={() => setError(null)} /></div>}

      {addresses.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">No addresses on file.</p>
      ) : (
        <ul className="divide-y divide-gray-200 mb-6">
          {addresses.map((a) => (
            <li key={a.id} className="py-3 flex justify-between items-start gap-3">
              <div className="text-sm">
                <div className="font-medium text-gray-900">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}
                </div>
                <div className="text-gray-600">
                  {a.city}, {a.state} {a.postal_code} · {a.country}
                </div>
                {a.is_default && (
                  <span className="badge bg-brand-100 text-brand-700 mt-1">Default</span>
                )}
              </div>
              <button onClick={() => handleDelete(a.id)} className="text-sm text-red-600 hover:underline">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700">Add a new address</h3>
        <div>
          <label className="label">Address line 1</label>
          <input className="input" required value={form.line1} onChange={update('line1')} />
        </div>
        <div>
          <label className="label">Address line 2 (optional)</label>
          <input className="input" value={form.line2} onChange={update('line2')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">City</label>
            <input className="input" required value={form.city} onChange={update('city')} />
          </div>
          <div>
            <label className="label">State / Province</label>
            <input className="input" required value={form.state} onChange={update('state')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Postal code</label>
            <input className="input" required value={form.postal_code} onChange={update('postal_code')} />
          </div>
          <div>
            <label className="label">Country</label>
            <input className="input" required value={form.country} onChange={update('country')} />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_default} onChange={update('is_default')} />
          Set as default
        </label>
        <div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add address'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="text-sm text-gray-500">Manage your profile, password, and shipping addresses.</p>
      </header>

      <ProfileForm />
      <PasswordForm />
      <AddressesSection addresses={user?.addresses || []} onChanged={refreshUser} />
    </div>
  );
}