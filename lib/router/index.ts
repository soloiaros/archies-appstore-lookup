import { loadLocalEnv } from "@/lib/env";

import { sqliteCatalog } from "@/lib/catalog/sqlite";

import { answerComparative } from "@/lib/router/comparative";

import { answerDiscovery } from "@/lib/router/discovery";

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

    return await answerDiscovery(
      query,
      catalog,
    );
  } finally {
    catalog.close();
  }
}

export { classify } from "@/lib/router/classify";
