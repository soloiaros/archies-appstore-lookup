import { writeFileSync } from "node:fs";

import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/catalog.sqlite", {
  readOnly: true,
});

function sqlValue(value) {
  if (value == null) {
    return "null";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table, columns, rows) {
  const lines = [
    `create table if not exists ${table} (${columns.map((column) => `${column.name} ${column.type}`).join(", ")});`,
  ];

  const names = columns.map((column) => column.name);

  for (let index = 0; index < rows.length; index += 20) {
    const batch = rows.slice(index, index + 20);

    const values = batch.map((row) => (
      `(${names.map((name) => sqlValue(row[name])).join(", ")})`
    ));

    lines.push(
      `insert or replace into ${table} (${names.join(", ")}) values ${values.join(", ")};`,
    );
  }

  return lines;
}

const apps = db.prepare("select * from apps").all();

const ratings = db.prepare("select * from rating_snapshots").all();

const charts = db.prepare("select * from chart_snapshots").all();

const sql = [
  ...insert("apps", [
    { name: "track_id", type: "integer primary key" },
    { name: "tier", type: "text" },
    { name: "bundle_id", type: "text" },
    { name: "name", type: "text" },
    { name: "description", type: "text" },
    { name: "seller_name", type: "text" },
    { name: "icon_url", type: "text" },
    { name: "screenshot_urls", type: "text" },
    { name: "primary_genre_id", type: "integer" },
    { name: "primary_genre", type: "text" },
    { name: "genre_ids", type: "text" },
    { name: "genres", type: "text" },
    { name: "price", type: "real" },
    { name: "currency", type: "text" },
    { name: "formatted_price", type: "text" },
    { name: "store_url", type: "text" },
    { name: "version", type: "text" },
    { name: "release_date", type: "text" },
    { name: "current_version_release_date", type: "text" },
    { name: "content_advisory_rating", type: "text" },
    { name: "metadata_fetched_at", type: "text" },
    { name: "delisted", type: "integer" },
  ], apps),
  ...insert("rating_snapshots", [
    { name: "track_id", type: "integer" },
    { name: "tier", type: "text" },
    { name: "captured_on", type: "text" },
    { name: "captured_at", type: "text" },
    { name: "rating_average", type: "real" },
    { name: "rating_count", type: "integer" },
  ], ratings),
  "create index if not exists rating_snapshots_track on rating_snapshots (track_id, captured_at);",
  ...insert("chart_snapshots", [
    { name: "track_id", type: "integer" },
    { name: "tier", type: "text" },
    { name: "captured_on", type: "text" },
    { name: "captured_at", type: "text" },
    { name: "country", type: "text" },
    { name: "chart", type: "text" },
    { name: "genre_id", type: "integer" },
    { name: "rank", type: "integer" },
  ], charts),
  "create index if not exists chart_snapshots_track on chart_snapshots (track_id, captured_at);",
].join("\n");

writeFileSync("/tmp/catalog-d1.sql", sql);

console.log("apps", apps.length, "ratings", ratings.length, "charts", charts.length, "bytes", sql.length);
