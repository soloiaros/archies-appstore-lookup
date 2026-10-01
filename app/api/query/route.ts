import { applyCookies, visitIds } from "@/lib/site/http";

import { underLimit, tooMany } from "@/lib/site/limit";

import {
  quotaExceeded,
  takeDailyQuery,
} from "@/lib/site/quota";

import { answer } from "@/lib/router";

type QueryBody = {
  query?: unknown;
};

export async function POST(
  request: Request,
) {
  const body = (await request
    .json()
    .catch(() => null)) as QueryBody | null;

  const query =
    typeof body?.query === "string"
      ? body.query.trim().slice(0, 300)
      : "";

  if (query.length < 2) {
    return Response.json(
      {
        error: "Type at least 2 characters.",
      },
      {
        status: 400,
      },
    );
  }

  const visits = visitIds(request);

  const burstOk = await underLimit(request, "query", 50);

  if (!burstOk) {
    return applyCookies(
      tooMany(
        "Too many searches from this network. Try again in an hour.",
      ),
      visits.cookies,
    );
  }

  const daily = await takeDailyQuery(request, visits.ids.vid);

  if (!daily.ok) {
    return applyCookies(quotaExceeded(daily.quota), visits.cookies);
  }

  try {
    const result = await answer(query);

    return applyCookies(
      Response.json({
        ...result,
        quota: daily.quota,
      }),
      visits.cookies,
    );
  } catch (error) {
    const raw = error instanceof Error
      ? error.message
      : "Query failed.";

    const message = raw === "Illegal constructor"
      ? "The app catalog is not available on this server."
      : raw;

    return applyCookies(
      Response.json(
        { error: message },
        { status: 500 },
      ),
      visits.cookies,
    );
  }
}
