import {
  cloudCatalog,
  lexicalDiscovery,
  scoredDiscovery,
} from "@/lib/catalog/cloud";

import { sqliteCatalog } from "@/lib/catalog/sqlite";

import { loadLocalEnv } from "@/lib/env";

import { catalogDb } from "@/lib/site/db";

import { answerComparative } from "@/lib/router/comparative";

import { answerFactual } from "@/lib/router/factual";

import { classify } from "@/lib/router/classify";

import type { QueryAnswer } from "@/lib/types";

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
        return scoredDiscovery(
          query,
          found,
          scored.scores,
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

export { classify } from "@/lib/router/classify";
