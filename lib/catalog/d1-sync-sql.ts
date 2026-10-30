type Table = "apps" | "rating_snapshots" | "chart_snapshots"
  | "text_embeddings" | "market_apps" | "market_metadata";

const columns: Record<Table, string[]> = {
  apps: [
    "track_id", "tier", "bundle_id", "name", "description", "seller_name",
    "icon_url", "screenshot_urls", "primary_genre_id", "primary_genre",
    "genre_ids", "genres", "price", "currency", "formatted_price",
    "store_url", "version", "release_date", "current_version_release_date",
    "content_advisory_rating", "metadata_fetched_at", "delisted",
  ],
  rating_snapshots: [
    "track_id", "tier", "captured_on", "captured_at",
    "rating_average", "rating_count",
  ],
  chart_snapshots: [
    "track_id", "tier", "captured_on", "captured_at",
    "country", "chart", "genre_id", "rank",
  ],
  text_embeddings: ["track_id", "tier", "method", "model", "vector"],
  market_apps: ["country", "track_id", "first_seen_on", "last_seen_on"],
  market_metadata: [
    "country", "track_id", "name", "description", "icon_url",
    "store_url", "formatted_price", "currency", "rating_average",
    "rating_count", "metadata_fetched_at",
  ],
};

const keys: Record<Table, string[]> = {
  apps: ["track_id"],
  rating_snapshots: ["track_id", "captured_on"],
  chart_snapshots: ["track_id", "captured_on", "country", "chart", "genre_id"],
  text_embeddings: ["track_id"],
  market_apps: ["country", "track_id"],
  market_metadata: ["country", "track_id"],
};

const changeFields: Record<Table, string[]> = {
  apps: columns.apps.filter((column) =>
    !["track_id", "tier", "metadata_fetched_at"].includes(column)),
  rating_snapshots: ["rating_average", "rating_count"],
  chart_snapshots: ["rank"],
  text_embeddings: ["model", "vector"],
  market_apps: ["last_seen_on"],
  market_metadata: columns.market_metadata.filter((column) =>
    !["country", "track_id", "metadata_fetched_at"].includes(column)),
};

export function insertJsonSql(table: Table): string {
  const all = columns[table];
  const update = all.filter((column) => !keys[table].includes(column)
    && !(table === "market_apps" && column === "first_seen_on"));
  const changed = changeFields[table]
    .map((column) => `${table}.${column} is not excluded.${column}`)
    .join(" or ");

  return `
    insert into ${table} (${all.join(", ")})
    select ${all.map((column) => `json_extract(value, '$.${column}')`).join(", ")}
    from json_each(?) where 1
    on conflict (${keys[table].join(", ")}) do update set
      ${update.map((column) => `${column} = excluded.${column}`).join(", ")}
    where ${changed}
  `;
}

export const CATALOG_INDEXES = [
  "create unique index if not exists chart_snapshots_sync on chart_snapshots (track_id, captured_on, country, chart, genre_id)",
  "create unique index if not exists rating_snapshots_sync on rating_snapshots (track_id, captured_on)",
  "create index if not exists chart_snapshots_date on chart_snapshots (captured_on)",
  "create table if not exists catalog_meta (key text primary key, value text not null)",
  "create table if not exists market_apps (country text not null, track_id integer not null, first_seen_on text not null, last_seen_on text not null, primary key (country, track_id))",
  "create index if not exists market_apps_track on market_apps (track_id)",
  "create table if not exists market_metadata (country text not null, track_id integer not null, name text not null, description text not null, icon_url text not null, store_url text not null, formatted_price text not null, currency text not null, rating_average real, rating_count integer, metadata_fetched_at text not null, primary key (country, track_id))",
];
