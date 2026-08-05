import { useEffect, useState } from 'react';
import { ApiError, apiGet } from './api';

const PAGE_SIZE = 50;

export interface PagedState<Row> {
  /** null until the first page has loaded. */
  rows: Row[] | null;
  total: number;
  offset: number;
  limit: number;
  loading: boolean;
  error: string;
  setOffset: (offset: number) => void;
}

/**
 * Fetches one page of a paginated admin endpoint. On page change the
 * previous rows are kept on screen (rendered dimmed by the caller) so the
 * table never flashes to a skeleton.
 *
 * `pick` must be referentially stable (define it at module scope).
 */
export function usePaged<Resp extends { total: number }, Row>(
  path: string,
  token: string,
  pick: (body: Resp) => Row[],
  onAuthError: () => void,
): PagedState<Row> {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    apiGet<Resp>(`${path}?limit=${PAGE_SIZE}&offset=${offset}`, token)
      .then((body) => {
        if (cancelled) return;
        setRows(pick(body));
        setTotal(body.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onAuthError();
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, token, offset, pick, onAuthError]);

  return { rows, total, offset, limit: PAGE_SIZE, loading, error, setOffset };
}
