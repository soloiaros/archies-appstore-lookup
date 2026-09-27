import { loadLocalEnv } from "@/lib/env";

import { sqliteCatalog } from "@/lib/catalog/sqlite";

import { answerComparative } from "@/lib/router/comparative";

import { answerFactual } from "@/lib/router/factual";

import { classify } from "@/lib/router/classify";

import type { QueryAnswer } from "@/lib/types";

loadLocalEnv();

export async function answer(
  query: string,
): Promise<QueryAnswer> {
  const shape = classify(query);

  const catalog = sqliteCatalog();

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
