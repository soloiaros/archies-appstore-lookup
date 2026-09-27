import {
  cloudCatalog,
  lexicalDiscovery,
  scoredDiscovery,
} from "@/lib/catalog/cloud";

import { sqliteCatalog } from "@/lib/catalog/sqlite";

import { loadLocalEnv } from "@/lib/env";

import { deepenCandidates } from "@/lib/catalog/vectors";

import { catalogDb } from "@/lib/site/db";

import { answerComparative } from "@/lib/router/comparative";

import { answerFactual } from "@/lib/router/factual";

import { classify } from "@/lib/router/classify";

import type { Finalist, QueryAnswer } from "@/lib/types";

loadLocalEnv();

export async function answer(
  query: string,
): Promise<QueryAnswer> {
  const shape = classify(query);

  const remote = await catalogDb();

  const catalog = remote
    ? cloudCatalog(remote)
    : sqliteCatalog();

  try {
    if (shape === "factual") {
      return await answerFactual(
        query,
        catalog,
      );
    }

    if (shape === "comparative") {
      return await answerComparative(
        query,
        catalog,
      );
    }

    if (remote) {
      const found = await catalog.finalists(query);

      const { scoreFinalists } = await import(
        "@/lib/jev/score"
      );

      const scored = await scoreFinalists(
        query,
        found,
      );

      if (scored.status === "scored") {
        let pool = found;

        let scores = scored.scores;

        const best = Math.max(
          0,
          ...scores.map((score) => score.probability),
        );

        if (best < 0.65) {
          const extra = await deepenCandidates(
            remote,
            found.map((finalist) => finalist.trackId),
            tagHints(found, scores),
          );

          if (extra.length > 0) {
            const second = await scoreFinalists(
              query,
              extra,
            );

            if (second.status === "scored") {
              scores = scores.concat(second.scores);

              pool = pool.concat(extra);
            }
          }
        }

        return scoredDiscovery(
          query,
          pool,
          scores,
        );
      }

      return lexicalDiscovery(
        query,
        found,
        scored.reason,
      );
    }

    const { answerDiscovery } = await import(
      "@/lib/router/discovery"
    );

    return await answerDiscovery(
      query,
      catalog,
    );
  } finally {
    catalog.close();
  }
}

function tagHints(
  finalists: Finalist[],
  scores: Array<{
    trackId: number;

    probability: number;
  }>,
): string[] {
  const order = [...scores].sort(
    (left, right) => right.probability - left.probability,
  );

  const tags = new Set<string>();

  for (const score of order.slice(0, 5)) {
    const finalist = finalists.find(
      (item) => item.trackId === score.trackId,
    );

    for (const tag of finalist?.tags ?? []) {
      tags.add(tag);
    }
  }

  return [...tags];
}

export { classify } from "@/lib/router/classify";
