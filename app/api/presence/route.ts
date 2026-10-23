import { visitIds, applyCookies } from "@/lib/site/http";

import { tooMany, underLimit } from "@/lib/site/limit";

import { hereNow } from "@/lib/site/presence";

export const dynamic = "force-dynamic";

async function payload(request: Request, beat: boolean) {
  const visit = visitIds(request);

  const here = await hereNow(beat ? visit.ids.sid : null);

  return applyCookies(
    Response.json({ here }),
    beat ? visit.cookies : [],
  );
}

async function limited(request: Request) {
  const allowed = await underLimit(request, "presence", 1800);

  if (!allowed) {
    return tooMany("Too many requests. Try again in an hour.");
  }

  return null;
}

export async function GET(request: Request) {
  return (await limited(request)) ?? payload(request, false);
}

export async function POST(request: Request) {
  return (await limited(request)) ?? payload(request, true);
}
