import type { Finalist } from "@/lib/types";

export type ScoredFinalist = {
  trackId: number;

  probability: number;
};

export async function scoreFinalists(
  query: string,
  finalists: Finalist[],
): Promise<ScoredFinalist[]> {
  // TODO(phase-5)

  void query;

  void finalists;

  return [];
}
