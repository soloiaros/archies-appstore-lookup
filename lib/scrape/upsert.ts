import type { AppMetadata } from "@/models/app";

import type {
  ChartSnapshot,
  RatingSnapshot,
  VersionRelease,
} from "@/models/series";

export async function upsertApps(
  apps: AppMetadata[],
): Promise<void> {
  // TODO(phase-1)

  void apps;
}

export async function insertRatings(
  snapshots: RatingSnapshot[],
): Promise<void> {
  // TODO(phase-1)

  void snapshots;
}

export async function insertCharts(
  snapshots: ChartSnapshot[],
): Promise<void> {
  // TODO(phase-1)

  void snapshots;
}

export async function insertVersions(
  releases: VersionRelease[],
): Promise<void> {
  // TODO(phase-1)

  void releases;
}
