import { readFileSync } from "node:fs";

import { join } from "node:path";

import type { DatabaseSync } from "node:sqlite";

import {
  cosine,
  decodeVector,
  embedAsking,
  embedIconQuery,
} from "@/lib/pipeline/embed";

import type { Finalist } from "@/lib/types";

const BY_MEANING = 24;

const BY_LOOKS = 12;

const BY_TAGS = 16;

const BY_LEXICAL = 12;

const FINALIST_CAP = 48;

type AppMeta = {
  trackId: number;

  name: string;

  description: string;

  iconUrl: string;
};

type TagRow = {
  trackId: number;

  tagId: string;
};

type TagDef = {
  id: string;

  label: string;
};

type VectorRow = {
  trackId: number;

  vector: Buffer | Uint8Array;
};

let tagDefs: TagDef[] | null = null;

export async function retrieveFinalists(
  db: DatabaseSync,
  query: string,
): Promise<Finalist[]> {
  const apps = loadApps(db);

  if (apps.length === 0) {
    return [];
  }

  const byId = new Map(
    apps.map((app) => [
      app.trackId,
      app,
    ]),
  );

  const tagsByApp = loadTags(db);

  const nominated = new Map<number, number>();

  const bump = (
    trackId: number,
    score: number,
  ) => {
    if (!byId.has(trackId)) {
      return;
    }

    nominated.set(
      trackId,
      Math.max(
        nominated.get(trackId) ?? 0,
        score,
      ),
    );
  };

  const textRows = loadTextVectors(db);

  if (textRows.length > 0) {
    const asking = await embedAsking(query);

    const ranked = textRows
      .map((row) => ({
        trackId: row.trackId,
        score: cosine(
          asking,
          decodeVector(row.vector),
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, BY_MEANING);

    for (const hit of ranked) {
      bump(hit.trackId, hit.score);
    }
  }

  const iconRows = loadIconVectors(db);

  if (iconRows.length > 0) {
    const looking = await embedIconQuery(query);

    const ranked = iconRows
      .map((row) => ({
        trackId: row.trackId,
        score: cosine(
          looking,
          decodeVector(row.vector),
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, BY_LOOKS);

    for (const hit of ranked) {
      bump(
        hit.trackId,
        0.5 + hit.score,
      );
    }
  }

  const tagHits = tagOverlap(
    query,
    tagsByApp,
  );

  for (const hit of tagHits.slice(0, BY_TAGS)) {
    bump(
      hit.trackId,
      0.4 + hit.score,
    );
  }

  const lexical = lexicalHits(
    query,
    apps,
  );

  for (const hit of lexical.slice(0, BY_LEXICAL)) {
    bump(
      hit.trackId,
      0.3 + hit.score,
    );
  }

  const ordered = [...nominated.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, FINALIST_CAP)
    .map(([trackId]) => trackId);

  return ordered.flatMap((trackId) => {
    const app = byId.get(trackId);

    if (!app) {
      return [];
    }

    return [
      {
        trackId: app.trackId,
        name: app.name,
        description: app.description,
        iconUrl: app.iconUrl,
        tags: tagsByApp.get(trackId) ?? [],
      },
    ];
  });
}

export function topMeaningHits(
  db: DatabaseSync,
  queryVector: Float32Array,
  limit: number,
): Array<{
  trackId: number;

  score: number;

  name: string;
}> {
  const apps = new Map(
    loadApps(db).map((app) => [
      app.trackId,
      app.name,
    ]),
  );

  return loadTextVectors(db)
    .map((row) => ({
      trackId: row.trackId,
      score: cosine(
        queryVector,
        decodeVector(row.vector),
      ),
      name: apps.get(row.trackId) ?? String(row.trackId),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function topIconHits(
  db: DatabaseSync,
  queryVector: Float32Array,
  limit: number,
): Array<{
  trackId: number;

  score: number;

  name: string;
}> {
  const apps = new Map(
    loadApps(db).map((app) => [
      app.trackId,
      app.name,
    ]),
  );

  return loadIconVectors(db)
    .map((row) => ({
      trackId: row.trackId,
      score: cosine(
        queryVector,
        decodeVector(row.vector),
      ),
      name: apps.get(row.trackId) ?? String(row.trackId),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function loadApps(
  db: DatabaseSync,
): AppMeta[] {
  return db.prepare(`
    select
      track_id as trackId,
      name,
      description,
      icon_url as iconUrl
    from apps
    where delisted = 0
  `).all() as AppMeta[];
}

function loadTags(
  db: DatabaseSync,
): Map<number, string[]> {
  const rows = db.prepare(`
    select
      track_id as trackId,
      tag_id as tagId
    from app_tags
  `).all() as TagRow[];

  const map = new Map<number, string[]>();

  for (const row of rows) {
    const list = map.get(row.trackId) ?? [];

    list.push(row.tagId);

    map.set(row.trackId, list);
  }

  return map;
}

function loadTextVectors(
  db: DatabaseSync,
): VectorRow[] {
  return db.prepare(`
    select
      track_id as trackId,
      vector
    from text_embeddings
  `).all() as VectorRow[];
}

function loadIconVectors(
  db: DatabaseSync,
): VectorRow[] {
  return db.prepare(`
    select
      track_id as trackId,
      vector
    from icon_embeddings
  `).all() as VectorRow[];
}

function loadTagDefs(): TagDef[] {
  if (tagDefs) {
    return tagDefs;
  }

  const raw = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "data",
        "tags",
        "tags.json",
      ),
      "utf8",
    ),
  ) as {
    tags: TagDef[];
  };

  tagDefs = raw.tags;

  return tagDefs;
}

function tagOverlap(
  query: string,
  tagsByApp: Map<number, string[]>,
): Array<{
  trackId: number;

  score: number;
}> {
  const words = tokenize(query);

  if (words.length === 0) {
    return [];
  }

  const matched = new Set<string>();

  for (const tag of loadTagDefs()) {
    const hay = tokenize(
      `${tag.id} ${tag.label}`,
    );

    if (
      hay.some((word) => words.includes(word))
    ) {
      matched.add(tag.id);
    }
  }

  if (matched.size === 0) {
    return [];
  }

  const scores: Array<{
    trackId: number;

    score: number;
  }> = [];

  for (const [trackId, tags] of tagsByApp) {
    let hits = 0;

    for (const tag of tags) {
      if (matched.has(tag)) {
        hits += 1;
      }
    }

    if (hits > 0) {
      scores.push({
        trackId,
        score: hits / matched.size,
      });
    }
  }

  return scores.sort(
    (left, right) => right.score - left.score,
  );
}

function lexicalHits(
  query: string,
  apps: AppMeta[],
): Array<{
  trackId: number;

  score: number;
}> {
  const words = tokenize(query).filter(
    (word) => word.length > 2,
  );

  if (words.length === 0) {
    return [];
  }

  return apps
    .map((app) => {
      const hay = tokenize(
        `${app.name} ${app.description.slice(0, 800)}`,
      );

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

function tokenize(
  text: string,
): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}
