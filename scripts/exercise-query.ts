import { answer } from "../lib/router";

import { classify } from "../lib/router/classify";

async function main(): Promise<void> {
  const cases = [
    "ChatGPT",
    "apps growing by momentum",
    "minimalist habit tracker",
    "a",
  ];

  for (const query of cases) {
    if (query.length < 2) {
      console.log(
        JSON.stringify({
          query,
          rejected: true,
          reason: "too short",
        }),
      );

      continue;
    }

    const shape = classify(query);

    const result = await answer(query);

    console.log(
      JSON.stringify({
        query,
        shape,
        answerShape: result.shape,
        tier: result.tier,
        summary:
          result.shape === "factual"
            ? {
                found: result.app !== null,
                name: result.app?.name ?? null,
                momentum: result.app?.momentum.tier,
                downloads: result.app?.downloads.tier,
              }
            : result.shape === "comparative"
              ? {
                  rows: result.rows.length,
                  momentumTiers: [
                    ...new Set(
                      result.rows.map(
                        (row) => row.momentum.tier,
                      ),
                    ),
                  ],
                }
              : {
                  scoring: result.scoring,
                  finalistCount: result.finalistCount,
                  hits: result.hits.length,
                  scoringNote: result.scoringNote,
                },
      }),
    );
  }
}

void main();
