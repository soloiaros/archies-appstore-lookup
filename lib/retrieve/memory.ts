import { BGE_MODEL } from "@/lib/pipeline/embed";

import { SIGLIP_MODEL } from "@/lib/pipeline/embed";

import { decodeVector } from "@/lib/pipeline/embed";

import { embedAsking } from "@/lib/pipeline/embed";

import { embedIconQuery } from "@/lib/pipeline/embed";

import { openCatalog } from "@/lib/scrape/store";

export type IndexedApp = {
  trackId: number;

  name: string;

  description: string;

  iconUrl: string;

  text: Float32Array | null;

  icon: Float32Array | null;

  colorText: string;

  colors: string[];

  letters: string;

  tags: string[];
};

export type SearchIndex = {
  apps: IndexedApp[];
};

let pending: Promise<SearchIndex> | null = null;

export function warmIndex(): Promise<SearchIndex> {
  pending ??= loadIndex();

  return pending;
}

export async function warmTowers(): Promise<void> {
  await warmIndex();

  await embedAsking("warmup");

  await embedIconQuery("warmup");
}

async function loadIndex(): Promise<SearchIndex> {
  const db = openCatalog();

  try {
    const apps = db.prepare(`
      select
        track_id as trackId,
        name,
        description,
        icon_url as iconUrl
      from apps
      where delisted = 0
    `).all() as Array<{
      trackId: number;

      name: string;

      description: string;

      iconUrl: string;
    }>;

    const texts = new Map<number, Float32Array>();

    for (const row of db.prepare(`
      select track_id as trackId, vector
      from text_embeddings
      where model = ?
    `).all(BGE_MODEL) as Array<{
      trackId: number;

      vector: Buffer | Uint8Array;
    }>) {
      texts.set(
        Number(row.trackId),
        decodeVector(row.vector),
      );
    }

    const icons = new Map<number, Float32Array>();

    for (const row of db.prepare(`
      select track_id as trackId, vector
      from icon_embeddings
      where model = ?
    `).all(SIGLIP_MODEL) as Array<{
      trackId: number;

      vector: Buffer | Uint8Array;
    }>) {
      icons.set(
        Number(row.trackId),
        decodeVector(row.vector),
      );
    }

    const signals = new Map<
      number,
      {
        colorText: string;

        colors: string[];

        letters: string;
      }
    >();

    for (const row of db.prepare(`
      select
        track_id as trackId,
        color_text as colorText,
        colors,
        letters
      from icon_signals
    `).all() as Array<{
      trackId: number;

      colorText: string;

      colors: string;

      letters: string;
    }>) {
      signals.set(Number(row.trackId), {
        colorText: String(row.colorText),
        colors: parseColors(row.colors),
        letters: String(row.letters ?? ""),
      });
    }

    const tags = new Map<number, string[]>();

    for (const row of db.prepare(`
      select track_id as trackId, tag_id as tagId
      from app_tags
    `).all() as Array<{
      trackId: number;

      tagId: string;
    }>) {
      const list = tags.get(Number(row.trackId)) ?? [];

      list.push(String(row.tagId));

      tags.set(Number(row.trackId), list);
    }

    return {
      apps: apps.map((app) => {
        const trackId = Number(app.trackId);

        const signal = signals.get(trackId);

        return {
          trackId,
          name: String(app.name),
          description: String(app.description),
          iconUrl: String(app.iconUrl),
          text: texts.get(trackId) ?? null,
          icon: icons.get(trackId) ?? null,
          colorText: signal?.colorText ?? "",
          colors: signal?.colors ?? [],
          letters: signal?.letters ?? "",
          tags: tags.get(trackId) ?? [],
        };
      }),
    };
  } finally {
    db.close();
  }
}

function parseColors(
  value: string,
): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is string =>
        typeof item === "string",
    );
  } catch {
    return [];
  }
}
