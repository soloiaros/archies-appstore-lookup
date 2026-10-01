import { applyCookies, visitIds } from "@/lib/site/http";

import { quotaFor } from "@/lib/site/quota";

export async function GET(request: Request) {
  const visits = visitIds(request);

  try {
    const quota = await quotaFor(request, visits.ids.vid);

    return applyCookies(
      Response.json(quota, {
        headers: {
          "cache-control": "no-store",
        },
      }),
      visits.cookies,
    );
  } catch {
    return applyCookies(
      Response.json(
        {
          authenticated: false,
          limit: 5,
          used: 0,
          remaining: 5,
          resetsAt: Date.now(),
        },
        {
          status: 200,
          headers: {
            "cache-control": "no-store",
          },
        },
      ),
      visits.cookies,
    );
  }
}
