import type { ReactNode } from 'react';

// ─── Brand ────────────────────────────────────────────────────────────────────

export function Wordmark() {
  return (
    <span className="font-display text-lg font-bold tracking-tight text-ink">
      BetterRoads<span className="text-saffron">.</span>
    </span>
  );
}

// ─── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-bg-2 ${className}`}>{children}</div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 px-4 py-3 text-sm text-ink-2">
      <span className="font-medium text-ink">Couldn’t load.</span> {message}
    </div>
  );
}

export function LoadingNote({ label = 'Loading…' }: { label?: string }) {
  return <p className="eyebrow animate-pulse py-8 text-center">{label}</p>;
}

// ─── Table primitives ─────────────────────────────────────────────────────────

export function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-4 py-2.5 text-xs font-medium text-ink-2 ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  muted = false,
  mono = false,
}: {
  children: ReactNode;
  right?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={[
        'whitespace-nowrap px-4 py-2.5 text-sm',
        right ? 'text-right tabular-nums' : 'text-left',
        muted ? 'text-ink-2' : 'text-ink',
        mono ? 'font-mono text-xs' : '',
      ].join(' ')}
    >
      {children}
    </td>
  );
}

/**
 * Card-wrapped table shell: header row, dim-while-refetching body, empty
 * state, and the pager footer.
 */
export function TableCard({
  head,
  children,
  colCount,
  rowCount,
  emptyLabel,
  loading,
  offset,
  limit,
  total,
  onOffset,
}: {
  head: ReactNode;
  children: ReactNode;
  colCount: number;
  rowCount: number;
  emptyLabel: string;
  loading: boolean;
  offset: number;
  limit: number;
  total: number;
  onOffset: (offset: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <table className="w-full border-collapse">
          <thead className="border-b border-line">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rowCount === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-ink-3">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      <Pager offset={offset} limit={limit} total={total} loading={loading} onOffset={onOffset} />
    </Card>
  );
}

// ─── Pager ────────────────────────────────────────────────────────────────────

function PagerButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:pointer-events-none disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function Pager({
  offset,
  limit,
  total,
  loading,
  onOffset,
}: {
  offset: number;
  limit: number;
  total: number;
  loading: boolean;
  onOffset: (offset: number) => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3">
      <p className="text-xs tabular-nums text-ink-2">
        {from.toLocaleString('en')}–{to.toLocaleString('en')} of {total.toLocaleString('en')}
      </p>
      <div className="flex gap-2">
        <PagerButton
          label="← Prev"
          disabled={loading || offset === 0}
          onClick={() => onOffset(Math.max(0, offset - limit))}
        />
        <PagerButton
          label="Next →"
          disabled={loading || offset + limit >= total}
          onClick={() => onOffset(offset + limit)}
        />
      </div>
    </div>
  );
}

// ─── Screen header ────────────────────────────────────────────────────────────

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
    </div>
  );
}
