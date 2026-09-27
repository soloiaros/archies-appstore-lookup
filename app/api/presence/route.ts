import { visitIds, applyCookies } from "@/lib/site/http";

import { hereNow } from "@/lib/site/presence";

import { visitorTotal } from "@/lib/site/stats";

export const dynamic = "force-dynamic";

async function payload(request: Request, beat: boolean) {
  const visit = visitIds(request);

  const [here, visitors] = await Promise.all([
    hereNow(beat ? visit.ids.sid : null),
    visitorTotal(),
  ]);

  return applyCookies(
    Response.json({ here, visitors }),
    beat ? visit.cookies : [],
  );
}

export async function GET(request: Request) {
  return payload(request, false);
}

export async function POST(request: Request) {
  return payload(request, true);
}
