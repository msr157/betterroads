import { useState, type FormEvent } from 'react';
import { ApiError, apiGet, type OverviewResponse } from '@/lib/api';
import { Wordmark } from '@/components/ui';

export default function Login({ onConnect }: { onConnect: (token: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const token = value.trim();
    if (!token || busy) return;

    setBusy(true);
    setError('');
    try {
      // Any authenticated endpoint proves the token; overview is the cheapest.
      await apiGet<OverviewResponse>('/api/admin/overview', token);
      onConnect(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark />
          <p className="eyebrow mt-3">Admin console</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-line bg-bg-2 p-6"
        >
          <label htmlFor="admin-token" className="block text-sm font-medium text-ink">
            Admin token
          </label>
          <input
            id="admin-token"
            type="password"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste ADMIN_TOKEN"
            className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-3 focus:border-saffron-deep focus:outline-none"
          />

          {error ? <p className="mt-3 text-sm text-ink-2">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="mt-4 w-full rounded-lg bg-saffron-deep px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-3">
          The token is checked against the backend’s ADMIN_TOKEN and kept in this browser only.
        </p>
      </div>
    </div>
  );
}
