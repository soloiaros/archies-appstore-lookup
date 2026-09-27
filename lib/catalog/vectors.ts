import { workersAi } from "@/lib/site/db";

import type { SiteSql } from "@/lib/site/types";

import {
  LETTER_WORDS,
  queryMentionsLetters,
} from "@/lib/retrieve/cues";

import type { Finalist } from "@/lib/types";

const STORED_MODEL = "Xenova/bge-small-en-v1.5";

const QUERY_MODEL = "@cf/baai/bge-small-en-v1.5";

const ASKING =
  "Represent this sentence for searching relevant passages: ";

const BGE_DIMS = 384;

const BY_MEANING = 40;

const BY_LEXICAL = 16;

const BY_NAME = 25;

const FINALIST_CAP = 120;

const PAGE = 500;

let textVectors: Map<number, Float32Array> | null = null;

let textLoad: Promise<Map<number, Float32Array>> | null = null;

export async function vectorFinalists(
  sql: SiteSql,
  query: string,
): Promise<Finalist[] | null> {
  try {
    const vectors = await loadTextVectors(sql);

    if (vectors.size === 0) {
      return null;
    }

    const asking = await embedQuery(query);

    if (!asking) {
      return null;
    }

    const nominated = new Map<number, number>();

    const bump = (trackId: number, score: number) => {
      nominated.set(
        trackId,
        Math.max(nominated.get(trackId) ?? 0, score),
      );
    };

    const meaning = [...vectors.entries()]
      .map(([trackId, vector]) => ({
        trackId,
        score: cosine(asking, vector),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, BY_MEANING);

    for (const hit of meaning) {
      bump(hit.trackId, hit.score);
    }

    for (const trackId of await nameHits(sql, query)) {
      bump(trackId, 0.95);
    }

    for (const hit of await lexicalHits(sql, query)) {
      bump(hit.trackId, 0.3 + hit.score);
    }

    if (queryMentionsLetters(query)) {
      try {
        for (const trackId of await letterHits(sql, query)) {
          bump(trackId, 0.9);
        }
      } catch {
        // signals absent
      }
    }

    const ids = [...nominated.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, FINALIST_CAP)
      .map(([trackId]) => trackId);

    if (ids.length === 0) {
      return [];
    }

    return hydrate(sql, ids);
  } catch {
    return null;
  }
}

async function embedQuery(
  query: string,
): Promise<Float32Array | null> {
  const ai = await workersAi();

  if (!ai) {
    return null;
  }

  const result = await ai.run(QUERY_MODEL, {
    text: [ASKING + query],
    pooling: "cls",
  });

  const raw = firstVector(result?.data);

  if (!raw || raw.length !== BGE_DIMS) {
    return null;
  }

  return l2Normalize(Float32Array.from(raw));
}

function firstVector(data: unknown): number[] | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  if (typeof data[0] === "number") {
    return data as number[];
  }

  if (
    Array.isArray(data[0])
    && typeof data[0][0] === "number"
  ) {
    return data[0] as number[];
  }

  return null;
}

async function loadTextVectors(
  sql: SiteSql,
): Promise<Map<number, Float32Array>> {
  if (textVectors && textVectors.size > 0) {
    return textVectors;
  }

  if (!textLoad) {
    textLoad = readTextVectors(sql)
      .then((map) => {
        if (map.size > 0) {
          textVectors = map;
        }

        textLoad = null;

        return map;
      })
      .catch((error) => {
        textLoad = null;

        throw error;
      });
  }

  return textLoad;
}

async function readTextVectors(
  sql: SiteSql,
): Promise<Map<number, Float32Array>> {
  const vectors = new Map<number, Float32Array>();

  let after = 0;

  for (;;) {
    const rows = await sql.all<{
      trackId: number;
      vector: string;
    }>(
      `
      select track_id as trackId, vector
      from text_embeddings
      where model = ? and track_id > ?
      order by track_id
      limit ${PAGE}
      `,
      [STORED_MODEL, after],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const trackId = Number(row.trackId);

      const vector = decodeVector(String(row.vector ?? ""));

      if (vector) {
        vectors.set(trackId, vector);
      }

      after = trackId;
    }

    if (rows.length < PAGE) {
      break;
    }
  }

  return vectors;
}

function decodeVector(encoded: string): Float32Array | null {
  if (encoded.length === 0) {
    return null;
  }

  const bytes = Buffer.from(encoded, "base64");

  if (bytes.byteLength !== BGE_DIMS * 4) {
    return null;
  }

  const copy = new Uint8Array(bytes.byteLength);

  copy.set(bytes);

  return new Float32Array(copy.buffer);
}

function cosine(
  left: Float32Array,
  right: Float32Array,
): number {
  let sum = 0;

  for (let index = 0; index < left.length; index += 1) {
    sum += left[index]! * right[index]!;
  }

  return sum;
}

function l2Normalize(vector: Float32Array): Float32Array {
  let sum = 0;

  for (const value of vector) {
    sum += value * value;
  }

  const norm = Math.sqrt(sum);

  if (norm === 0) {
    return vector;
  }

  const out = new Float32Array(vector.length);

  for (let index = 0; index < vector.length; index += 1) {
    out[index] = vector[index]! / norm;
  }

  return out;
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

async function nameHits(
  sql: SiteSql,
  query: string,
): Promise<number[]> {
  const words = wordsOf(query, 4).slice(0, 8);

  if (words.length === 0) {
    return [];
  }

  const where = words
    .map(() => "lower(name) like ?")
    .join(" or ");

  const rows = await sql.all<{ trackId: number }>(
    `
    select track_id as trackId
    from apps
    where delisted = 0
      and (${where})
    limit ${BY_NAME}
    `,
    words.map((word) => `%${word}%`),
  );

  return rows.map((row) => Number(row.trackId));
}

async function lexicalHits(
  sql: SiteSql,
  query: string,
): Promise<Array<{ trackId: number; score: number }>> {
  const words = wordsOf(query, 3).slice(0, 8);

  if (words.length === 0) {
    return [];
  }

  const where = words
    .map(() => "(lower(name) like ? or lower(description) like ?)")
    .join(" or ");

  const params = words.flatMap((word) => [`%${word}%`, `%${word}%`]);

  const rows = await sql.all<{
    trackId: number;
    name: string;
    blurb: string;
  }>(
    `
    select
      track_id as trackId,
      name,
      substr(description, 1, 800) as blurb
    from apps
    where delisted = 0
      and (${where})
    limit 200
    `,
    params,
  );

  return rows
    .map((row) => {
      const hay = tokenize(`${row.name} ${row.blurb ?? ""}`);

      let hits = 0;

      for (const word of words) {
        if (hay.includes(word)) {
          hits += 1;
        }
      }

      return {
        trackId: Number(row.trackId),
        score: hits / words.length,
      };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, BY_LEXICAL);
}

async function letterHits(
  sql: SiteSql,
  query: string,
): Promise<number[]> {
  const words = tokenize(query)
    .filter(
      (word) => word.length >= 3 && !LETTER_WORDS.has(word),
    )
    .slice(0, 8);

  if (words.length === 0) {
    return [];
  }

  const where = words
    .map(() => "lower(letters) like ?")
    .join(" or ");

  const rows = await sql.all<{ trackId: number }>(
    `
    select track_id as trackId
    from icon_signals
    where letters != ''
      and (${where})
    limit 40
    `,
    words.map((word) => `%${word}%`),
  );

  return rows.map((row) => Number(row.trackId));
}

async function hydrate(
  sql: SiteSql,
  ids: number[],
): Promise<Finalist[]> {
  const marks = ids.map(() => "?").join(", ");

  const apps = await sql.all<{
    trackId: number;
    name: string;
    description: string;
    iconUrl: string;
  }>(
    `
    select
      track_id as trackId,
      name,
      description,
      icon_url as iconUrl
    from apps
    where track_id in (${marks})
    `,
    ids,
  );

  const byId = new Map(
    apps.map((row) => [Number(row.trackId), row]),
  );

  const tags = new Map<number, string[]>();

  try {
    const rows = await sql.all<{
      trackId: number;
      tagId: string;
    }>(
      `
      select track_id as trackId, tag_id as tagId
      from app_tags
      where track_id in (${marks})
      `,
      ids,
    );

    for (const row of rows) {
      const trackId = Number(row.trackId);

      const list = tags.get(trackId) ?? [];

      list.push(String(row.tagId));

      tags.set(trackId, list);
    }
  } catch {
    tags.clear();
  }

  const signals = new Map<
    number,
    { colorText: string; letters: string }
  >();

  try {
    const rows = await sql.all<{
      trackId: number;
      colorText: string;
      letters: string;
    }>(
      `
      select
        track_id as trackId,
        color_text as colorText,
        letters
      from icon_signals
      where track_id in (${marks})
      `,
      ids,
    );

    for (const row of rows) {
      signals.set(Number(row.trackId), {
        colorText: String(row.colorText ?? ""),
        letters: String(row.letters ?? ""),
      });
    }
  } catch {
    signals.clear();
  }

  return ids.flatMap((trackId) => {
    const app = byId.get(trackId);

    if (!app) {
      return [];
    }

    const signal = signals.get(trackId);

    return [
      {
        trackId,
        name: String(app.name ?? ""),
        description: String(app.description ?? ""),
        iconUrl: String(app.iconUrl ?? ""),
        tags: tags.get(trackId) ?? [],
        colorText: signal?.colorText,
        letters: signal?.letters,
      },
    ];
  });
}
