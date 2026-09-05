import { type JourneyRow, type JourneysResponse } from '@/lib/api';
import { fmtDateTime, fmtDuration, fmtLabel } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';
import { ErrorNote, LoadingNote, ScreenHeader, TableCard, Td, Th } from '@/components/ui';

const pickJourneys = (body: JourneysResponse) => body.journeys;

export default function JourneysTable({
  token,
  onAuthError,
}: {
  token: string;
  onAuthError: () => void;
}) {
  const { rows, total, offset, limit, loading, error, setOffset } = usePaged<
    JourneysResponse,
    JourneyRow
  >('/api/admin/journeys', token, pickJourneys, onAuthError);

  if (!rows && loading) return <LoadingNote label="Loading journeys…" />;
  if (error && !rows) return <ErrorNote message={error} />;

  return (
    <div>
      <ScreenHeader
        title="Journeys"
        subtitle={`${total.toLocaleString('en')} uploaded trips, newest first.`}
      />
      {error ? <div className="mb-4"><ErrorNote message={error} /></div> : null}
      <TableCard
        colCount={9}
        rowCount={rows?.length ?? 0}
        emptyLabel="No journeys yet."
        loading={loading}
        offset={offset}
        limit={limit}
        total={total}
        onOffset={setOffset}
        head={
          <>
            <Th>Received</Th>
            <Th>Device</Th>
            <Th>Vehicle</Th>
            <Th>Quality</Th>
            <Th>Reason</Th>
            <Th right>Distance km</Th>
            <Th right>Duration</Th>
            <Th right>RQI</Th>
            <Th right>Events</Th>
          </>
        }
      >
        {(rows ?? []).map((j) => (
          <tr key={j.id} className="transition-colors hover:bg-bg-3/60">
            <Td muted>{fmtDateTime(j.receivedAt)}</Td>
            <Td>
              <span className="text-ink">{j.deviceModel ?? 'Unknown model'}</span>{' '}
              <span className="text-xs text-ink-3">{fmtLabel(j.devicePlatform)}</span>
            </Td>
            <Td muted>{fmtLabel(j.vehicleType)}</Td>
            <Td>
              <span className={j.qualityStatus === 'QUARANTINED' ? 'text-red-400' : 'text-ink'}>
                {fmtLabel(j.qualityStatus)}
              </span>
            </Td>
            <Td muted>
              <span title={j.qualityReasons.join(', ')}>
                {j.qualityReasons.length ? j.qualityReasons.map(fmtLabel).join(', ') : '—'}
              </span>
            </Td>
            <Td right>{(j.distanceM / 1000).toFixed(1)}</Td>
            <Td right>{fmtDuration(j.durationS)}</Td>
            <Td right>{Math.round(j.rqiScore)}</Td>
            <Td right>{j.eventCount.toLocaleString('en')}</Td>
          </tr>
        ))}
      </TableCard>
    </div>
  );
}
