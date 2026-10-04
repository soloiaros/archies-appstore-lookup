import { getSession } from "@/lib/auth";

import {
  GUEST_DAILY_LIMIT,
  USER_DAILY_LIMIT,
  type QuotaSnapshot,
} from "@/lib/quota";

import { clientIp } from "@/lib/site/http";

import { siteDb } from "@/lib/site/db";

export {
  GUEST_DAILY_LIMIT,
  USER_DAILY_LIMIT,
  type QuotaSnapshot,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDayStart(now = Date.now()) {
  const date = new Date(now);

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function guestKey(request: Request, _vid?: string | null) {
  // Guests are limited by client IP. Cookie-only keys are trivial to reset
  // by deleting `vid`; IP is the durable guest identity at this tier.
  return `g:${clientIp(request).slice(0, 64)}`;
}

async function readHits(bucket: string, key: string, windowStart: number) {
  const sql = await siteDb();

  const row = await sql.get<{ hits: number }>(
    `
    select hits
    from rate_limits
    where bucket = ?
      and ip = ?
      and window_start = ?
    `,
    [bucket, key, windowStart],
  );

  return typeof row?.hits === "number" ? row.hits : 0;
}

async function bumpHits(bucket: string, key: string, windowStart: number) {
  const sql = await siteDb();

  const row = await sql.get<{ hits: number }>(
    `
    insert into rate_limits (bucket, ip, window_start, hits)
    values (?, ?, ?, 1)
    on conflict (bucket, ip, window_start)
    do update set hits = hits + 1
    returning hits
    `,
    [bucket, key, windowStart],
  );

  if (typeof row?.hits === "number") {
    return row.hits;
  }

  return readHits(bucket, key, windowStart);
}

export async function quotaFor(
  request: Request,
  vid?: string | null,
): Promise<QuotaSnapshot> {
  const session = await getSession(request.headers);
  const authenticated = Boolean(session?.user?.id);
  const limit = authenticated ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const key = authenticated
    ? `u:${session!.user.id}`
    : guestKey(request, vid);
  const windowStart = utcDayStart();
  const used = await readHits("query-day", key, windowStart);

  return {
    authenticated,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt: windowStart + DAY_MS,
  };
}

export async function takeDailyQuery(
  request: Request,
  vid?: string | null,
): Promise<
  | { ok: true; quota: QuotaSnapshot }
  | { ok: false; quota: QuotaSnapshot }
> {
  const session = await getSession(request.headers);
  const authenticated = Boolean(session?.user?.id);
  const limit = authenticated ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const key = authenticated
    ? `u:${session!.user.id}`
    : guestKey(request, vid);
  const windowStart = utcDayStart();

  try {
    const used = await bumpHits("query-day", key, windowStart);
    const quota: QuotaSnapshot = {
      authenticated,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetsAt: windowStart + DAY_MS,
    };

    if (used > limit) {
      return { ok: false, quota };
    }

    return { ok: true, quota };
  } catch {
    // Fail closed: do not grant free searches when the limiter is down.
    const quota: QuotaSnapshot = {
      authenticated,
      limit,
      used: limit,
      remaining: 0,
      resetsAt: windowStart + DAY_MS,
    };

    return { ok: false, quota };
  }
}

export function quotaExceeded(quota: QuotaSnapshot) {
  const retryAfter = Math.max(
    1,
    Math.ceil((quota.resetsAt - Date.now()) / 1000),
  );

  const message = quota.authenticated
    ? `Daily free search limit reached (${quota.limit}/day). Resets at 00:00 UTC.`
    : `Guest limit reached (${quota.limit} free searches/day). Sign in for ${USER_DAILY_LIMIT}/day.`;

  return Response.json(
    {
      error: message,
      quota,
    },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(retryAfter),
      },
    },
  );
}
