import type { DatabaseSync } from "node:sqlite";

import type {
  Catalog,
  RankedApp,
} from "@/lib/catalog/types";

import { momentumFromCharts } from "@/lib/pipeline/momentum";

import { retrieveFinalists } from "@/lib/retrieve/finalists";

import { openCatalog } from "@/lib/scrape/store";

import type { AppMetadata } from "@/models/app";

import type {
  ChartSnapshot,
  RatingSnapshot,
} from "@/models/series";

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

export function sqliteCatalog(
  db = openCatalog(),
): Catalog & {
  close(): void;

  db: DatabaseSync;
} {
  return {
    db,

    close() {
      db.close();
    },

    async findByName(
      name: string,
    ): Promise<AppMetadata | null> {
      const wanted = name.trim().toLowerCase();

      if (wanted.length === 0) {
        return null;
      }

      const exact = db.prepare(`
        select *
        from (
          select
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
          from apps
          where delisted = 0
        )
        where lower(name) = ?
        limit 1
      `).get(wanted) as AppRow | undefined;

      if (exact) {
        return toApp(exact);
      }

      const loose = db.prepare(`
        select
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
        from apps
        where delisted = 0
          and lower(name) like ?
        order by length(name)
        limit 1
      `).get(`%${wanted}%`) as AppRow | undefined;

      return loose
        ? toApp(loose)
        : null;
    },

    async ratings(
      trackId: number,
    ): Promise<RatingSnapshot[]> {
      const rows = db.prepare(`
        select
          track_id as trackId,
          captured_at as capturedAt,
          rating_average as ratingAverage,
          rating_count as ratingCount
        from rating_snapshots
        where track_id = ?
        order by captured_at
      `).all(trackId) as Array<{
        trackId: number;

        capturedAt: string;

        ratingAverage: number;

        ratingCount: number;
      }>;

      return rows.map((row) => ({
        tier: "verified" as const,
        origin: "lookup" as const,
        trackId: row.trackId,
        capturedAt: row.capturedAt,
        ratingAverage: row.ratingAverage,
        ratingCount: row.ratingCount,
      }));
    },

    async charts(
      trackId: number,
    ): Promise<ChartSnapshot[]> {
      const rows = db.prepare(`
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
      `).all(trackId) as Array<{
        trackId: number;

        capturedAt: string;

        country: string;

        chart: "top-free" | "top-paid" | "top-grossing";

        genreId: number;

        rank: number;
      }>;

      return rows.map((row) => ({
        tier: "verified" as const,
        origin: "rss" as const,
        trackId: row.trackId,
        capturedAt: row.capturedAt,
        country: row.country,
        chart: row.chart,
        genreId:
          row.genreId === 0
            ? null
            : row.genreId,
        rank: row.rank,
      }));
    },

    async finalists(
      query: string,
    ) {
      return retrieveFinalists(
        db,
        query,
      );
    },

    async ranked(): Promise<RankedApp[]> {
      const apps = db.prepare(`
        select
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
        from apps
        where delisted = 0
        order by name
        limit 200
      `).all() as AppRow[];

      const out: RankedApp[] = [];

      for (const row of apps) {
        const charts = await this.charts(
          row.trackId,
        );

        out.push({
          app: toApp(row),
          momentum: momentumFromCharts(charts),
        });
      }

      return out;
    },
  };
}

function toApp(
  row: AppRow,
): AppMetadata {
  return {
    tier: "verified",
    origin: "lookup",
    trackId: row.trackId,
    bundleId: row.bundleId,
    name: row.name,
    description: row.description,
    sellerName: row.sellerName,
    iconUrl: row.iconUrl,
    screenshotUrls: JSON.parse(
      row.screenshotUrls,
    ) as string[],
    primaryGenreId: row.primaryGenreId,
    primaryGenre: row.primaryGenre,
    genreIds: JSON.parse(
      row.genreIds,
    ) as number[],
    genres: JSON.parse(
      row.genres,
    ) as string[],
    price: row.price,
    currency: row.currency,
    formattedPrice: row.formattedPrice,
    storeUrl: row.storeUrl,
    version: row.version,
    releaseDate: row.releaseDate,
    currentVersionReleaseDate:
      row.currentVersionReleaseDate,
    contentAdvisoryRating:
      row.contentAdvisoryRating,
    metadataFetchedAt: row.metadataFetchedAt,
    delisted: row.delisted === 1,
  };
}
