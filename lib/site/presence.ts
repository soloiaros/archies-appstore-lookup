import { presenceNamespace } from "@/lib/site/db";

const WINDOW = 30_000;

const seen = new Map<string, number>();

function prune(now: number) {
  for (const [id, at] of seen) {
    if (now - at > WINDOW) {
      seen.delete(id);
    }
  }
}

function rememberLocal(sid: string | null) {
  const now = Date.now();

  if (sid) {
    seen.set(sid, now);
  }

  prune(now);

  return seen.size;
}

export async function hereNow(sid: string | null): Promise<number> {
  const binding = await presenceNamespace();

  if (!binding) {
    return rememberLocal(sid);
  }

  const stub = binding.get(binding.idFromName("site"));

  const path = sid
    ? `/beat?sid=${encodeURIComponent(sid)}`
    : "/count";

  const response = await stub.fetch(
    `https://presence.internal${path}`,
  );

  const body = await response.json() as { here?: number };

  return body.here ?? 0;
}
