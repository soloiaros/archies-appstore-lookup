type Table = "apps" | "rating_snapshots" | "chart_snapshots" | "text_embeddings";

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
};

const keys: Record<Table, string[]> = {
  apps: ["track_id"],
  rating_snapshots: ["track_id", "captured_on"],
  chart_snapshots: ["track_id", "captured_on", "country", "chart", "genre_id"],
  text_embeddings: ["track_id"],
};

const changeFields: Record<Table, string[]> = {
  apps: columns.apps.filter((column) =>
    !["track_id", "tier", "metadata_fetched_at"].includes(column)),
  rating_snapshots: ["rating_average", "rating_count"],
  chart_snapshots: ["rank"],
  text_embeddings: ["model", "vector"],
};

export function insertJsonSql(table: Table): string {
  const all = columns[table];
  const update = all.filter((column) => !keys[table].includes(column));
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
];
