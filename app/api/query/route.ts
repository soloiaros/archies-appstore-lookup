import { tooMany, underLimit } from "@/lib/site/limit";

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

  const allowed = await underLimit(request, "query", 50);

  if (!allowed) {
    return tooMany(
      "Too many searches from this network. Try again in an hour.",
    );
  }

  try {
    const result = await answer(query);

    return Response.json(result);
  } catch (error) {
    const raw = error instanceof Error
      ? error.message
      : "Query failed.";

    const message = raw === "Illegal constructor"
      ? "The app catalog is not available on this server."
      : raw;

    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
}
