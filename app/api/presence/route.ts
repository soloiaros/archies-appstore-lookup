import { visitIds, applyCookies, clientIp } from "@/lib/site/http";

import { tooMany } from "@/lib/site/limit";

import { hereNow } from "@/lib/site/presence";

export const dynamic = "force-dynamic";

async function payload(request: Request, beat: boolean) {
  const visit = visitIds(request);

  const result = await hereNow(
    beat ? visit.ids.sid : null,
    clientIp(request),
  );

  if (result.limited) {
    return tooMany("Too many requests. Try again in an hour.");
  }

  return applyCookies(
    Response.json({ here: result.here }),
    beat ? visit.cookies : [],
  );
}

export async function GET(request: Request) {
  return payload(request, false);
}

export async function POST(request: Request) {
  return payload(request, true);
}
