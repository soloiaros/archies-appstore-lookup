import type { Catalog } from "@/lib/catalog";

import { downloadRange } from "@/lib/pipeline/download";

import { momentumFromCharts } from "@/lib/pipeline/momentum";

import type { FactualAnswer } from "@/lib/types";

export async function answerFactual(
  query: string,
  catalog: Catalog,
): Promise<FactualAnswer> {
  const app = await catalog.findByName(query);

  // TODO(phase-6)

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
    app: {
      trackId: app.trackId,
      name: app.name,
      description: app.description,
      iconUrl: app.iconUrl,
      category: app.primaryGenre,
      priceLabel: app.formattedPrice,
      storeUrl: app.storeUrl,
      ratingAverage: latest?.ratingAverage ?? null,
      ratingCount: latest?.ratingCount ?? null,
      ratingTier: latest
        ? "verified"
        : "unavailable",
      metadataFetchedAt: app.metadataFetchedAt,
      momentum: momentumFromCharts(charts),
      downloads: downloadRange(),
    },
  };
}
