import type { ChartKind } from "@/models/series";

import { getJson } from "@/lib/scrape/http";

import {
  asNumber,
  isRecord,
} from "@/lib/scrape/json";

export const CHART_LIMIT = 100;

const LEGACY_CHARTS: Record<ChartKind, string> = {
  "top-free": "topfreeapplications",
  "top-paid": "toppaidapplications",
  "top-grossing": "topgrossingapplications",
};

export type ChartSource =
  | "marketing"
  | "legacy";

export type ChartHit = {
  trackId: number;

  rank: number;
};

export function marketingFeedUrl(
  country: string,
  chart: ChartKind,
): string {
  return [
    "https://rss.applemarketingtools.com/api/v2",
    country,
    "apps",
    chart,
    String(CHART_LIMIT),
    "apps.json",
  ].join("/");
}

export function categoryFeedUrl(
  country: string,
  chart: ChartKind,
  genreId: number | null,
): string {
  const parts = [
    "https://itunes.apple.com",
    country,
    "rss",
    LEGACY_CHARTS[chart],
    `limit=${CHART_LIMIT}`,
  ];

  if (genreId !== null) {
    parts.push(
      `genre=${genreId}`,
    );
  }

  parts.push("json");

  return parts.join("/");
}

export function trackIdsFromMarketing(
  payload: unknown,
): ChartHit[] {
  if (
    !isRecord(payload)
    || !isRecord(payload.feed)
    || !Array.isArray(payload.feed.results)
  ) {
    return [];
  }

  const hits: ChartHit[] = [];

  payload.feed.results.forEach(
    (entry, index) => {
      if (!isRecord(entry)) {
        return;
      }

      const trackId = asNumber(entry.id);

      if (
        trackId === null
        || !Number.isSafeInteger(trackId)
        || trackId <= 0
      ) {
        return;
      }

      hits.push({
        trackId,
        rank: index + 1,
      });
    },
  );

  return hits;
}

export function trackIdsFromLegacy(
  payload: unknown,
): ChartHit[] {
  if (
    !isRecord(payload)
    || !isRecord(payload.feed)
  ) {
    return [];
  }

  const entry = payload.feed.entry;

  const entries = Array.isArray(entry)
    ? entry
    : entry === undefined
      ? []
      : [entry];

  const hits: ChartHit[] = [];

  entries.forEach(
    (item, index) => {
      if (!isRecord(item) || !isRecord(item.id)) {
        return;
      }

      const attributes = item.id.attributes;

      if (!isRecord(attributes)) {
        return;
      }

      const trackId = asNumber(
        attributes["im:id"],
      );

      if (
        trackId === null
        || !Number.isSafeInteger(trackId)
        || trackId <= 0
      ) {
        return;
      }

      hits.push({
        trackId,
        rank: index + 1,
      });
    },
  );

  return hits;
}

export async function fetchChart(
  url: string,
  source: ChartSource,
): Promise<ChartHit[]> {
  const payload = await getJson(url);

  if (source === "marketing") {
    return trackIdsFromMarketing(payload);
  }

  return trackIdsFromLegacy(payload);
}
