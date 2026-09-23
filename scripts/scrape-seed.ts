import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import { join } from "node:path";

import {
  itunesCountry,
  loadLocalEnv,
} from "../lib/env";

import { refreshCatalog } from "../lib/scrape/refresh";

import type { FeedReport } from "../lib/scrape/aggregate";

import type { LookupResult } from "../lib/scrape/lookup";

const SNAPSHOT_DIR = join(
  process.cwd(),
  "data",
  "snapshots",
);

loadLocalEnv();

async function main(): Promise<void> {
  const country = itunesCountry();

  const genreIds = readGenreIds();

  const added = readAddList();

  const result = await refreshCatalog(
    country,
    genreIds,
    added,
    (report, index, total) => {
      const label = report.genreId === null
        ? "overall"
        : String(report.genreId);

      const detail = report.error
        ?? `${report.hits} hits`;

      console.log(
        `${index + 1}/${total} ${report.chart} ${label} ${detail}`,
      );
    },
  );

  const failedFeeds = result.feeds.filter(
    (feed) => feed.error !== null,
  );

  const returned = new Set(
    result.apps.map(
      (app) => app.trackId,
    ),
  );

  const missing = result.trackIds.filter(
    (trackId) => !returned.has(trackId),
  );

  mkdirSync(
    SNAPSHOT_DIR,
    {
      recursive: true,
    },
  );

  writeJson(
    "charts.json",
    {
      country,
      feeds: result.feeds.map(summarizeFeed),
      appearances: result.appearances,
      uniqueTrackIds: result.trackIds.length,
      failedFeeds: failedFeeds.length,
    },
  );

  writeJson(
    "lookup.json",
    result.apps,
  );

  writeJson(
    "lookup-report.json",
    {
      requested: result.trackIds.length,
      returned: result.apps.length,
      missing: missing.length,
      missingSample: missing.slice(0, 20),
      gaps: fieldGaps(result.apps),
      samples: sampleApps(result.apps),
      counts: result.counts,
    },
  );

  console.log(
    `unique track ids ${result.trackIds.length}`,
  );

  console.log(
    `failed feeds ${failedFeeds.length}`,
  );

  console.log(
    `lookup returned ${result.apps.length} of ${result.trackIds.length}`,
  );

  console.log(
    `missing ${missing.length}`,
  );

  console.log(
    `counts ${JSON.stringify(result.counts)}`,
  );
}

function summarizeFeed(
  feed: FeedReport,
) {
  return {
    chart: feed.chart,
    genreId: feed.genreId,
    source: feed.source,
    hits: feed.hits,
    error: feed.error,
  };
}

function fieldGaps(
  apps: LookupResult[],
): Record<string, number> {
  const gaps: Record<string, number> = {
    description: 0,
    artworkUrl: 0,
    screenshotUrls: 0,
    sellerName: 0,
    averageUserRating: 0,
    userRatingCount: 0,
    releaseNotes: 0,
    formattedPrice: 0,
    trackViewUrl: 0,
    currency: 0,
    version: 0,
  };

  for (const app of apps) {
    if (app.description === "") {
      gaps.description += 1;
    }

    if (app.artworkUrl === "") {
      gaps.artworkUrl += 1;
    }

    if (app.screenshotUrls.length === 0) {
      gaps.screenshotUrls += 1;
    }

    if (app.sellerName === "") {
      gaps.sellerName += 1;
    }

    if (app.averageUserRating === null) {
      gaps.averageUserRating += 1;
    }

    if (app.userRatingCount === null) {
      gaps.userRatingCount += 1;
    }

    if (app.releaseNotes === "") {
      gaps.releaseNotes += 1;
    }

    if (app.formattedPrice === "") {
      gaps.formattedPrice += 1;
    }

    if (app.trackViewUrl === "") {
      gaps.trackViewUrl += 1;
    }

    if (app.currency === "") {
      gaps.currency += 1;
    }

    if (app.version === "") {
      gaps.version += 1;
    }
  }

  return gaps;
}

function sampleApps(
  apps: LookupResult[],
): LookupResult[] {
  const samples = apps.slice(0, 2);

  const unrated = apps.find(
    (app) => app.averageUserRating === null,
  );

  if (
    unrated
    && !samples.some(
      (app) => app.trackId === unrated.trackId,
    )
  ) {
    samples.push(unrated);
  }

  return samples;
}

function readGenreIds(): number[] {
  const parsed = readJson(
    join(
      process.cwd(),
      "data",
      "categories",
      "taxonomy.json",
    ),
  );

  if (
    typeof parsed !== "object"
    || parsed === null
    || !("genres" in parsed)
    || !Array.isArray(parsed.genres)
  ) {
    throw new Error(
      "taxonomy genres missing",
    );
  }

  const ids: number[] = [];

  for (const genre of parsed.genres) {
    if (
      typeof genre !== "object"
      || genre === null
      || !("id" in genre)
      || typeof genre.id !== "number"
    ) {
      continue;
    }

    ids.push(genre.id);
  }

  return ids;
}

function readAddList(): number[] {
  const parsed = readJson(
    join(
      process.cwd(),
      "data",
      "seeds",
      "add-list.json",
    ),
  );

  if (
    typeof parsed !== "object"
    || parsed === null
    || !("trackIds" in parsed)
    || !Array.isArray(parsed.trackIds)
  ) {
    return [];
  }

  const ids: number[] = [];

  for (const trackId of parsed.trackIds) {
    if (typeof trackId === "number") {
      ids.push(trackId);
    }
  }

  return ids;
}

function readJson(
  path: string,
): unknown {
  return JSON.parse(
    readFileSync(
      path,
      "utf8",
    ),
  ) as unknown;
}

function writeJson(
  name: string,
  value: unknown,
): void {
  writeFileSync(
    join(
      SNAPSHOT_DIR,
      name,
    ),
    JSON.stringify(
      value,
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "scrape-seed failed",
  );

  process.exitCode = 1;
});
