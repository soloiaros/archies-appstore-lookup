import { readFileSync } from "node:fs";

import { join } from "node:path";

import type { DatabaseSync } from "node:sqlite";

import { cosine } from "@/lib/pipeline/embed";

import { embedAsking } from "@/lib/pipeline/embed";

import { embedIconQuery } from "@/lib/pipeline/embed";

import type { IndexedApp } from "@/lib/retrieve/memory";

import { warmIndex } from "@/lib/retrieve/memory";

import {
  LETTER_WORDS,
  queryMentionsColor,
  queryMentionsLetters,
} from "@/lib/retrieve/cues";

import type { Finalist } from "@/lib/types";

const BY_MEANING = 40;

const BY_LOOKS = 40;

const BY_TAGS = 16;

const BY_LEXICAL = 16;

const BY_NAME = 25;

const FINALIST_CAP = 120;

const DEEPEN_CAP = 60;

type TagDef = {
  id: string;

  label: string;
};

let tagDefs: TagDef[] | null = null;

export {
  queryMentionsColor,
  queryMentionsLetters,
} from "@/lib/retrieve/cues";

export async function retrieveFinalists(
  _db: DatabaseSync,
  query: string,
): Promise<Finalist[]> {
  const index = await warmIndex();

  return rankFinalists(index.apps, query);
}

export async function deepenFinalists(
  excluded: number[],
  tagIds: string[],
): Promise<Finalist[]> {
  if (tagIds.length === 0) {
    return [];
  }

  const index = await warmIndex();

  const skip = new Set(excluded);

  const wanted = new Set(tagIds);

  return index.apps
    .filter(
      (app) =>
        !skip.has(app.trackId)
        && app.tags.some((tag) => wanted.has(tag)),
    )
    .slice(0, DEEPEN_CAP)
    .map((app) => toFinalist(app));
}

export async function topMeaningHits(
  _db: DatabaseSync,
  queryVector: Float32Array,
  limit: number,
): Promise<
  Array<{
    trackId: number;

    score: number;

    name: string;
  }>
> {
  const index = await warmIndex();

  return index.apps
    .flatMap((app) => {
      if (!app.text) {
        return [];
      }

      return [
        {
          trackId: app.trackId,
          score: cosine(queryVector, app.text),
          name: app.name,
        },
      ];
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export async function topIconHits(
  _db: DatabaseSync,
  queryVector: Float32Array,
  limit: number,
): Promise<
  Array<{
    trackId: number;

    score: number;

    name: string;
  }>
> {
  const index = await warmIndex();

  return index.apps
    .flatMap((app) => {
      if (!app.icon) {
        return [];
      }

      return [
        {
          trackId: app.trackId,
          score: cosine(queryVector, app.icon),
          name: app.name,
        },
      ];
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function rankFinalists(
  apps: IndexedApp[],
  query: string,
): Promise<Finalist[]> {
  const nominated = new Map<number, number>();

  const bump = (
    trackId: number,
    score: number,
  ) => {
    nominated.set(
      trackId,
      Math.max(
        nominated.get(trackId) ?? 0,
        score,
      ),
    );
  };

  const asking = embedAsking(query);

  const looking = embedIconQuery(query);

  const [textVector, iconVector] = await Promise.all([
    asking,
    looking,
  ]);

  const meaning = apps
    .flatMap((app) => {
      if (!app.text) {
        return [];
      }

      return [
        {
          trackId: app.trackId,
          score: cosine(textVector, app.text),
        },
      ];
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, BY_MEANING);

  for (const hit of meaning) {
    bump(hit.trackId, hit.score);
  }

  const looks = apps
    .flatMap((app) => {
      if (!app.icon) {
        return [];
      }

      return [
        {
          trackId: app.trackId,
          score: cosine(iconVector, app.icon),
        },
      ];
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, BY_LOOKS);

  for (const hit of looks) {
    bump(hit.trackId, 0.5 + hit.score);
  }

  for (const hit of tagOverlap(query, apps).slice(0, BY_TAGS)) {
    bump(hit.trackId, 0.4 + hit.score);
  }

  for (const hit of lexicalHits(query, apps).slice(0, BY_LEXICAL)) {
    bump(hit.trackId, 0.3 + hit.score);
  }

  for (const hit of nameHits(query, apps).slice(0, BY_NAME)) {
    bump(hit.trackId, 0.95);
  }

  if (queryMentionsLetters(query)) {
    for (const hit of letterHits(query, apps)) {
      bump(hit.trackId, 0.9);
    }
  }

  const byId = new Map(
    apps.map((app) => [app.trackId, app]),
  );

  return [...nominated.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, FINALIST_CAP)
    .flatMap(([trackId]) => {
      const app = byId.get(trackId);

      if (!app) {
        return [];
      }

      return [toFinalist(app)];
    });
}

function toFinalist(
  app: IndexedApp,
): Finalist {
  return {
    trackId: app.trackId,
    name: app.name,
    description: app.description,
    iconUrl: app.iconUrl,
    tags: app.tags,
    colorText: app.colorText,
    letters: app.letters,
  };
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
  apps: IndexedApp[],
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

function lexicalHits(
  query: string,
  apps: IndexedApp[],
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

function nameHits(
  query: string,
  apps: IndexedApp[],
): Array<{
  trackId: number;

  score: number;
}> {
  const words = tokenize(query).filter(
    (word) => word.length >= 4,
  );

  if (words.length === 0) {
    return [];
  }

  return apps
    .filter((app) => {
      const name = app.name.toLowerCase();

      return words.some((word) => name.includes(word));
    })
    .map((app) => ({
      trackId: app.trackId,
      score: 1,
    }));
}

function letterHits(
  query: string,
  apps: IndexedApp[],
): Array<{
  trackId: number;

  score: number;
}> {
  const words = tokenize(query).filter(
    (word) =>
      word.length >= 3
      && !LETTER_WORDS.has(word),
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
    .map((app) => ({
      trackId: app.trackId,
      score: 1,
    }));
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
