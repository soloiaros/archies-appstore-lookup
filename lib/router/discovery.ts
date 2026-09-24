import type { Catalog } from "@/lib/catalog/types";

import {
  aboveThreshold,
  scoreFinalists,
} from "@/lib/jev/score";

import { deepenFinalists } from "@/lib/retrieve/finalists";

import type { DiscoveryAnswer } from "@/lib/types";

import type { Finalist } from "@/lib/types";

const DEEPEN = 0.65;

export async function answerDiscovery(
  query: string,
  catalog: Catalog,
): Promise<DiscoveryAnswer> {
  const timed = await answerDiscoveryTimed(
    query,
    catalog,
  );

  return timed.answer;
}

export async function answerDiscoveryTimed(
  query: string,
  catalog: Catalog,
): Promise<{
  answer: DiscoveryAnswer;

  embedMs: number;

  jevMs: number;
}> {
  const embedStarted = performance.now();

  const finalists = await catalog.finalists(
    query,
  );

  const embedMs = performance.now() - embedStarted;

  const jevStarted = performance.now();

  const scored = await scoreFinalists(
    query,
    finalists,
  );

  let scores = scored.scores;

  let pool = finalists;

  if (scored.status === "scored") {
    const best = Math.max(
      0,
      ...scores.map((score) => score.probability),
    );

    if (best < DEEPEN) {
      const hints = tagHints(
        finalists,
        scores,
      );

      const extra = await deepenFinalists(
        finalists.map((finalist) => finalist.trackId),
        hints,
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
  }

  const jevMs = performance.now() - jevStarted;

  return {
    embedMs: Math.round(embedMs),
    jevMs: Math.round(jevMs),
    answer: toAnswer(
      query,
      pool,
      finalists.length,
      scored.status === "unavailable"
        ? {
            status: "unavailable",
            scores: [],
            reason: scored.reason,
          }
        : {
            status: "scored",
            scores,
            reason: null,
          },
    ),
  };
}

function toAnswer(
  query: string,
  finalists: Finalist[],
  finalistCount: number,
  scored: {
    status: "scored" | "unavailable";

    scores: Array<{
      trackId: number;

      probability: number;
    }>;

    reason: string | null;
  },
): DiscoveryAnswer {
  if (scored.status === "unavailable") {
    return {
      shape: "discovery",
      query,
      tier: "unavailable",
      scoring: "unavailable",
      scoringNote:
        scored.reason
        ?? "Scoring needs an OpenRouter key.",
      finalistCount,
      hits: [],
    };
  }

  const kept = aboveThreshold(scored.scores);

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
    tier: hits.length ? "estimated" : "unavailable",
    scoring: "scored",
    scoringNote: null,
    finalistCount,
    hits,
  };
}

function tagHints(
  finalists: Finalist[],
  scores: Array<{
    trackId: number;

    probability: number;
  }>,
): string[] {
  const order = [...scores].sort(
    (left, right) =>
      right.probability - left.probability,
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
