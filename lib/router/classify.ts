import type { QueryShape } from "@/lib/types";

const COMPARATIVE =
  /\b(vs\.?|versus|compare[sd]?|faster|slower|growing|momentum|outrank)\b/i;

const FACTUAL_START =
  /^(what|who|when|rating|price)\b/i;

const DISCOVERY_CUE =
  /\b(apps?|for|like|with|tracker|tool|similar|that)\b/i;

export function classify(
  query: string,
): QueryShape {
  // TODO(phase-4)

  const text = query.trim();

  if (COMPARATIVE.test(text)) {
    return "comparative";
  }

  const words = text
    .split(/\s+/)
    .filter(Boolean);

  const named =
    words.length > 0
    && words.length <= 3
    && !DISCOVERY_CUE.test(text);

  if (
    FACTUAL_START.test(text)
    || named
  ) {
    return "factual";
  }

  return "discovery";
}
