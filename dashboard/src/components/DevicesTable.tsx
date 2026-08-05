import { type DeviceRow, type DevicesResponse } from '@/lib/api';
import { fmtDateTime, fmtLabel } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';
import { ErrorNote, LoadingNote, ScreenHeader, TableCard, Td, Th } from '@/components/ui';

const pickDevices = (body: DevicesResponse) => body.devices;

/** "3f9c2e1a…b7" — enough of a UUID to eyeball, not enough to wrap. */
function shortUuid(uuid: string): string {
  return uuid.length > 14 ? `${uuid.slice(0, 8)}…${uuid.slice(-4)}` : uuid;
}

export default function DevicesTable({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const { rows, total, offset, limit, loading, error, setOffset } = usePaged<
    DevicesResponse,
    DeviceRow
  >('/api/admin/devices', token, pickDevices, onAuthError);

  if (!rows && loading) return <LoadingNote label="Loading devices…" />;
  if (error && !rows) return <ErrorNote message={error} />;

  return (
    <div>
      <ScreenHeader
        title="Devices"
        subtitle={`${total.toLocaleString('en')} app installs, most recently active first.`}
      />
      {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
      <TableCard
        colCount={7}
        rowCount={rows?.length ?? 0}
        emptyLabel="No devices yet."
        loading={loading}
        offset={offset}
        limit={limit}
        total={total}
        onOffset={setOffset}
        head={
          <>
            <Th>Device</Th>
            <Th>Platform</Th>
            <Th>Model</Th>
            <Th>App version</Th>
            <Th right>Journeys</Th>
            <Th>First seen</Th>
            <Th>Last seen</Th>
          </>
        }
      >
        {(rows ?? []).map((d) => (
          <tr key={d.id} className="transition-colors hover:bg-bg-3/60">
            <Td mono muted>
              <span title={d.deviceUuid}>{shortUuid(d.deviceUuid)}</span>
            </Td>
            <Td muted>{fmtLabel(d.platform)}</Td>
            <Td>{d.model ?? '—'}</Td>
            <Td muted>{d.appVersion ?? '—'}</Td>
            <Td right>{d.journeyCount.toLocaleString('en')}</Td>
            <Td muted>{fmtDateTime(d.firstSeenAt)}</Td>
            <Td muted>{fmtDateTime(d.lastSeenAt)}</Td>
          </tr>
        ))}
      </TableCard>
    </div>
  );
}
