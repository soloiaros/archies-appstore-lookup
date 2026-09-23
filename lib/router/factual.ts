import type { Catalog } from "@/lib/catalog/types";

import { downloadRange } from "@/lib/pipeline/download";

import { momentumFromCharts } from "@/lib/pipeline/momentum";

import {
  isStale,
  METADATA_MAX_AGE_MS,
} from "@/lib/provenance/staleness";

import {
  lookupByName,
  refreshOneApp,
} from "@/lib/scrape/single";

import type { FactualAnswer } from "@/lib/types";

import type { AppMetadata } from "@/models/app";

export async function answerFactual(
  query: string,
  catalog: Catalog,
): Promise<FactualAnswer> {
  let app = await catalog.findByName(query);

  if (app && isStale(app.metadataFetchedAt, METADATA_MAX_AGE_MS)) {
    const refreshed = await refreshOneApp(
      app.trackId,
    );

    if (refreshed) {
      app = refreshed;
    }
  }

  if (!app) {
    app = await lookupByName(query);
  }

  if (!app) {
    return {
      shape: "factual",
      query,
      tier: "unavailable",
      app: null,
    };
  }

  const ratings = await catalog.ratings(
    app.trackId,
  );

  const charts = await catalog.charts(
    app.trackId,
  );

  const latest = [...ratings]
    .sort((left, right) =>
      left.capturedAt.localeCompare(
        right.capturedAt,
      ),
    )
    .at(-1) ?? null;

  return {
    shape: "factual",
    query,
    tier: "verified",
    app: factualFrom(
      app,
      latest?.ratingAverage ?? null,
      latest?.ratingCount ?? null,
      latest
        ? "verified"
        : "unavailable",
      momentumFromCharts(charts),
    ),
  };
}

function factualFrom(
  app: AppMetadata,
  ratingAverage: number | null,
  ratingCount: number | null,
  ratingTier: "verified" | "unavailable",
  momentum: ReturnType<typeof momentumFromCharts>,
) {
  return {
    trackId: app.trackId,
    name: app.name,
    description: app.description,
    iconUrl: app.iconUrl,
    category: app.primaryGenre,
    priceLabel: app.formattedPrice,
    storeUrl: app.storeUrl,
    ratingAverage,
    ratingCount,
    ratingTier,
    metadataFetchedAt: app.metadataFetchedAt,
    momentum,
    downloads: downloadRange(),
  };
}
