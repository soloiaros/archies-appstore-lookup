import tagFile from "../../data/tags/tags.json";

import {
  LETTER_WORDS,
  queryMentionsLetters,
} from "../retrieve/cues";

export const TEXT_MODEL = "Xenova/bge-small-en-v1.5";

export const ICON_MODEL = "onnx-community/siglip2-base-patch16-224-ONNX";

export const TEXT_DIMS = 384;

export const ICON_DIMS = 768;

const BY_MEANING = 40;

const BY_LOOKS = 40;

const BY_TAGS = 16;

const BY_LEXICAL = 16;

const BY_NAME = 25;

const FINALIST_CAP = 120;

const TAGS = tagFile.tags;

export type CatalogApp = {
  trackId: number;

  name: string;

  blurb: string;

  letters: string;

  tags: string[];
};

export type PackedVectors = {
  ids: Int32Array;

  data: Float32Array;

  dims: number;
};

export function emptyPacked(dims: number): PackedVectors {
  return {
    ids: new Int32Array(),
    data: new Float32Array(),
    dims,
  };
}

export function packVectors(
  rows: Array<{ trackId: number; vector: Float32Array }>,
  dims: number,
): PackedVectors {
  const sorted = [...rows].sort(
    (left, right) => left.trackId - right.trackId,
  );

  const ids = new Int32Array(sorted.length);

  const data = new Float32Array(sorted.length * dims);

  let count = 0;

  for (const row of sorted) {
    if (row.vector.length !== dims) {
      continue;
    }

    ids[count] = row.trackId;

    data.set(row.vector, count * dims);

    count += 1;
  }

  return {
    ids: ids.subarray(0, count),
    data: data.subarray(0, count * dims),
    dims,
  };
}

export function nominateIds(
  query: string,
  apps: CatalogApp[],
  asking: Float32Array,
  text: PackedVectors,
  looking: Float32Array | null,
  icons: PackedVectors,
): number[] {
  const nominated = new Map<number, number>();

  const bump = (trackId: number, score: number) => {
    nominated.set(
      trackId,
      Math.max(nominated.get(trackId) ?? 0, score),
    );
  };

  for (const hit of topDot(asking, text, BY_MEANING)) {
    bump(hit.trackId, hit.score);
  }

  if (
    looking
    && looking.length === ICON_DIMS
    && icons.ids.length > 0
  ) {
    for (const hit of topDot(looking, icons, BY_LOOKS)) {
      bump(hit.trackId, 0.5 + hit.score);
    }
  }

  for (const hit of tagOverlap(query, apps).slice(0, BY_TAGS)) {
    bump(hit.trackId, 0.4 + hit.score);
  }

  for (const hit of lexicalHits(query, apps).slice(0, BY_LEXICAL)) {
    bump(hit.trackId, 0.3 + hit.score);
  }

  for (const trackId of nameHits(query, apps).slice(0, BY_NAME)) {
    bump(trackId, 0.95);
  }

  if (queryMentionsLetters(query)) {
    for (const trackId of letterHits(query, apps)) {
      bump(trackId, 0.9);
    }
  }

  return [...nominated.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, FINALIST_CAP)
    .map(([trackId]) => trackId);
}

export function decodeVector(
  encoded: string,
  width: number,
): Float32Array | null {
  if (encoded.length === 0) {
    return null;
  }

  const bytes = Buffer.from(encoded, "base64");

  return floatsFromBytes(bytes, width / 4);
}

export function encodeVector(vector: Float32Array): string {
  const bytes = new Uint8Array(vector.byteLength);

  bytes.set(
    new Uint8Array(
      vector.buffer,
      vector.byteOffset,
      vector.byteLength,
    ),
  );

  return Buffer.from(bytes).toString("base64");
}

export function floatsFromBytes(
  bytes: Uint8Array,
  dims: number,
): Float32Array | null {
  if (bytes.byteLength !== dims * 4) {
    return null;
  }

  const copy = new Uint8Array(bytes.byteLength);

  copy.set(bytes);

  return new Float32Array(copy.buffer);
}

function topDot(
  query: Float32Array,
  packed: PackedVectors,
  limit: number,
): Array<{ trackId: number; score: number }> {
  if (query.length !== packed.dims || packed.ids.length === 0) {
    return [];
  }

  const hits: Array<{ trackId: number; score: number }> = [];

  const dims = packed.dims;

  for (let row = 0; row < packed.ids.length; row += 1) {
    let sum = 0;

    const offset = row * dims;

    for (let index = 0; index < dims; index += 1) {
      sum += query[index]! * packed.data[offset + index]!;
    }

    hits.push({
      trackId: packed.ids[row]!,
      score: sum,
    });
  }

  hits.sort((left, right) => right.score - left.score);

  return hits.slice(0, limit);
}

function wordsOf(query: string, min: number): string[] {
  return tokenize(query).filter((word) => word.length >= min);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}

function nameHits(
  query: string,
  apps: CatalogApp[],
): number[] {
  const words = wordsOf(query, 4);

  if (words.length === 0) {
    return [];
  }

  return apps
    .filter((app) => {
      const name = app.name.toLowerCase();

      return words.some((word) => name.includes(word));
    })
    .map((app) => app.trackId);
}

function lexicalHits(
  query: string,
  apps: CatalogApp[],
): Array<{ trackId: number; score: number }> {
  const words = wordsOf(query, 3);

  if (words.length === 0) {
    return [];
  }

  return apps
    .map((app) => {
      const hay = tokenize(`${app.name} ${app.blurb}`);

      let hits = 0;

      for (const word of words) {
        if (hay.includes(word)) {
          hits += 1;
        }
      }

      return {
        trackId: app.trackId,
        score: hits / words.length,
      };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score);
}

function letterHits(
  query: string,
  apps: CatalogApp[],
): number[] {
  const words = tokenize(query).filter(
    (word) => word.length >= 3 && !LETTER_WORDS.has(word),
  );

  if (words.length === 0) {
    return [];
  }

  return apps
    .filter((app) => {
      const letters = app.letters.toLowerCase();

      return (
        letters.length > 0
        && words.some((word) => letters.includes(word))
      );
    })
    .map((app) => app.trackId);
}

function tagOverlap(
  query: string,
  apps: CatalogApp[],
): Array<{ trackId: number; score: number }> {
  const words = tokenize(query);

  if (words.length === 0) {
    return [];
  }

  const matched = new Set<string>();

  for (const tag of TAGS) {
    const hay = tokenize(`${tag.id} ${tag.label}`);

    if (hay.some((word) => words.includes(word))) {
      matched.add(tag.id);
    }
  }

  if (matched.size === 0) {
    return [];
  }

  const scores: Array<{ trackId: number; score: number }> = [];

  for (const app of apps) {
    let hits = 0;

    for (const tag of app.tags) {
      if (matched.has(tag)) {
        hits += 1;
      }
    }

    if (hits > 0) {
      scores.push({
        trackId: app.trackId,
        score: hits / matched.size,
      });
    }
  }

  return scores.sort(
    (left, right) => right.score - left.score,
  );
}
