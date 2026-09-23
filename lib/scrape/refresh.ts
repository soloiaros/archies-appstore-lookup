import type { ChartAppearance } from "@/lib/scrape/aggregate";

import { aggregateCharts } from "@/lib/scrape/aggregate";

import { dedupTrackIds } from "@/lib/scrape/dedup";

import { lookupAll } from "@/lib/scrape/lookup";

import type { LookupResult } from "@/lib/scrape/lookup";

import {
  toAppMetadata,
  toRatingSnapshot,
  toVersionRelease,
} from "@/lib/scrape/map";

import {
  catalogCounts,
  listTrackIds,
  openCatalog,
  upsertObserved,
} from "@/lib/scrape/store";

import type { CatalogCounts } from "@/lib/scrape/store";

import type { FeedReport } from "@/lib/scrape/aggregate";

import type { ChartSnapshot } from "@/models/series";

export const MIN_UNIQUE_TRACK_IDS = 1000;

export type RefreshResult = {
  feeds: FeedReport[];

  appearances: ChartAppearance[];

  trackIds: number[];

  apps: LookupResult[];

  counts: CatalogCounts;
};

export async function refreshCatalog(
  country: string,
  genreIds: number[],
  added: number[],
  onFeed?: (
    report: FeedReport,
    index: number,
    total: number,
  ) => void,
): Promise<RefreshResult> {
  const db = openCatalog();

  const existing = listTrackIds(db);

  const collection = await aggregateCharts(
    country,
    genreIds,
    onFeed,
  );

  const chartIds = dedupTrackIds(
    collection.appearances.map(
      (hit) => hit.trackId,
    ),
  );

  const trackIds = dedupTrackIds([
    ...chartIds,
    ...added,
    ...existing,
  ]);

  if (
    existing.length === 0
    && chartIds.length < MIN_UNIQUE_TRACK_IDS
  ) {
    throw new Error(
      `unique track ids ${chartIds.length} below ${MIN_UNIQUE_TRACK_IDS}`,
    );
  }

  const observedAt = new Date().toISOString();

  const apps = await lookupAll(
    trackIds,
    country,
  );

  const metadata = apps.map(
    (app) => toAppMetadata(
      app,
      observedAt,
    ),
  );

  const ratings = apps.flatMap((app) => {
    const snapshot = toRatingSnapshot(
      app,
      observedAt,
    );

    return snapshot
      ? [snapshot]
      : [];
  });

  const versions = apps.flatMap((app) => {
    const release = toVersionRelease(app);

    return release
      ? [release]
      : [];
  });

  const known = new Set(
    metadata.map(
      (app) => app.trackId,
    ),
  );

  const charts = collection.appearances
    .filter(
      (hit) => known.has(hit.trackId),
    )
    .map(
      (hit) => toChartSnapshot(
        hit,
        observedAt,
      ),
    );

  upsertObserved(
    db,
    {
      apps: metadata,
      ratings,
      charts,
      versions,
    },
  );

  const counts = catalogCounts(db);

  db.close();

  return {
    feeds: collection.feeds,
    appearances: collection.appearances,
    trackIds,
    apps,
    counts,
  };
}

function toChartSnapshot(
  hit: ChartAppearance,
  capturedAt: string,
): ChartSnapshot {
  return {
    tier: "verified",
    origin: "rss",
    trackId: hit.trackId,
    capturedAt,
    country: hit.country,
    chart: hit.chart,
    genreId: hit.genreId,
    rank: hit.rank,
  };
}
