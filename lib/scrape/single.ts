import { itunesCountry } from "@/lib/env";

import { lookupBatch } from "@/lib/scrape/lookup";

import {
  toAppMetadata,
  toRatingSnapshot,
  toVersionRelease,
} from "@/lib/scrape/map";

import {
  openCatalog,
  upsertObserved,
} from "@/lib/scrape/store";

import type { AppMetadata } from "@/models/app";

export async function refreshOneApp(
  trackId: number,
  country = itunesCountry(),
): Promise<AppMetadata | null> {
  const results = await lookupBatch(
    [trackId],
    country,
  );

  const hit = results[0];

  const db = openCatalog();

  try {
    if (!hit) {
      db.prepare(`
        update apps
        set delisted = 1
        where track_id = ?
      `).run(trackId);

      return null;
    }

    const observedAt = new Date().toISOString();

    const app = toAppMetadata(
      hit,
      observedAt,
    );

    const rating = toRatingSnapshot(
      hit,
      observedAt,
    );

    const version = toVersionRelease(hit);

    upsertObserved(
      db,
      {
        apps: [app],
        ratings: rating
          ? [rating]
          : [],
        charts: [],
        versions: version
          ? [version]
          : [],
      },
    );

    return app;
  } finally {
    db.close();
  }
}

export async function lookupByName(
  name: string,
  country = itunesCountry(),
): Promise<AppMetadata | null> {
  const params = new URLSearchParams({
    term: name,
    country,
    entity: "software",
    limit: "5",
  });

  const response = await fetch(
    `https://itunes.apple.com/search?${params.toString()}`,
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    results?: Array<{
      trackId?: number;

      trackName?: string;
    }>;
  };

  const wanted = name.trim().toLowerCase();

  const match = (payload.results ?? []).find(
    (row) =>
      typeof row.trackName === "string"
      && row.trackName.toLowerCase() === wanted
      && typeof row.trackId === "number",
  );

  if (!match?.trackId) {
    return null;
  }

  return refreshOneApp(
    match.trackId,
    country,
  );
}
