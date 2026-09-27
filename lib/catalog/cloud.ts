import { downloadRange } from "@/lib/pipeline/download";

import { momentumFromCharts } from "@/lib/pipeline/momentum";

import {
  rollupArr,
  rollupMrr,
} from "@/lib/catalog/revenue";

import { estimated } from "@/lib/provenance/assign";

import { unavailable } from "@/lib/provenance/assign";

import type { Catalog } from "@/lib/catalog/types";

import type { AppDetail } from "@/lib/catalog/detail";

import { vectorFinalists } from "@/lib/catalog/vectors";

import type { SiteSql } from "@/lib/site/types";

import type { AppMetadata } from "@/models/app";

import type { ProvenanceTier } from "@/models/provenance";

import type { RevenueBasis } from "@/models/series";

import type {
  ChartSnapshot,
  RatingSnapshot,
} from "@/models/series";

import type {
  DiscoveryAnswer,
  Finalist,
} from "@/lib/types";

import type { ScoredFinalist } from "@/lib/jev/score";

const APP_COLUMNS = `
  track_id as trackId,
  bundle_id as bundleId,
  name,
  description,
  seller_name as sellerName,
  icon_url as iconUrl,
  screenshot_urls as screenshotUrls,
  primary_genre_id as primaryGenreId,
  primary_genre as primaryGenre,
  genre_ids as genreIds,
  genres,
  price,
  currency,
  formatted_price as formattedPrice,
  store_url as storeUrl,
  version,
  release_date as releaseDate,
  current_version_release_date as currentVersionReleaseDate,
  content_advisory_rating as contentAdvisoryRating,
  metadata_fetched_at as metadataFetchedAt,
  delisted
`;

type AppRow = {
  trackId: number;

  bundleId: string;

  name: string;

  description: string;

  sellerName: string;

  iconUrl: string;

  screenshotUrls: string;

  primaryGenreId: number;

  primaryGenre: string;

  genreIds: string;

  genres: string;

  price: number;

  currency: string;

  formattedPrice: string;

  storeUrl: string;

  version: string;

  releaseDate: string;

  currentVersionReleaseDate: string;

  contentAdvisoryRating: string;

  metadataFetchedAt: string;

  delisted: number;
};

function parsed<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toApp(row: AppRow): AppMetadata {
  return {
    tier: "verified",
    origin: "lookup",
    trackId: Number(row.trackId),
    bundleId: String(row.bundleId ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    sellerName: String(row.sellerName ?? ""),
    iconUrl: String(row.iconUrl ?? ""),
    screenshotUrls: parsed(row.screenshotUrls, [] as string[]),
    primaryGenreId: Number(row.primaryGenreId ?? 0),
    primaryGenre: String(row.primaryGenre ?? ""),
    genreIds: parsed(row.genreIds, [] as number[]),
    genres: parsed(row.genres, [] as string[]),
    price: Number(row.price ?? 0),
    currency: String(row.currency ?? ""),
    formattedPrice: String(row.formattedPrice ?? ""),
    storeUrl: String(row.storeUrl ?? ""),
    version: String(row.version ?? ""),
    releaseDate: String(row.releaseDate ?? ""),
    currentVersionReleaseDate: String(
      row.currentVersionReleaseDate ?? "",
    ),
    contentAdvisoryRating: String(
      row.contentAdvisoryRating ?? "",
    ),
    metadataFetchedAt: String(row.metadataFetchedAt ?? ""),
    delisted: row.delisted === 1,
  };
}

function tokens(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.replace(/[%_]/g, ""))
    .filter((token) => token.length >= 2);
}

export function cloudCatalog(sql: SiteSql): Catalog & {
  close(): void;
} {
  return {
    close() {},

    async findByName(name) {
      const wanted = name.trim().toLowerCase();

      if (!wanted) {
        return null;
      }

      const exact = await sql.get<AppRow>(
        `
        select ${APP_COLUMNS}
        from apps
        where delisted = 0
          and lower(name) = ?
        limit 1
        `,
        [wanted],
      );

      if (exact) {
        return toApp(exact);
      }

      const loose = await sql.get<AppRow>(
        `
        select ${APP_COLUMNS}
        from apps
        where delisted = 0
          and lower(name) like ?
        order by length(name)
        limit 1
        `,
        [`%${wanted.replace(/[%_]/g, "")}%`],
      );

      return loose ? toApp(loose) : null;
    },

    async ratings(trackId) {
      const rows = await sql.all<{
        trackId: number;
        capturedAt: string;
        ratingAverage: number;
        ratingCount: number;
      }>(
        `
        select
          track_id as trackId,
          captured_at as capturedAt,
          rating_average as ratingAverage,
          rating_count as ratingCount
        from rating_snapshots
        where track_id = ?
        order by captured_at
        `,
        [trackId],
      );

      return rows.map((row): RatingSnapshot => ({
        tier: "verified",
        origin: "lookup",
        trackId: Number(row.trackId),
        capturedAt: String(row.capturedAt),
        ratingAverage: Number(row.ratingAverage),
        ratingCount: Number(row.ratingCount),
      }));
    },

    async charts(trackId) {
      const rows = await sql.all<{
        trackId: number;
        capturedAt: string;
        country: string;
        chart: ChartSnapshot["chart"];
        genreId: number;
        rank: number;
      }>(
        `
        select
          track_id as trackId,
          captured_at as capturedAt,
          country,
          chart,
          genre_id as genreId,
          rank
        from chart_snapshots
        where track_id = ?
        order by captured_at
        `,
        [trackId],
      );

      return rows.map((row): ChartSnapshot => ({
        tier: "verified",
        origin: "rss",
        trackId: Number(row.trackId),
        capturedAt: String(row.capturedAt),
        country: String(row.country),
        chart: row.chart,
        genreId: row.genreId === 0 ? null : Number(row.genreId),
        rank: Number(row.rank),
      }));
    },

    async finalists(query) {
      const ranked = await vectorFinalists(sql, query);

      if (ranked) {
        return ranked;
      }

      return lexicalFinalists(sql, query);
    },

    async ranked() {
      const rows = await sql.all<AppRow>(
        `
        select ${APP_COLUMNS}
        from apps
        where delisted = 0
        order by name
        limit 200
        `,
      );

      return rows.map((row) => ({
        app: toApp(row),
        momentum: unavailable(),
      }));
    },
  };
}

export function lexicalDiscovery(
  query: string,
  finalists: Finalist[],
  scoringNote: string | null = null,
): DiscoveryAnswer {
  return {
    shape: "discovery",
    query,
    tier: "unavailable",
    scoring: "unavailable",
    scoringNote,
    finalistCount: finalists.length,
    hits: finalists.map((hit, index) => ({
      trackId: hit.trackId,
      name: hit.name,
      iconUrl: hit.iconUrl,
      probability: Math.max(0.15, 1 - index * 0.02),
    })),
  };
}

export function scoredDiscovery(
  query: string,
  finalists: Finalist[],
  scores: ScoredFinalist[],
): DiscoveryAnswer {
  const byId = new Map(
    finalists.map((finalist) => [finalist.trackId, finalist]),
  );

  const hits = scores
    .filter((score) => score.probability >= 0.3)
    .sort((left, right) => right.probability - left.probability)
    .flatMap((score) => {
      const finalist = byId.get(score.trackId);

      if (!finalist) {
        return [];
      }

      return [{
        trackId: score.trackId,
        name: finalist.name,
        iconUrl: finalist.iconUrl,
        probability: score.probability,
      }];
    });

  return {
    shape: "discovery",
    query,
    tier: hits.length ? "estimated" : "unavailable",
    scoring: "scored",
    scoringNote: null,
    finalistCount: finalists.length,
    hits,
  };
}

export async function loadCloudDetail(
  sql: SiteSql,
  trackId: number,
  matchProbability: number | null,
): Promise<AppDetail | null> {
  const row = await sql.get<AppRow & { tier: ProvenanceTier }>(
    `
    select ${APP_COLUMNS}, tier
    from apps
    where track_id = ?
    limit 1
    `,
    [trackId],
  );

  if (!row) {
    return null;
  }

  const rating = await sql.get<{
    average: number;
    count: number;
    tier: ProvenanceTier;
  }>(
    `
    select
      rating_average as average,
      rating_count as count,
      tier
    from rating_snapshots
    where track_id = ?
    order by captured_at desc
    limit 1
    `,
    [trackId],
  );

  const catalog = cloudCatalog(sql);

  const charts = await catalog.charts(trackId);

  const revenue = await latestRevenue(sql, trackId);

  const tags = await detailTags(sql, trackId);

  const signals = await detailSignals(sql, trackId);

  return {
    tier: row.tier === "estimated" ? "estimated" : "verified",
    trackId: Number(row.trackId),
    bundleId: String(row.bundleId ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    sellerName: String(row.sellerName ?? ""),
    iconUrl: String(row.iconUrl ?? ""),
    screenshotUrls: parsed(row.screenshotUrls, [] as string[]),
    primaryGenre: String(row.primaryGenre ?? ""),
    genres: parsed(row.genres, [] as string[]),
    price: Number(row.price ?? 0),
    currency: String(row.currency ?? ""),
    formattedPrice: String(row.formattedPrice ?? ""),
    storeUrl: String(row.storeUrl ?? ""),
    version: String(row.version ?? ""),
    releaseDate: String(row.releaseDate ?? ""),
    currentVersionReleaseDate: String(
      row.currentVersionReleaseDate ?? "",
    ),
    contentAdvisoryRating: String(
      row.contentAdvisoryRating ?? "",
    ),
    metadataFetchedAt: String(row.metadataFetchedAt ?? ""),
    delisted: row.delisted === 1,
    tags,
    rating: {
      average: rating?.average ?? null,
      count: rating?.count ?? null,
      tier: rating?.tier ?? "unavailable",
    },
    momentum: momentumFromCharts(charts),
    downloads: downloadRange(),
    revenue,
    mrr: rollupMrr(revenue),
    arr: rollupArr(revenue),
    signals,
    matchProbability,
  };
}

const REVENUE_BASES = new Set<RevenueBasis>([
  "overall-grossing",
  "genre-grossing",
  "genre-ceiling",
  "below-grossing",
]);

async function lexicalFinalists(
  sql: SiteSql,
  query: string,
): Promise<Finalist[]> {
  const words = tokens(query);

  if (words.length === 0) {
    return [];
  }

  const where = words
    .map(() => "(lower(name) like ? or lower(description) like ?)")
    .join(" and ");

  const params = words.flatMap((word) => [`%${word}%`, `%${word}%`]);

  const rows = await sql.all<{
    trackId: number;
    name: string;
    description: string;
    iconUrl: string;
  }>(
    `
    select
      track_id as trackId,
      name,
      description,
      icon_url as iconUrl
    from apps
    where delisted = 0
      and ${where}
    order by length(name)
    limit 40
    `,
    params,
  );

  return rows.map((row): Finalist => ({
    trackId: Number(row.trackId),
    name: String(row.name),
    description: String(row.description ?? ""),
    iconUrl: String(row.iconUrl ?? ""),
    tags: [],
  }));
}

async function latestRevenue(
  sql: SiteSql,
  trackId: number,
) {
  try {
    const row = await sql.get<{
      capturedOn: string;
      country: string;
      basis: string;
      lowUsd: number | null;
      midUsd: number | null;
      highUsd: number | null;
      method: string;
    }>(
      `
      select
        captured_on as capturedOn,
        country,
        basis,
        low_usd as lowUsd,
        mid_usd as midUsd,
        high_usd as highUsd,
        method
      from revenue_estimates
      where track_id = ?
      order by captured_on desc
      limit 1
      `,
      [trackId],
    );

    const basis = String(row?.basis ?? "");

    if (
      !row
      || String(row.method ?? "").trim().length === 0
      || !REVENUE_BASES.has(basis as RevenueBasis)
    ) {
      return unavailable();
    }

    return estimated(
      {
        low: row.lowUsd === null ? null : Number(row.lowUsd),
        mid: row.midUsd === null ? null : Number(row.midUsd),
        high: row.highUsd === null ? null : Number(row.highUsd),
        basis: basis as RevenueBasis,
        country: String(row.country),
        day: String(row.capturedOn),
      },
      String(row.method),
    );
  } catch {
    return unavailable();
  }
}

async function detailTags(
  sql: SiteSql,
  trackId: number,
): Promise<AppDetail["tags"]> {
  try {
    const rows = await sql.all<{
      tagId: string;
      tier: string;
      method: string;
    }>(
      `
      select tag_id as tagId, tier, method
      from app_tags
      where track_id = ?
      `,
      [trackId],
    );

    return rows.map((row) => ({
      tagId: String(row.tagId),
      tier: asTier(String(row.tier)),
      method: String(row.method ?? ""),
    }));
  } catch {
    return [];
  }
}

async function detailSignals(
  sql: SiteSql,
  trackId: number,
): Promise<AppDetail["signals"]> {
  try {
    const row = await sql.get<{
      colorText: string;
      letters: string;
      tier: string;
      method: string;
    }>(
      `
      select
        color_text as colorText,
        letters,
        tier,
        method
      from icon_signals
      where track_id = ?
      limit 1
      `,
      [trackId],
    );

    if (!row) {
      return null;
    }

    return {
      colorText: String(row.colorText ?? ""),
      letters: String(row.letters ?? ""),
      tier: asTier(String(row.tier)),
      method: String(row.method ?? ""),
    };
  } catch {
    return null;
  }
}

function asTier(value: string): ProvenanceTier {
  if (
    value === "verified"
    || value === "estimated"
    || value === "unavailable"
  ) {
    return value;
  }

  return "estimated";
}
