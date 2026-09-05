import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { collectionRawObjects } from '../src/db/schema.js';
import { parseRetentionDays, shouldDeleteRawObject } from '../src/lib/collectionRetention.js';
import { deleteRawObject } from '../src/lib/objectStorage.js';

const apply = process.argv.includes('--apply');
const retentionDays = parseRetentionDays(process.env.COLLECTION_RAW_RETENTION_DAYS);
const now = new Date();
const rows = await db.execute(sql`
  SELECT ro.id, ro.object_key AS "objectKey", ro.state, ro.created_at AS "createdAt",
         cs.completed_at AS "completedAt"
  FROM collection_raw_objects ro
  JOIN collection_sessions cs ON cs.id=ro.session_id
  WHERE ro.state <> 'DELETED'
  ORDER BY ro.created_at
`);
const candidates = rows.filter((row) => shouldDeleteRawObject(row as never, now, retentionDays)) as unknown as Array<{ id: string; objectKey: string }>;
console.log(`[collection-retention] ${candidates.length} object(s) eligible; mode=${apply ? 'apply' : 'dry-run'}`);
if (apply) {
  for (const candidate of candidates) {
    await db.update(collectionRawObjects).set({ state: 'DELETE_PENDING' }).where(eq(collectionRawObjects.id, candidate.id));
    await deleteRawObject(candidate.objectKey);
    await db.update(collectionRawObjects).set({ state: 'DELETED', deletedAt: sql`now()` }).where(eq(collectionRawObjects.id, candidate.id));
  }
}
process.exit(0);
