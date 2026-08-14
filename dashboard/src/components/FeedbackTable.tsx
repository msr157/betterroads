import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type FeedbackRow = {
  id: number;
  name: string | null;
  email: string | null;
  category: string;
  description: string;
  source: string;
  deviceOs: string | null;
  location: string | null;
  createdAt: string;
};

export default function FeedbackTable({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [data, setData] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiGet<{ feedback: FeedbackRow[] }>('/api/admin/feedback', token)
      .then((res) => { if (active) setData(res.feedback); })
      .catch((err) => { if (active) { setError(err.message); if (err.status === 401) onAuthError(); } });
    return () => { active = false; };
  }, [token, onAuthError]);

  if (error) return <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-red-500">{error}</div>;
  if (!data) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-bg-2" />)}</div>;
  if (data.length === 0) return <div className="py-12 text-center text-ink-2">No feedback received yet.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium tracking-tight">User Feedback</h1>
      <div className="overflow-x-auto rounded-2xl border border-line bg-bg">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bg-2 text-ink-2">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Device & Loc</th>
              <th className="px-4 py-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-bg-2/50">
                <td className="whitespace-nowrap px-4 py-3 align-top">{new Date(row.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 align-top">
                  {row.name ? <span className="font-medium">{row.name}</span> : <span className="text-ink-3">Anonymous</span>}
                  {row.email && <div className="text-xs text-ink-2">{row.email}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  <span className="rounded-full bg-line px-2 py-0.5 text-xs font-medium">{row.category}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="capitalize text-ink-2">{row.source} {row.deviceOs ? `(${row.deviceOs})` : ''}</div>
                  {row.location && <div className="mt-1 text-xs text-ink-3">{row.location}</div>}
                </td>
                <td className="min-w-[300px] px-4 py-3 align-top leading-relaxed">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
