import { readFileSync } from "node:fs";

import { join } from "node:path";

import {
  BGE_DIMS,
  BGE_METHOD,
  BGE_MODEL,
  SIGLIP_DIMS,
  SIGLIP_METHOD,
  SIGLIP_MODEL,
  embedDescriptions,
  embedIconImage,
  encodeVector,
  hashSource,
} from "../lib/pipeline/embed";

import { colorWords } from "../lib/pipeline/colors";

import { COLOR_METHOD } from "../lib/pipeline/colors";

import {
  LETTER_METHOD,
  openLetterReader,
  readIconLetters,
} from "../lib/pipeline/letters";

import { load_image } from "@huggingface/transformers";

import {
  dropAppTag,
  listIconHashes,
  listTextHashes,
  openCatalog,
  upsertIconEmbeddings,
  upsertIconSignals,
  upsertTextEmbeddings,
} from "../lib/scrape/store";

type AppRow = {
  trackId: number;

  description: string;

  iconUrl: string;
};

const TEXT_BATCH = 8;

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

    const stored = iconHashes.get(app.trackId);

    return (
      !stored
      || stored.sourceHash !== hash
      || stored.model !== SIGLIP_MODEL
    );
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

  const readers = await Promise.all(
    [0, 1, 2].map(() => openLetterReader()),
  );

  const signalMethod = `${COLOR_METHOD}+${LETTER_METHOD}`;

  try {
    for (
      let index = 0;
      index < iconWork.length;
      index += readers.length
    ) {
      const batch = iconWork.slice(
        index,
        index + readers.length,
      );

      const prepared = await Promise.all(
        batch.map(async (app, offset) => {
          const image = await load_image(app.iconUrl);

          const vector = await embedIconImage(image);

          if (vector.length !== SIGLIP_DIMS) {
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

          const colors = colorWords(image);

          const letters = await readIconLetters(
            readers[offset]!,
            image,
          );

          return {
            app,
            vector,
            colors,
            letters,
          };
        }),
      );

      const now = new Date().toISOString();

      upsertIconEmbeddings(
        db,
        prepared.map((row) => ({
          trackId: row.app.trackId,
          method: SIGLIP_METHOD,
          model: SIGLIP_MODEL,
          sourceHash: hashSource(row.app.iconUrl),
          dims: SIGLIP_DIMS,
          vector: encodeVector(row.vector),
          embeddedAt: now,
        })),
      );

      upsertIconSignals(
        db,
        prepared.map((row) => ({
          trackId: row.app.trackId,
          method: signalMethod,
          colorText: row.colors.colorText,
          colors: row.colors.colors,
          letters: row.letters,
        })),
      );

      const done = Math.min(
        index + readers.length,
        iconWork.length,
      );

      if (
        done === iconWork.length
        || done % 24 === 0
        || done <= readers.length
      ) {
        console.log(
          `icon ${done}/${iconWork.length}`,
        );
      }
    }
  } finally {
    await Promise.all(
      readers.map((reader) => reader.terminate()),
    );
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
