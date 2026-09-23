-- phase two

create table apps (
  track_id bigint primary key,
  bundle_id text not null,
  name text not null,
  description text not null,
  seller_name text not null,
  icon_url text not null,
  screenshot_urls text[] not null,
  primary_genre_id integer not null,
  primary_genre text not null,
  genre_ids integer[] not null,
  genres text[] not null,
  price numeric not null,
  currency text not null,
  formatted_price text not null,
  store_url text not null,
  version text not null,
  release_date timestamptz not null,
  current_version_release_date timestamptz not null,
  content_advisory_rating text not null,
  metadata_fetched_at timestamptz not null,
  delisted boolean not null default false
);

create table rating_snapshots (
  id bigserial primary key,
  track_id bigint not null references apps (track_id),
  captured_at timestamptz not null,
  rating_average numeric not null,
  rating_count integer not null,
  unique (track_id, captured_at)
);

create index rating_snapshots_track
  on rating_snapshots (track_id, captured_at desc);

create table chart_snapshots (
  id bigserial primary key,
  track_id bigint not null references apps (track_id),
  captured_at timestamptz not null,
  country text not null,
  chart text not null check (
    chart in ('top-free', 'top-paid', 'top-grossing')
  ),
  genre_id integer,
  rank integer not null check (rank > 0)
);

create unique index chart_snapshots_slot
  on chart_snapshots (
    track_id,
    captured_at,
    country,
    chart,
    coalesce(genre_id, 0)
  );

create table version_releases (
  track_id bigint not null references apps (track_id),
  version text not null,
  released_at timestamptz not null,
  notes text not null,
  primary key (track_id, version)
);

create table sourced_facts (
  id bigserial primary key,
  track_id bigint not null references apps (track_id),
  kind text not null check (
    kind in ('revenue', 'downloads', 'funding')
  ),
  value numeric not null,
  unit text not null,
  citation_title text not null,
  citation_url text not null,
  noted_at timestamptz not null
);

create table download_estimates (
  id bigserial primary key,
  track_id bigint not null references apps (track_id),
  label text not null,
  method text not null check (length(method) > 0),
  computed_at timestamptz not null
);

create table momentum_scores (
  id bigserial primary key,
  track_id bigint not null references apps (track_id),
  score numeric not null,
  method text not null check (length(method) > 0),
  kind text not null check (
    kind in ('ratings', 'charts')
  ),
  computed_at timestamptz not null
);

create table tags (
  id text primary key,
  label text not null
);

create table app_tags (
  track_id bigint not null references apps (track_id),
  tag_id text not null references tags (id),
  primary key (track_id, tag_id)
);

create table text_embeddings (
  track_id bigint primary key references apps (track_id),
  model text not null,
  source_hash text not null,
  vector real[] not null
);

create table image_embeddings (
  id bigserial primary key,
  track_id bigint not null references apps (track_id),
  model text not null,
  source_hash text not null,
  target text not null check (
    target in ('icon', 'screenshot')
  ),
  vector real[] not null
);

create table screenshot_ocr (
  track_id bigint not null references apps (track_id),
  screenshot_url text not null,
  text text not null,
  primary key (track_id, screenshot_url)
);
