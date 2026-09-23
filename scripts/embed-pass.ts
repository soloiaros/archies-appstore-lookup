import { readFileSync } from "node:fs";

import { join } from "node:path";

import {
  BGE_DIMS,
  BGE_METHOD,
  BGE_MODEL,
  CLIP_DIMS,
  CLIP_METHOD,
  CLIP_MODEL,
  embedDescriptions,
  embedIconUrl,
  encodeVector,
  hashSource,
} from "../lib/pipeline/embed";

import {
  dropAppTag,
  listIconHashes,
  listTextHashes,
  openCatalog,
  upsertIconEmbeddings,
  upsertTextEmbeddings,
} from "../lib/scrape/store";

type AppRow = {
  trackId: number;

  description: string;

  iconUrl: string;
};

const TEXT_BATCH = 8;

const ICON_CONCURRENCY = 8;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const subset = args.includes("--subset");

  const limitArg = args.find(
    (arg) => arg.startsWith("--limit="),
  );

  const limit = limitArg
    ? Number(limitArg.slice("--limit=".length))
    : null;

  const db = openCatalog();

  dropAppTag(
    db,
    570060128,
    "chess",
  );

  const subsetIds = subset
    ? readSubsetIds()
    : null;

  const apps = listApps(db).filter((app) => {
    if (
      subsetIds
      && !subsetIds.has(app.trackId)
    ) {
      return false;
    }

    return true;
  });

  const scoped =
    limit !== null
    && Number.isFinite(limit)
    && limit > 0
      ? apps.slice(0, limit)
      : apps;

  const textHashes = listTextHashes(db);

  const iconHashes = listIconHashes(db);

  const textWork = scoped.filter((app) => {
    const hash = hashSource(app.description);

    return textHashes.get(app.trackId) !== hash;
  });

  const iconWork = scoped.filter((app) => {
    if (!app.iconUrl) {
      return false;
    }

    const hash = hashSource(app.iconUrl);

    return iconHashes.get(app.trackId) !== hash;
  });

  console.log(
    JSON.stringify({
      scoped: scoped.length,
      textPending: textWork.length,
      iconPending: iconWork.length,
      textCached: scoped.length - textWork.length,
      iconCached:
        scoped.length
        - iconWork.length
        - scoped.filter((app) => !app.iconUrl).length,
    }),
  );

  const started = Date.now();

  for (
    let index = 0;
    index < textWork.length;
    index += TEXT_BATCH
  ) {
    const batch = textWork.slice(
      index,
      index + TEXT_BATCH,
    );

    const vectors = await embedDescriptions(
      batch.map((app) => app.description),
    );

    const now = new Date().toISOString();

    upsertTextEmbeddings(
      db,
      batch.map((app, offset) => {
        const vector = vectors[offset];

        if (
          !vector
          || vector.length !== BGE_DIMS
        ) {
          throw new Error(
            `text dims ${vector?.length ?? 0}`,
          );
        }

        return {
          trackId: app.trackId,
          method: BGE_METHOD,
          model: BGE_MODEL,
          sourceHash: hashSource(app.description),
          dims: BGE_DIMS,
          vector: encodeVector(vector),
          embeddedAt: now,
        };
      }),
    );

    const done = Math.min(
      index + TEXT_BATCH,
      textWork.length,
    );

    console.log(
      `text ${done}/${textWork.length}`,
    );
  }

  for (
    let index = 0;
    index < iconWork.length;
    index += ICON_CONCURRENCY
  ) {
    const batch = iconWork.slice(
      index,
      index + ICON_CONCURRENCY,
    );

    const now = new Date().toISOString();

    const rows = await Promise.all(
      batch.map(async (app) => {
        const vector = await embedIconUrl(
          app.iconUrl,
        );

        if (vector.length !== CLIP_DIMS) {
          throw new Error(
            `icon dims ${vector.length}`,
          );
        }

        if (
          !vector.every(Number.isFinite)
          || vector.every((value) => value === 0)
        ) {
          throw new Error(
            `icon vector bad ${app.trackId}`,
          );
        }

        return {
          trackId: app.trackId,
          method: CLIP_METHOD,
          model: CLIP_MODEL,
          sourceHash: hashSource(app.iconUrl),
          dims: CLIP_DIMS,
          vector: encodeVector(vector),
          embeddedAt: now,
        };
      }),
    );

    upsertIconEmbeddings(db, rows);

    const done = Math.min(
      index + ICON_CONCURRENCY,
      iconWork.length,
    );

    if (
      done === iconWork.length
      || done % 10 === 0
      || done <= ICON_CONCURRENCY
    ) {
      console.log(
        `icon ${done}/${iconWork.length}`,
      );
    }
  }

  const textCount = count(db, "text_embeddings");

  const iconCount = count(db, "icon_embeddings");

  console.log(
    JSON.stringify({
      textRows: textCount,
      iconRows: iconCount,
      ms: Date.now() - started,
    }),
  );

  db.close();
}

function listApps(
  db: ReturnType<typeof openCatalog>,
): AppRow[] {
  return db.prepare(`
    select
      track_id as trackId,
      description,
      icon_url as iconUrl
    from apps
    where delisted = 0
    order by track_id
  `).all() as AppRow[];
}

function readSubsetIds(): Set<number> {
  const path = join(
    process.cwd(),
    "data",
    "tags",
    "subset-50.json",
  );

  const raw = JSON.parse(
    readFileSync(path, "utf8"),
  ) as {
    trackIds: number[];
  };

  return new Set(raw.trackIds);
}

function count(
  db: ReturnType<typeof openCatalog>,
  table: string,
): number {
  const row = db.prepare(
    `select count(*) as n from ${table}`,
  ).get() as { n: number };

  return row.n;
}

void main();
