import type { Reading } from "@/models/provenance";

import type { ChartSnapshot } from "@/models/series";

import type { RatingSnapshot } from "@/models/series";

import { unavailable } from "@/lib/provenance/assign";

export function momentumFromRatings(
  snapshots: RatingSnapshot[],
): Reading<number> {
  if (snapshots.length < 2) {
    return unavailable();
  }

  // TODO(phase-3)

  return unavailable();
}

export function momentumFromCharts(
  snapshots: ChartSnapshot[],
): Reading<number> {
  if (snapshots.length === 0) {
    return unavailable();
  }

  // TODO(phase-3)

  return unavailable();
}
