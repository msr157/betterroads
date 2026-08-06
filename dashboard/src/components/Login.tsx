import { useState, type FormEvent } from 'react';
import { ApiError, apiPost, type LoginResponse } from '@/lib/api';
import { Wordmark } from '@/components/ui';

export default function Login({ onConnect }: { onConnect: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = username.trim().length > 0 && password.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setError('');
    try {
      const res = await apiPost<LoginResponse>('/api/admin/auth/login', {
        username: username.trim(),
        password,
      });
      onConnect(res.token);
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
          <label htmlFor="admin-username" className="block text-sm font-medium text-ink">
            Username
          </label>
          <input
            id="admin-username"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-saffron-deep focus:outline-none"
          />

          <label htmlFor="admin-password" className="mt-4 block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-saffron-deep focus:outline-none"
          />

          {error ? <p className="mt-3 text-sm text-ink-2">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || !ready}
            className="mt-5 w-full rounded-lg bg-saffron-deep px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-3">
          Your session is kept in this browser only.
        </p>
      </div>
    </div>
  );
}
