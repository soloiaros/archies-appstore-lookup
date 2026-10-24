import { presenceNamespace } from "@/lib/site/db";

const WINDOW = 90_000;
const HOUR = 60 * 60 * 1000;
const RATE_LIMIT = 1800;

const seen = new Map<string, number>();
const localHits = new Map<string, number>();
let localWindow = -1;

function prune(now: number) {
  for (const [id, at] of seen) {
    if (now - at > WINDOW) {
      seen.delete(id);
    }
  }
}

function rememberLocal(sid: string | null, ip: string): PresenceCount {
  const now = Date.now();
  const window = Math.floor(now / HOUR);

  if (window !== localWindow) {
    localWindow = window;
    localHits.clear();
  }

  const hits = localHits.get(ip) ?? 0;

  if (hits >= RATE_LIMIT) {
    return { here: 0, limited: true };
  }

  localHits.set(ip, hits + 1);

  if (sid) {
    seen.set(sid, now);
  }

  prune(now);

  return { here: seen.size, limited: false };
}

export type PresenceCount = { here: number; limited: boolean };

export async function hereNow(
  sid: string | null,
  ip: string,
): Promise<PresenceCount> {
  const binding = await presenceNamespace();

  if (!binding) {
    return rememberLocal(sid, ip);
  }

  const stub = binding.get(binding.idFromName("site"));

  const path = sid
    ? `/beat?sid=${encodeURIComponent(sid)}`
    : "/count";

  const response = await stub.fetch(new Request(
    `https://presence.internal${path}`,
    { headers: { "x-presence-ip": ip } },
  ));

  if (response.status === 429) {
    return { here: 0, limited: true };
  }

  if (!response.ok) {
    throw new Error(`Presence unavailable: ${response.status}`);
  }

  const body = await response.json() as { here?: number };

  return { here: body.here ?? 0, limited: false };
}
