import { NextResponse } from "next/server";

import { loadCloudDetail } from "@/lib/catalog/cloud";

import { loadAppDetail } from "@/lib/catalog/detail";

import { catalogDb } from "@/lib/site/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      trackId: string;
    }>;
  },
) {
  const { trackId: raw } = await context.params;

  const trackId = Number(raw);

  if (
    !Number.isSafeInteger(trackId)
    || trackId <= 0
  ) {
    return NextResponse.json(
      { error: "Bad track id." },
      { status: 400 },
    );
  }

  const url = new URL(request.url);

  const probabilityRaw = url.searchParams.get(
    "p",
  );

  const matchProbability =
    probabilityRaw === null
      ? null
      : Number(probabilityRaw);

  const remote = await catalogDb();

  const probability = Number.isFinite(matchProbability)
    ? matchProbability
    : null;

  const detail = remote
    ? await loadCloudDetail(remote, trackId, probability)
    : loadAppDetail(trackId, probability);

  if (!detail) {
    return NextResponse.json(
      { error: "Not indexed." },
      { status: 404 },
    );
  }

  return NextResponse.json(detail);
}
