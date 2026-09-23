import {
  CERTAINTY_THRESHOLD,
  aboveThreshold,
  scoreFinalists,
} from "../lib/jev/score";

import type { Finalist } from "../lib/types";

async function main(): Promise<void> {
  delete process.env.TYPE_SAFE_KEY;

  const finalists: Finalist[] = [
    {
      trackId: 1,
      name: "Habit One",
      description: "A minimalist habit tracker.",
      iconUrl: "https://example.com/1.png",
      tags: ["habit-tracker"],
    },
    {
      trackId: 2,
      name: "Chess Pro",
      description: "Play chess online.",
      iconUrl: "https://example.com/2.png",
      tags: ["chess"],
    },
    {
      trackId: 3,
      name: "Budget Kit",
      description: "Envelope budget planner.",
      iconUrl: "https://example.com/3.png",
      tags: ["budgeting"],
    },
  ];

  const missing = await scoreFinalists(
    "minimalist habit tracker",
    finalists,
  );

  if (missing.status !== "unavailable") {
    throw new Error("expected unavailable without key");
  }

  console.log(
    JSON.stringify({
      withoutKey: missing,
    }),
  );

  process.env.TYPE_SAFE_KEY = "test-key";

  const mocked = await scoreFinalists(
    "minimalist habit tracker",
    finalists,
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            answers: {
              c0: { noul: 0.82 },
              c1: { noul: 0.11 },
              c2: { noul: 0.41 },
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
    },
  );

  if (mocked.status !== "scored") {
    throw new Error("expected scored with mock");
  }

  const kept = aboveThreshold(
    mocked.scores,
  );

  const report = {
    threshold: CERTAINTY_THRESHOLD,
    scores: mocked.scores,
    kept: kept.map((row) => row.trackId),
  };

  console.log(JSON.stringify(report, null, 2));

  if (
    kept.length !== 2
    || kept[0]?.trackId !== 1
    || kept[1]?.trackId !== 3
  ) {
    throw new Error("threshold filter wrong");
  }

  delete process.env.TYPE_SAFE_KEY;
}

void main();
