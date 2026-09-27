import { clientIp } from "@/lib/site/http";

import { siteDb } from "@/lib/site/db";

const HOUR = 60 * 60 * 1000;

const DAY = 24 * HOUR;

export async function underLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs = HOUR,
) {
  try {
    const sql = await siteDb();

    const ip = clientIp(request).slice(0, 64);

    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;

    const row = await sql.get<{ hits: number }>(
      `
      insert into rate_limits (bucket, ip, window_start, hits)
      values (?, ?, ?, 1)
      on conflict (bucket, ip, window_start)
      do update set hits = hits + 1
      returning hits
      `,
      [bucket, ip, windowStart],
    );

    const hits = typeof row?.hits === "number"
      ? row.hits
      : await counted(bucket, ip, windowStart);

    return hits <= limit;
  } catch {
    return true;
  }
}

async function counted(
  bucket: string,
  ip: string,
  windowStart: number,
) {
  const sql = await siteDb();

  const row = await sql.get<{ hits: number }>(
    `
    select hits
    from rate_limits
    where bucket = ?
      and ip = ?
      and window_start = ?
    `,
    [bucket, ip, windowStart],
  );

  return row?.hits ?? Number.POSITIVE_INFINITY;
}

export function tooMany(message: string, windowMs = HOUR) {
  const start = Math.floor(Date.now() / windowMs) * windowMs;

  const retryAfter = Math.max(
    1,
    Math.ceil((start + windowMs - Date.now()) / 1000),
  );

  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(retryAfter),
      },
    },
  );
}

export async function allowOrder(request: Request) {
  const hour = await underLimit(request, "sponsor-order", 5);

  if (!hour) {
    return false;
  }

  return underLimit(request, "sponsor-order-day", 10, DAY);
}
