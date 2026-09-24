import { openCatalog } from "@/lib/scrape/store";

import { downloadRange } from "@/lib/pipeline/download";

import { momentumFromCharts } from "@/lib/pipeline/momentum";

import type { ProvenanceTier } from "@/models/provenance";

import type { Reading } from "@/models/provenance";

export type AppDetail = {
  tier: ProvenanceTier;

  trackId: number;

  bundleId: string;

  name: string;

  description: string;

  sellerName: string;

  iconUrl: string;

  screenshotUrls: string[];

  primaryGenre: string;

  genres: string[];

  price: number;

  currency: string;

  formattedPrice: string;

  storeUrl: string;

  version: string;

  releaseDate: string;

  currentVersionReleaseDate: string;

  contentAdvisoryRating: string;

  metadataFetchedAt: string;

  delisted: boolean;

  tags: Array<{
    tagId: string;

    tier: ProvenanceTier;

    method: string;
  }>;

  rating: {
    average: number | null;

    count: number | null;

    tier: ProvenanceTier;
  };

  momentum: Reading<number>;

  downloads: Reading<string>;

  signals: {
    colorText: string;

    letters: string;

    tier: ProvenanceTier;

    method: string;
  } | null;

  matchProbability: number | null;
};

export function loadAppDetail(
  trackId: number,
  matchProbability: number | null = null,
): AppDetail | null {
  const db = openCatalog();

  try {
    const row = db.prepare(`
      select
        track_id as trackId,
        bundle_id as bundleId,
        name,
        description,
        seller_name as sellerName,
        icon_url as iconUrl,
        screenshot_urls as screenshotUrls,
        primary_genre as primaryGenre,
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
        delisted,
        tier
      from apps
      where track_id = ?
      limit 1
    `).get(trackId) as
      | {
          trackId: number;

          bundleId: string;

          name: string;

          description: string;

          sellerName: string;

          iconUrl: string;

          screenshotUrls: string;

          primaryGenre: string;

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

          tier: ProvenanceTier;
        }
      | undefined;

    if (!row) {
      return null;
    }

    const tags = db.prepare(`
      select
        tag_id as tagId,
        tier,
        method
      from app_tags
      where track_id = ?
      order by tag_id
    `).all(trackId) as Array<{
      tagId: string;

      tier: ProvenanceTier;

      method: string;
    }>;

    const rating = db.prepare(`
      select
        rating_average as average,
        rating_count as count,
        tier
      from rating_snapshots
      where track_id = ?
      order by captured_at desc
      limit 1
    `).get(trackId) as
      | {
          average: number;

          count: number;

          tier: ProvenanceTier;
        }
      | undefined;

    const charts = db.prepare(`
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

    const signals = db.prepare(`
      select
        color_text as colorText,
        letters,
        tier,
        method
      from icon_signals
      where track_id = ?
      limit 1
    `).get(trackId) as
      | {
          colorText: string;

          letters: string;

          tier: ProvenanceTier;

          method: string;
        }
      | undefined;

    const momentum = momentumFromCharts(
      charts.map((chart) => ({
        tier: "verified" as const,
        origin: "rss" as const,
        trackId: chart.trackId,
        capturedAt: chart.capturedAt,
        country: chart.country,
        chart: chart.chart,
        genreId:
          chart.genreId === 0
            ? null
            : chart.genreId,
        rank: chart.rank,
      })),
    );

    return {
      tier: row.tier,
      trackId: Number(row.trackId),
      bundleId: String(row.bundleId),
      name: String(row.name),
      description: String(row.description),
      sellerName: String(row.sellerName),
      iconUrl: String(row.iconUrl),
      screenshotUrls: JSON.parse(
        row.screenshotUrls,
      ) as string[],
      primaryGenre: String(row.primaryGenre),
      genres: JSON.parse(row.genres) as string[],
      price: Number(row.price),
      currency: String(row.currency),
      formattedPrice: String(row.formattedPrice),
      storeUrl: String(row.storeUrl),
      version: String(row.version),
      releaseDate: String(row.releaseDate),
      currentVersionReleaseDate: String(
        row.currentVersionReleaseDate,
      ),
      contentAdvisoryRating: String(
        row.contentAdvisoryRating,
      ),
      metadataFetchedAt: String(
        row.metadataFetchedAt,
      ),
      delisted: row.delisted === 1,
      tags: tags.map((tag) => ({
        tagId: String(tag.tagId),
        tier: tag.tier,
        method: String(tag.method),
      })),
      rating: {
        average: rating?.average ?? null,
        count: rating?.count ?? null,
        tier: rating?.tier ?? "unavailable",
      },
      momentum,
      downloads: downloadRange(),
      signals: signals
        ? {
            colorText: String(signals.colorText),
            letters: String(signals.letters),
            tier: signals.tier,
            method: String(signals.method),
          }
        : null,
      matchProbability,
    };
  } finally {
    db.close();
  }
}
