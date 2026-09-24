import { readFileSync } from "node:fs";

import { join } from "node:path";

import { DatabaseSync } from "node:sqlite";

import type { AppMetadata } from "@/models/app";

import type {
  ChartSnapshot,
  RatingSnapshot,
  VersionRelease,
} from "@/models/series";

export type CatalogCounts = {
  apps: number;

  ratings: number;

  charts: number;

  versions: number;
};

const CATALOG_PATH = join(
  process.cwd(),
  "data",
  "catalog.sqlite",
);

export function openCatalog(): DatabaseSync {
  const db = new DatabaseSync(
    CATALOG_PATH,
  );

  db.exec(
    "pragma foreign_keys = on",
  );

  db.exec(
    "pragma journal_mode = WAL",
  );

  db.exec(
    readFileSync(
      join(
        process.cwd(),
        "models",
        "schema.sql",
      ),
      "utf8",
    ),
  );

  return db;
}

export function listTrackIds(
  db: DatabaseSync,
): number[] {
  const rows = db.prepare(
    "select track_id as trackId from apps order by track_id",
  ).all() as Array<{ trackId: number }>;

  return rows.map(
    (row) => row.trackId,
  );
}

export function catalogCounts(
  db: DatabaseSync,
): CatalogCounts {
  return {
    apps: count(db, "apps"),
    ratings: count(db, "rating_snapshots"),
    charts: count(db, "chart_snapshots"),
    versions: count(db, "version_releases"),
  };
}

export function upsertObserved(
  db: DatabaseSync,
  input: {
    apps: AppMetadata[];

    ratings: RatingSnapshot[];

    charts: ChartSnapshot[];

    versions: VersionRelease[];
  },
): void {
  const writeApp = db.prepare(`
    insert into apps (
      track_id,
      tier,
      bundle_id,
      name,
      description,
      seller_name,
      icon_url,
      screenshot_urls,
      primary_genre_id,
      primary_genre,
      genre_ids,
      genres,
      price,
      currency,
      formatted_price,
      store_url,
      version,
      release_date,
      current_version_release_date,
      content_advisory_rating,
      metadata_fetched_at,
      delisted
    ) values (
      ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    on conflict (track_id) do update set
      bundle_id = excluded.bundle_id,
      name = excluded.name,
      description = excluded.description,
      seller_name = excluded.seller_name,
      icon_url = excluded.icon_url,
      screenshot_urls = excluded.screenshot_urls,
      primary_genre_id = excluded.primary_genre_id,
      primary_genre = excluded.primary_genre,
      genre_ids = excluded.genre_ids,
      genres = excluded.genres,
      price = excluded.price,
      currency = excluded.currency,
      formatted_price = excluded.formatted_price,
      store_url = excluded.store_url,
      version = excluded.version,
      release_date = excluded.release_date,
      current_version_release_date = excluded.current_version_release_date,
      content_advisory_rating = excluded.content_advisory_rating,
      metadata_fetched_at = excluded.metadata_fetched_at,
      delisted = excluded.delisted
    where
      apps.bundle_id is not excluded.bundle_id
      or apps.name is not excluded.name
      or apps.description is not excluded.description
      or apps.seller_name is not excluded.seller_name
      or apps.icon_url is not excluded.icon_url
      or apps.screenshot_urls is not excluded.screenshot_urls
      or apps.primary_genre_id is not excluded.primary_genre_id
      or apps.primary_genre is not excluded.primary_genre
      or apps.genre_ids is not excluded.genre_ids
      or apps.genres is not excluded.genres
      or apps.price is not excluded.price
      or apps.currency is not excluded.currency
      or apps.formatted_price is not excluded.formatted_price
      or apps.store_url is not excluded.store_url
      or apps.version is not excluded.version
      or apps.release_date is not excluded.release_date
      or apps.current_version_release_date is not excluded.current_version_release_date
      or apps.content_advisory_rating is not excluded.content_advisory_rating
      or apps.delisted is not excluded.delisted
  `);

  const writeRating = db.prepare(`
    insert into rating_snapshots (
      track_id,
      tier,
      captured_on,
      captured_at,
      rating_average,
      rating_count
    ) values (
      ?, 'verified', ?, ?, ?, ?
    )
    on conflict (track_id, captured_on) do update set
      captured_at = excluded.captured_at,
      rating_average = excluded.rating_average,
      rating_count = excluded.rating_count
    where
      rating_snapshots.rating_average is not excluded.rating_average
      or rating_snapshots.rating_count is not excluded.rating_count
  `);

  const writeChart = db.prepare(`
    insert into chart_snapshots (
      track_id,
      tier,
      captured_on,
      captured_at,
      country,
      chart,
      genre_id,
      rank
    ) values (
      ?, 'verified', ?, ?, ?, ?, ?, ?
    )
    on conflict (
      track_id,
      captured_on,
      country,
      chart,
      genre_id
    ) do update set
      captured_at = excluded.captured_at,
      rank = excluded.rank
    where
      chart_snapshots.rank is not excluded.rank
  `);

  const writeVersion = db.prepare(`
    insert into version_releases (
      track_id,
      tier,
      version,
      released_at,
      notes
    ) values (
      ?, 'verified', ?, ?, ?
    )
    on conflict (track_id, version) do update set
      released_at = excluded.released_at,
      notes = excluded.notes
    where
      version_releases.released_at is not excluded.released_at
      or version_releases.notes is not excluded.notes
  `);

  const known = new Set(
    listTrackIds(db),
  );

  db.exec("begin");

  try {
    for (const app of input.apps) {
      writeApp.run(
        app.trackId,
        app.bundleId,
        app.name,
        app.description,
        app.sellerName,
        app.iconUrl,
        JSON.stringify(app.screenshotUrls),
        app.primaryGenreId,
        app.primaryGenre,
        JSON.stringify(app.genreIds),
        JSON.stringify(app.genres),
        app.price,
        app.currency,
        app.formattedPrice,
        app.storeUrl,
        app.version,
        app.releaseDate,
        app.currentVersionReleaseDate,
        app.contentAdvisoryRating,
        app.metadataFetchedAt,
        app.delisted ? 1 : 0,
      );

      known.add(app.trackId);
    }

    for (const rating of input.ratings) {
      if (!known.has(rating.trackId)) {
        continue;
      }

      writeRating.run(
        rating.trackId,
        capturedOn(rating.capturedAt),
        rating.capturedAt,
        rating.ratingAverage,
        rating.ratingCount,
      );
    }

    for (const chart of input.charts) {
      if (!known.has(chart.trackId)) {
        continue;
      }

      writeChart.run(
        chart.trackId,
        capturedOn(chart.capturedAt),
        chart.capturedAt,
        chart.country,
        chart.chart,
        chart.genreId ?? 0,
        chart.rank,
      );
    }

    for (const release of input.versions) {
      if (!known.has(release.trackId)) {
        continue;
      }

      writeVersion.run(
        release.trackId,
        release.version,
        release.releasedAt,
        release.notes,
      );
    }

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");

    throw error;
  }
}

export function replaceAppTags(
  db: DatabaseSync,
  rows: Array<{
    trackId: number;

    tagId: string;

    method: string;
  }>,
): void {
  const remove = db.prepare(
    "delete from app_tags where track_id = ?",
  );

  const insert = db.prepare(`
    insert into app_tags (
      track_id,
      tag_id,
      tier,
      method
    ) values (
      ?, ?, 'estimated', ?
    )
  `);

  const trackIds = [
    ...new Set(
      rows.map((row) => row.trackId),
    ),
  ];

  db.exec("begin");

  try {
    for (const trackId of trackIds) {
      remove.run(trackId);
    }

    for (const row of rows) {
      insert.run(
        row.trackId,
        row.tagId,
        row.method,
      );
    }

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");

    throw error;
  }
}

export type EmbeddingRow = {
  trackId: number;

  method: string;

  model: string;

  sourceHash: string;

  dims: number;

  vector: Uint8Array;

  embeddedAt: string;
};

export type StoredHash = {
  trackId: number;

  sourceHash: string;
};

export function listTextHashes(
  db: DatabaseSync,
): Map<number, string> {
  const rows = db.prepare(`
    select
      track_id as trackId,
      source_hash as sourceHash
    from text_embeddings
  `).all() as StoredHash[];

  return new Map(
    rows.map((row) => [
      row.trackId,
      row.sourceHash,
    ]),
  );
}

export type StoredIcon = {
  trackId: number;

  sourceHash: string;

  model: string;
};

export function listIconHashes(
  db: DatabaseSync,
): Map<number, StoredIcon> {
  const rows = db.prepare(`
    select
      track_id as trackId,
      source_hash as sourceHash,
      model
    from icon_embeddings
  `).all() as StoredIcon[];

  return new Map(
    rows.map((row) => [
      Number(row.trackId),
      {
        trackId: Number(row.trackId),
        sourceHash: String(row.sourceHash),
        model: String(row.model),
      },
    ]),
  );
}

export function upsertTextEmbeddings(
  db: DatabaseSync,
  rows: EmbeddingRow[],
): void {
  const write = db.prepare(`
    insert into text_embeddings (
      track_id,
      tier,
      method,
      model,
      source_hash,
      dims,
      vector,
      embedded_at
    ) values (
      ?, 'estimated', ?, ?, ?, ?, ?, ?
    )
    on conflict (track_id) do update set
      method = excluded.method,
      model = excluded.model,
      source_hash = excluded.source_hash,
      dims = excluded.dims,
      vector = excluded.vector,
      embedded_at = excluded.embedded_at
    where
      text_embeddings.source_hash is not excluded.source_hash
  `);

  db.exec("begin");

  try {
    for (const row of rows) {
      write.run(
        row.trackId,
        row.method,
        row.model,
        row.sourceHash,
        row.dims,
        row.vector as unknown as string,
        row.embeddedAt,
      );
    }

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");

    throw error;
  }
}

export function upsertIconEmbeddings(
  db: DatabaseSync,
  rows: EmbeddingRow[],
): void {
  const write = db.prepare(`
    insert into icon_embeddings (
      track_id,
      tier,
      method,
      model,
      source_hash,
      dims,
      vector,
      embedded_at
    ) values (
      ?, 'estimated', ?, ?, ?, ?, ?, ?
    )
    on conflict (track_id) do update set
      method = excluded.method,
      model = excluded.model,
      source_hash = excluded.source_hash,
      dims = excluded.dims,
      vector = excluded.vector,
      embedded_at = excluded.embedded_at
    where
      icon_embeddings.source_hash is not excluded.source_hash
      or icon_embeddings.model is not excluded.model
  `);

  db.exec("begin");

  try {
    for (const row of rows) {
      write.run(
        row.trackId,
        row.method,
        row.model,
        row.sourceHash,
        row.dims,
        row.vector as unknown as string,
        row.embeddedAt,
      );
    }

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");

    throw error;
  }
}

export function dropAppTag(
  db: DatabaseSync,
  trackId: number,
  tagId: string,
): void {
  db.prepare(`
    delete from app_tags
    where track_id = ?
      and tag_id = ?
  `).run(
    trackId,
    tagId,
  );
}

export function replaceScreenshotOcr(
  db: DatabaseSync,
  rows: Array<{
    trackId: number;

    screenshotUrl: string;

    method: string;

    text: string;
  }>,
): void {
  const write = db.prepare(`
    insert into screenshot_ocr (
      track_id,
      screenshot_url,
      tier,
      method,
      text
    ) values (
      ?, ?, 'estimated', ?, ?
    )
    on conflict (track_id, screenshot_url) do update set
      method = excluded.method,
      text = excluded.text
    where
      screenshot_ocr.text is not excluded.text
      or screenshot_ocr.method is not excluded.method
  `);

  db.exec("begin");

  try {
    for (const row of rows) {
      write.run(
        row.trackId,
        row.screenshotUrl,
        row.method,
        row.text,
      );
    }

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");

    throw error;
  }
}

export type IconSignalRow = {
  trackId: number;

  method: string;

  colorText: string;

  colors: string[];

  letters: string;
};

export function upsertIconSignals(
  db: DatabaseSync,
  rows: IconSignalRow[],
): void {
  const write = db.prepare(`
    insert into icon_signals (
      track_id,
      tier,
      method,
      color_text,
      colors,
      letters
    ) values (
      ?, 'estimated', ?, ?, ?, ?
    )
    on conflict (track_id) do update set
      method = excluded.method,
      color_text = excluded.color_text,
      colors = excluded.colors,
      letters = excluded.letters
    where
      icon_signals.color_text is not excluded.color_text
      or icon_signals.letters is not excluded.letters
      or icon_signals.method is not excluded.method
  `);

  db.exec("begin");

  try {
    for (const row of rows) {
      write.run(
        row.trackId,
        row.method,
        row.colorText,
        JSON.stringify(row.colors),
        row.letters,
      );
    }

    db.exec("commit");
  } catch (error) {
    db.exec("rollback");

    throw error;
  }
}

function capturedOn(
  iso: string,
): string {
  return iso.slice(0, 10);
}

function count(
  db: DatabaseSync,
  table: string,
): number {
  const row = db.prepare(
    `select count(*) as n from ${table}`,
  ).get() as { n: number };

  return row.n;
}
