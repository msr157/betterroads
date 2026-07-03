import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { db } from '../db/index.js';
import { appSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const launchRouter = new Hono();

// In-memory cache for the veil state
let isUnveiledCache: boolean | null = null;
// Store active SSE streams to push updates
const activeClients = new Set<any>();

async function getIsUnveiled(): Promise<boolean> {
  if (isUnveiledCache !== null) return isUnveiledCache;
  const result = await db.select().from(appSettings).where(eq(appSettings.key, 'is_unveiled')).limit(1);
  if (result.length > 0 && result[0].value === 'true') {
    isUnveiledCache = true;
    return true;
  }
  isUnveiledCache = false;
  return false;
}

async function setUnveiled() {
  await db
    .insert(appSettings)
    .values({ key: 'is_unveiled', value: 'true' })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: 'true' },
    });
  isUnveiledCache = true;
  // Notify all active clients
  for (const send of activeClients) {
    try {
      await send({ data: 'true', event: 'unveil' });
    } catch (e) {
      console.error('Failed to send to client', e);
    }
  }
  activeClients.clear(); // Everyone is updated, can drop connections
}

launchRouter.get('/status', async (c) => {
  const unveiled = await getIsUnveiled();
  
  return streamSSE(c, async (stream) => {
    // Send immediate current state
    await stream.writeSSE({ data: unveiled ? 'true' : 'false', event: 'unveil' });
    
    // If already unveiled, we can just end the stream
    if (unveiled) {
      await stream.close();
      return;
    }

    // Otherwise keep connection open and listen for changes
    let isClosed = false;
    const send = async (data: any) => {
      if (!isClosed) await stream.writeSSE(data);
    };
    
    activeClients.add(send);

    stream.onAbort(() => {
      isClosed = true;
      activeClients.delete(send);
    });

    // Keep connection alive while waiting
    while (!isClosed) {
      await stream.sleep(30000); // 30s keep-alive sleep
      if (!isClosed) {
        await stream.writeSSE({ data: 'ping', event: 'ping' });
      }
    }
  });
});

launchRouter.post('/unlock', async (c) => {
  try {
    const body = await c.req.json();
    if (body.key === 'Nikish Built this') {
      await setUnveiled();
      return c.json({ ok: true });
    }
    return c.json({ ok: false, error: 'Invalid key' }, 401);
  } catch (err) {
    return c.json({ ok: false, error: 'Invalid request' }, 400);
  }
});
