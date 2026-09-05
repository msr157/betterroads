export type RetentionCandidate = {
  id: string;
  objectKey: string;
  state: string;
  createdAt: Date;
  completedAt: Date | null;
};

/** Pure policy used by the cleanup job. Metadata rows are retained for audit. */
export function shouldDeleteRawObject(candidate: RetentionCandidate, now: Date, retentionDays: number): boolean {
  if (candidate.state === 'DELETED') return false;
  if (candidate.state === 'DELETE_PENDING') return true;
  if (!candidate.completedAt) return false;
  const cutoffMs = now.getTime() - retentionDays * 86_400_000;
  return candidate.completedAt.getTime() < cutoffMs;
}

export function parseRetentionDays(value: string | undefined): number {
  const days = Number(value ?? 90);
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('COLLECTION_RAW_RETENTION_DAYS must be an integer from 1 to 3650.');
  return days;
}
