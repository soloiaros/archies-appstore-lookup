import { tooMany, underLimit } from "@/lib/site/limit";

import { recordView } from "@/lib/site/stats";

import {
  applyCookies,
  cleanPath,
  referrerHost,
  requestCountry,
  requestHost,
  visitIds,
} from "@/lib/site/http";

export const dynamic = "force-dynamic";

type Body = {
  path?: unknown;

  referrer?: unknown;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Body | null;

  const path = cleanPath(body?.path);

  if (!path) {
    return Response.json(
      { error: "Missing a page path." },
      { status: 400 },
    );
  }

  const allowed = await underLimit(request, "collect", 120);

  if (!allowed) {
    return tooMany("Too many requests. Try again in an hour.");
  }

  const visit = visitIds(request);

  await recordView({
    path,
    country: requestCountry(request),
    referrerHost: referrerHost(
      body?.referrer,
      requestHost(request),
    ),
    vid: visit.ids.vid,
    sid: visit.ids.sid,
  });

  return applyCookies(
    Response.json({ ok: true }),
    visit.cookies,
  );
}
