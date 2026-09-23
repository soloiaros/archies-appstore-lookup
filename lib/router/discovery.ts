import type { Catalog } from "@/lib/catalog";

import { scoreFinalists } from "@/lib/jev/score";

import type { DiscoveryAnswer } from "@/lib/types";

export async function answerDiscovery(
  query: string,
  catalog: Catalog,
): Promise<DiscoveryAnswer> {
  const finalists = await catalog.finalists(
    query,
  );

  const scores = await scoreFinalists(
    query,
    finalists,
  );

  const byId = new Map(
    finalists.map((finalist) => [
      finalist.trackId,
      finalist,
    ]),
  );

  const hits = scores.flatMap((score) => {
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
      ? "verified"
      : "unavailable",
    hits,
  };
}
