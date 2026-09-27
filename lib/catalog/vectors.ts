import tagFile from "@/data/tags/tags.json";

import { iconEmbed, workersAi } from "@/lib/site/db";

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

const SIGLIP_MODEL = "onnx-community/siglip2-base-patch16-224-ONNX";

const SIGLIP_DIMS = 768;

const BY_MEANING = 40;

const BY_LOOKS = 40;

const BY_TAGS = 16;

const BY_LEXICAL = 16;

const BY_NAME = 25;

const FINALIST_CAP = 120;

const DEEPEN_CAP = 60;

const TAGS = tagFile.tags;

const PAGE = 500;

type CatalogApp = {
  trackId: number;

  name: string;

  blurb: string;

  letters: string;

  tags: string[];
};

let textVectors: Map<number, Float32Array> | null = null;

let textLoad: Promise<Map<number, Float32Array>> | null = null;

let iconVectors: Map<number, Float32Array> | null = null;

let iconLoad: Promise<Map<number, Float32Array>> | null = null;

let catalogApps: CatalogApp[] | null = null;

let catalogLoad: Promise<CatalogApp[]> | null = null;

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

    const apps = await loadCatalog(sql);

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

    try {
      const looking = await embedIconQuery(query);

      const icons = await loadIconVectors(sql);

      if (looking && icons.size > 0) {
        const looks = [...icons.entries()]
          .map(([trackId, vector]) => ({
            trackId,
            score: cosine(looking, vector),
          }))
          .sort((left, right) => right.score - left.score)
          .slice(0, BY_LOOKS);

        for (const hit of looks) {
          bump(hit.trackId, 0.5 + hit.score);
        }
      }
    } catch {
      // icon channel skipped
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

      const vector = decodeVector(
        String(row.vector ?? ""),
        BGE_DIMS * 4,
      );

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

async function embedIconQuery(
  query: string,
): Promise<Float32Array | null> {
  const namespace = await iconEmbed();

  if (!namespace) {
    return null;
  }

  const response = await namespace
    .getByName("siglip")
    .fetch("http://icon-embed/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(45_000),
    });

  if (!response.ok) {
    return null;
  }

  const body = await response.json() as {
    vector?: number[];
  };

  if (!body.vector || body.vector.length !== SIGLIP_DIMS) {
    return null;
  }

  return l2Normalize(Float32Array.from(body.vector));
}

async function loadIconVectors(
  sql: SiteSql,
): Promise<Map<number, Float32Array>> {
  if (iconVectors && iconVectors.size > 0) {
    return iconVectors;
  }

  if (!iconLoad) {
    iconLoad = readIconVectors(sql)
      .then((map) => {
        if (map.size > 0) {
          iconVectors = map;
        }

        iconLoad = null;

        return map;
      })
      .catch((error) => {
        iconLoad = null;

        throw error;
      });
  }

  return iconLoad;
}

async function readIconVectors(
  sql: SiteSql,
): Promise<Map<number, Float32Array>> {
  const vectors = new Map<number, Float32Array>();

  let after = 0;

  const page = 200;

  for (;;) {
    const rows = await sql.all<{
      trackId: number;
      vector: string;
    }>(
      `
      select track_id as trackId, vector
      from icon_embeddings
      where model = ? and track_id > ?
      order by track_id
      limit ${page}
      `,
      [SIGLIP_MODEL, after],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const trackId = Number(row.trackId);

      const vector = decodeVector(
        String(row.vector ?? ""),
        SIGLIP_DIMS * 4,
      );

      if (vector) {
        vectors.set(trackId, vector);
      }

      after = trackId;
    }

    if (rows.length < page) {
      break;
    }
  }

  return vectors;
}

async function loadCatalog(
  sql: SiteSql,
): Promise<CatalogApp[]> {
  if (catalogApps && catalogApps.length > 0) {
    return catalogApps;
  }

  if (!catalogLoad) {
    catalogLoad = readCatalog(sql)
      .then((apps) => {
        if (apps.length > 0) {
          catalogApps = apps;
        }

        catalogLoad = null;

        return apps;
      })
      .catch((error) => {
        catalogLoad = null;

        throw error;
      });
  }

  return catalogLoad;
}

async function readCatalog(
  sql: SiteSql,
): Promise<CatalogApp[]> {
  const apps: CatalogApp[] = [];

  let after = 0;

  for (;;) {
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
      where delisted = 0 and track_id > ?
      order by track_id
      limit ${PAGE}
      `,
      [after],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const trackId = Number(row.trackId);

      apps.push({
        trackId,
        name: String(row.name ?? ""),
        blurb: String(row.blurb ?? ""),
        letters: "",
        tags: [],
      });

      after = trackId;
    }

    if (rows.length < PAGE) {
      break;
    }
  }

  const byId = new Map(apps.map((app) => [app.trackId, app]));

  try {
    let signalAfter = 0;

    for (;;) {
      const rows = await sql.all<{
        trackId: number;
        letters: string;
      }>(
        `
        select track_id as trackId, letters
        from icon_signals
        where track_id > ?
        order by track_id
        limit ${PAGE}
        `,
        [signalAfter],
      );

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const trackId = Number(row.trackId);

        const app = byId.get(trackId);

        if (app) {
          app.letters = String(row.letters ?? "");
        }

        signalAfter = trackId;
      }

      if (rows.length < PAGE) {
        break;
      }
    }
  } catch {
    // letters absent
  }

  try {
    const rows = await sql.all<{
      trackId: number;
      tagId: string;
    }>(
      `
      select track_id as trackId, tag_id as tagId
      from app_tags
      `,
    );

    for (const row of rows) {
      const app = byId.get(Number(row.trackId));

      if (app) {
        app.tags.push(String(row.tagId));
      }
    }
  } catch {
    // tags absent
  }

  return apps;
}

export async function deepenCandidates(
  sql: SiteSql,
  excluded: number[],
  tagIds: string[],
): Promise<Finalist[]> {
  if (tagIds.length === 0) {
    return [];
  }

  const skip = new Set(excluded);

  const marks = tagIds.map(() => "?").join(", ");

  const rows = await sql.all<{ trackId: number }>(
    `
    select distinct track_id as trackId
    from app_tags
    where tag_id in (${marks})
    order by track_id
    `,
    tagIds,
  );

  const ids = rows
    .map((row) => Number(row.trackId))
    .filter((trackId) => !skip.has(trackId))
    .slice(0, DEEPEN_CAP);

  if (ids.length === 0) {
    return [];
  }

  return hydrate(sql, ids);
}

function decodeVector(
  encoded: string,
  width: number,
): Float32Array | null {
  if (encoded.length === 0) {
    return null;
  }

  const bytes = Buffer.from(encoded, "base64");

  if (bytes.byteLength !== width) {
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
