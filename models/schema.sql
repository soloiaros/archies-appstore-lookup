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

create table if not exists app_tags (
  track_id integer not null references apps (track_id),
  tag_id text not null,
  tier text not null default 'estimated' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  method text not null,
  primary key (track_id, tag_id)
);

create table if not exists screenshot_ocr (
  track_id integer not null references apps (track_id),
  screenshot_url text not null,
  tier text not null default 'estimated' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  method text not null,
  text text not null,
  primary key (track_id, screenshot_url)
);

create table if not exists text_embeddings (
  track_id integer primary key references apps (track_id),
  tier text not null default 'estimated' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  method text not null,
  model text not null,
  source_hash text not null,
  dims integer not null,
  vector blob not null,
  embedded_at text not null
);

create table if not exists icon_embeddings (
  track_id integer primary key references apps (track_id),
  tier text not null default 'estimated' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  method text not null,
  model text not null,
  source_hash text not null,
  dims integer not null,
  vector blob not null,
  embedded_at text not null
);

create table if not exists icon_signals (
  track_id integer primary key references apps (track_id),
  tier text not null default 'estimated' check (
    tier in ('verified', 'estimated', 'unavailable')
  ),
  method text not null,
  color_text text not null,
  colors text not null,
  letters text not null
);

create table if not exists revenue_estimates (
  track_id integer not null references apps (track_id),
  captured_on text not null,
  country text not null,
  basis text not null check (
    basis in (
      'overall-grossing',
      'genre-grossing',
      'genre-ceiling',
      'below-grossing'
    )
  ),
  rank integer check (
    rank is null
    or rank > 0
  ),
  chart text check (
    chart is null
    or chart = 'top-grossing'
  ),
  genre_id integer,
  low_usd real,
  mid_usd real,
  high_usd real,
  tier text not null default 'estimated' check (
    tier = 'estimated'
  ),
  method text not null,
  primary key (
    track_id,
    captured_on,
    country
  )
);

