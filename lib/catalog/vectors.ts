import {
  catalogRank,
  iconEmbed,
  workersAi,
  type EdgeStub,
  type IconEmbedNamespace,
} from "@/lib/site/db";

import type { SiteSql } from "@/lib/site/types";

import type { Finalist } from "@/lib/types";

import {
  ICON_DIMS,
  ICON_MODEL,
  TEXT_DIMS,
  TEXT_MODEL,
  decodeVector,
  emptyPacked,
  encodeVector,
  nominateIds,
  packVectors,
  type CatalogApp,
  type PackedVectors,
} from "@/lib/catalog/rank";

const QUERY_MODEL = "@cf/baai/bge-small-en-v1.5";

const ASKING =
  "Represent this sentence for searching relevant passages: ";

const DEEPEN_CAP = 60;

const PAGE = 500;

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
    const ranker = await catalogRank();

    const gate = { ranker: Boolean(ranker) };

    const [asking, looking] = await Promise.all([
      embedQuery(query),
      embedIconQuery(query).catch(() => null),
      (async () => {
        if (!ranker) {
          gate.ranker = false;

          await warmIsolate(sql);

          return;
        }

        try {
          const ready = await warmRanker(ranker);

          if (!ready) {
            gate.ranker = false;

            await warmIsolate(sql);
          }
        } catch (error) {
          console.error("catalog rank", error);

          gate.ranker = false;

          await warmIsolate(sql);
        }
      })(),
    ]);

    if (!asking) {
      return null;
    }

    if (ranker && gate.ranker) {
      try {
        const ids = await nominateRemote(
          ranker,
          query,
          asking,
          looking,
        );

        if (ids) {
          if (ids.length === 0) {
            return [];
          }

          return hydrate(sql, ids);
        }
      } catch (error) {
        console.error("catalog rank", error);
      }
    }

    return rankFromCaches(sql, query, asking, looking);
  } catch {
    return null;
  }
}

async function warmRanker(ranker: EdgeStub): Promise<boolean> {
  const response = await ranker.fetch("https://catalog/warm", {
    method: "POST",
  });

  if (!response.ok) {
    return false;
  }

  const body = await response.json() as { ok?: boolean };

  return body.ok === true;
}

async function nominateRemote(
  ranker: EdgeStub,
  query: string,
  asking: Float32Array,
  looking: Float32Array | null,
): Promise<number[] | null> {
  const response = await ranker.fetch("https://catalog/nominate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      text: encodeVector(asking),
      icon: looking ? encodeVector(looking) : null,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json() as {
    ok?: boolean;

    ids?: number[];
  };

  if (!body.ok || !Array.isArray(body.ids)) {
    return null;
  }

  return body.ids.map((id) => Number(id));
}

async function warmIsolate(sql: SiteSql): Promise<void> {
  await Promise.all([
    loadTextVectors(sql),
    loadIconVectors(sql).catch(() => new Map()),
    loadCatalog(sql),
  ]);
}

async function rankFromCaches(
  sql: SiteSql,
  query: string,
  asking: Float32Array,
  looking: Float32Array | null,
): Promise<Finalist[] | null> {
  const vectors = await loadTextVectors(sql);

  if (vectors.size === 0) {
    return null;
  }

  const [icons, apps] = await Promise.all([
    loadIconVectors(sql).catch(() => new Map<number, Float32Array>()),
    loadCatalog(sql),
  ]);

  const ids = nominateIds(
    query,
    apps,
    asking,
    packMap(vectors, TEXT_DIMS),
    looking,
    icons.size > 0
      ? packMap(icons, ICON_DIMS)
      : emptyPacked(ICON_DIMS),
  );

  if (ids.length === 0) {
    return [];
  }

  return hydrate(sql, ids);
}

function packMap(
  vectors: Map<number, Float32Array>,
  dims: number,
): PackedVectors {
  const rows: Array<{ trackId: number; vector: Float32Array }> = [];

  for (const [trackId, vector] of vectors) {
    rows.push({ trackId, vector });
  }

  return packVectors(rows, dims);
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

  if (!raw || raw.length !== TEXT_DIMS) {
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
      [TEXT_MODEL, after],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const trackId = Number(row.trackId);

      const vector = decodeVector(
        String(row.vector ?? ""),
        TEXT_DIMS * 4,
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

function siglipStub(namespace: IconEmbedNamespace): EdgeStub {
  return namespace.getByName("siglip");
}

async function embedIconQuery(
  query: string,
): Promise<Float32Array | null> {
  const namespace = await iconEmbed();

  if (!namespace) {
    return null;
  }

  const response = await siglipStub(namespace)
    .fetch("http://icon-embed/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(180_000),
    });

  if (!response.ok) {
    return null;
  }

  const body = await response.json() as {
    vector?: number[];
  };

  if (!body.vector || body.vector.length !== ICON_DIMS) {
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
      [ICON_MODEL, after],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const trackId = Number(row.trackId);

      const vector = decodeVector(
        String(row.vector ?? ""),
        ICON_DIMS * 4,
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

const BIND_CAP = 40;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];

  for (let index = 0; index < items.length; index += BIND_CAP) {
    out.push(items.slice(index, index + BIND_CAP));
  }

  return out;
}

async function hydrate(
  sql: SiteSql,
  ids: number[],
): Promise<Finalist[]> {
  const apps: Array<{
    trackId: number;
    name: string;
    description: string;
    iconUrl: string;
  }> = [];

  for (const slice of chunks(ids)) {
    const marks = slice.map(() => "?").join(", ");

    const rows = await sql.all<{
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
      slice,
    );

    apps.push(...rows);
  }

  const byId = new Map(
    apps.map((row) => [Number(row.trackId), row]),
  );

  const tags = new Map<number, string[]>();

  try {
    const rows: Array<{
      trackId: number;
      tagId: string;
    }> = [];

    for (const slice of chunks(ids)) {
      const marks = slice.map(() => "?").join(", ");

      const page = await sql.all<{
        trackId: number;
        tagId: string;
      }>(
        `
        select track_id as trackId, tag_id as tagId
        from app_tags
        where track_id in (${marks})
        `,
        slice,
      );

      rows.push(...page);
    }

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
    const rows: Array<{
      trackId: number;
      colorText: string;
      letters: string;
    }> = [];

    for (const slice of chunks(ids)) {
      const marks = slice.map(() => "?").join(", ");

      const page = await sql.all<{
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
        slice,
      );

      rows.push(...page);
    }

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
