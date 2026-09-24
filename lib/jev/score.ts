import { systemOne } from "@/lib/jev/call";

import { SCORE_INSTRUCTIONS } from "@/lib/jev/prompt";

import {
  queryMentionsColor,
  queryMentionsLetters,
} from "@/lib/retrieve/finalists";

import type { Finalist } from "@/lib/types";

export type ScoredFinalist = {
  trackId: number;

  probability: number;
};

export type ScoreResult = {
  status: "scored" | "unavailable";

  scores: ScoredFinalist[];

  reason: string | null;
};

export type ScoreOptions = {
  fetchImpl?: typeof fetch;
};

export const CERTAINTY_THRESHOLD = 0.3;

const HOW =
  "`looking_for` is a person's loose description of an App Store app they want. "
  + "Each question shows one candidate: `written_info` is the app name, description, and tags. "
  + "A candidate fits when a person with that app in mind could plausibly have written `looking_for`. "
  + "Several candidates may fit.";

export async function scoreFinalists(
  query: string,
  finalists: Finalist[],
  options: ScoreOptions = {},
): Promise<ScoreResult> {
  if (finalists.length === 0) {
    return {
      status: "unavailable",
      scores: [],
      reason: "No finalists.",
    };
  }

  const questions: Record<string, unknown> = {};

  finalists.forEach((finalist, index) => {
    questions[`c${index}`] = {
      type: "noul",
      instructions: {
        candidate: {
          written_info: infoLine(
            finalist,
            query,
          ),
        },
        question:
          "Does `candidate` fit what `looking_for` describes?",
      },
    };
  });

  const data = await systemOne<{
    answers: Record<
      string,
      {
        noul?: number;
      }
    >;
  }>(
    {
      state: {
        looking_for: query.slice(0, 300),
        how_to_judge: `${SCORE_INSTRUCTIONS} ${HOW}`,
      },
      questions,
    },
    15000,
    options.fetchImpl,
  );

  if (!data.ok) {
    return {
      status: "unavailable",
      scores: [],
      reason: scoreReason(data.reason),
    };
  }

  return {
    status: "scored",
    reason: null,
    scores: finalists.map((finalist, index) => ({
      trackId: finalist.trackId,
      probability:
        data.data.answers[`c${index}`]?.noul ?? 0.5,
    })),
  };
}

export function aboveThreshold(
  scores: ScoredFinalist[],
  threshold = CERTAINTY_THRESHOLD,
): ScoredFinalist[] {
  return scores
    .filter(
      (score) => score.probability >= threshold,
    )
    .sort(
      (left, right) =>
        right.probability - left.probability,
    );
}

function scoreReason(
  reason: "missing-key" | "rejected" | "unavailable",
): string {
  if (reason === "missing-key") {
    return "Scoring needs an OpenRouter key.";
  }

  if (reason === "rejected") {
    return "Jev rejected the API key.";
  }

  return "Jev did not answer.";
}

function infoLine(
  finalist: Finalist,
  query: string,
): string {
  const tags =
    finalist.tags.length > 0
      ? finalist.tags.join(", ")
      : "none";

  const parts = [
    `${finalist.name}: ${finalist.description.slice(0, 420)}`,
    `tags: ${tags}`,
  ];

  if (
    queryMentionsColor(query)
    && finalist.colorText
  ) {
    parts.push(`colors: ${finalist.colorText}`);
  }

  if (
    queryMentionsLetters(query)
    && finalist.letters
  ) {
    parts.push(`letters: ${finalist.letters}`);
  }

  return parts.join(" | ");
}
