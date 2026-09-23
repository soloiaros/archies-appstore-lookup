import { emptyCatalog } from "@/lib/catalog";

import { answerComparative } from "@/lib/router/comparative";

import { answerDiscovery } from "@/lib/router/discovery";

import { answerFactual } from "@/lib/router/factual";

import { classify } from "@/lib/router/classify";

import type { QueryAnswer } from "@/lib/types";

export async function answer(
  query: string,
): Promise<QueryAnswer> {
  const shape = classify(query);

  const catalog = emptyCatalog();

  if (shape === "factual") {
    return answerFactual(
      query,
      catalog,
    );
  }

  if (shape === "comparative") {
    return answerComparative(
      query,
      catalog,
    );
  }

  return answerDiscovery(
    query,
    catalog,
  );
}

export { classify } from "@/lib/router/classify";
