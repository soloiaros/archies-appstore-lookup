import type {
  Catalog,
  RankedApp,
} from "@/lib/catalog";

import type { Reading } from "@/models/provenance";

import type { ComparativeAnswer } from "@/lib/types";

function momentumValue(
  reading: Reading<number>,
): number {
  if (reading.tier === "estimated") {
    return reading.value;
  }

  return Number.NEGATIVE_INFINITY;
}

export function sortByMomentum(
  rows: RankedApp[],
): RankedApp[] {
  return [...rows].sort(
    (left, right) =>
      momentumValue(right.momentum)
      - momentumValue(left.momentum),
  );
}

export async function answerComparative(
  query: string,
  catalog: Catalog,
): Promise<ComparativeAnswer> {
  const ranked = sortByMomentum(
    await catalog.ranked(),
  );

  return {
    shape: "comparative",
    query,
    tier: ranked.length
      ? "estimated"
      : "unavailable",
    rows: ranked.map((row) => ({
      trackId: row.app.trackId,
      name: row.app.name,
      category: row.app.primaryGenre,
      momentum: row.momentum,
    })),
  };
}
