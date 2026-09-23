create table if not exists apps (
  track_id integer primary key,
  tier text not null default 'verified' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  bundle_id text not null,
  name text not null,
  description text not null,
  seller_name text not null,
  icon_url text not null,
  screenshot_urls text not null,
  primary_genre_id integer not null,
  primary_genre text not null,
  genre_ids text not null,
  genres text not null,
  price real not null,
  currency text not null,
  formatted_price text not null,
  store_url text not null,
  version text not null,
  release_date text not null,
  current_version_release_date text not null,
  content_advisory_rating text not null,
  metadata_fetched_at text not null,
  delisted integer not null default 0 check (
    delisted in (0, 1)
  )
);

create table if not exists rating_snapshots (
  track_id integer not null references apps (track_id),
  tier text not null default 'verified' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  captured_on text not null,
  captured_at text not null,
  rating_average real not null,
  rating_count integer not null,
  primary key (track_id, captured_on)
);

create table if not exists chart_snapshots (
  track_id integer not null references apps (track_id),
  tier text not null default 'verified' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  captured_on text not null,
  captured_at text not null,
  country text not null,
  chart text not null check (
    chart in ('top-free', 'top-paid', 'top-grossing')
  ),
  genre_id integer not null default 0,
  rank integer not null check (rank > 0),
  primary key (
    track_id,
    captured_on,
    country,
    chart,
    genre_id
  )
);

create table if not exists version_releases (
  track_id integer not null references apps (track_id),
  tier text not null default 'verified' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  version text not null,
  released_at text not null,
  notes text not null,
  primary key (track_id, version)
);
