import { type SignupRow, type SignupsResponse } from '@/lib/api';
import { fmtDateTime, fmtLabel } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';
import { ErrorNote, LoadingNote, ScreenHeader, TableCard, Td, Th } from '@/components/ui';

const pickSignups = (body: SignupsResponse) => body.signups;

/** "road_data,spread_word" → "Road data, spread word". */
function fmtContribution(value: string | null): string {
  if (!value) return '—';
  return value.split(',').map((slug) => fmtLabel(slug)).join(', ');
}

export default function WaitlistTable({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const { rows, total, offset, limit, loading, error, setOffset } = usePaged<
    SignupsResponse,
    SignupRow
  >('/api/admin/signups', token, pickSignups, onAuthError);

  if (!rows && loading) return <LoadingNote label="Loading signups…" />;
  if (error && !rows) return <ErrorNote message={error} />;

  return (
    <div>
      <ScreenHeader
        title="Waitlist"
        subtitle={`${total.toLocaleString('en')} signups, newest first.`}
      />
      {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
      <TableCard
        colCount={6}
        rowCount={rows?.length ?? 0}
        emptyLabel="No signups yet."
        loading={loading}
        offset={offset}
        limit={limit}
        total={total}
        onOffset={setOffset}
        head={
          <>
            <Th right>ID</Th>
            <Th>Email</Th>
            <Th>Name</Th>
            <Th>City</Th>
            <Th>Contribution</Th>
            <Th>Joined</Th>
          </>
        }
      >
        {(rows ?? []).map((s) => (
          <tr key={s.id} className="transition-colors hover:bg-bg-3/60">
            <Td right muted>{s.id}</Td>
            <Td mono>{s.email}</Td>
            <Td>{s.name ?? '—'}</Td>
            <Td muted>{s.city ?? '—'}</Td>
            <Td muted>{fmtContribution(s.contribution)}</Td>
            <Td muted>{fmtDateTime(s.createdAt)}</Td>
          </tr>
        ))}
      </TableCard>
    </div>
  );
}
