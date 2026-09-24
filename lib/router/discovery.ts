import type { Catalog } from "@/lib/catalog/types";

import {
  aboveThreshold,
  scoreFinalists,
} from "@/lib/jev/score";

import type { DiscoveryAnswer } from "@/lib/types";

export async function answerDiscovery(
  query: string,
  catalog: Catalog,
): Promise<DiscoveryAnswer> {
  const finalists = await catalog.finalists(
    query,
  );

  const scored = await scoreFinalists(
    query,
    finalists,
  );

  if (scored.status === "unavailable") {
    return {
      shape: "discovery",
      query,
      tier: "unavailable",
      scoring: "unavailable",
      scoringNote:
        scored.reason
        ?? "Scoring needs an OpenRouter key.",
      finalistCount: finalists.length,
      hits: [],
    };
  }

  const kept = aboveThreshold(
    scored.scores,
  );

  const byId = new Map(
    finalists.map((finalist) => [
      finalist.trackId,
      finalist,
    ]),
  );

  const hits = kept.flatMap((score) => {
    const finalist = byId.get(score.trackId);

    if (!finalist) {
      return [];
    }

    return [
      {
        trackId: score.trackId,
        name: finalist.name,
        iconUrl: finalist.iconUrl,
        probability: score.probability,
      },
    ];
  });

  return {
    shape: "discovery",
    query,
    tier: hits.length
      ? "estimated"
      : "unavailable",
    scoring: "scored",
    scoringNote: null,
    finalistCount: finalists.length,
    hits,
  };
}
