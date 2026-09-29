export const SCHEMA = `
create table if not exists pageviews (
  id integer primary key,
  ts integer not null,
  path text not null,
  country text,
  referrer_host text,
  vid text not null,
  sid text not null
);

create index if not exists pageviews_ts on pageviews (ts);

create table if not exists rate_limits (
  bucket text not null,
  ip text not null,
  window_start integer not null,
  hits integer not null,
  primary key (bucket, ip, window_start)
);

create index if not exists rate_limits_window on rate_limits (window_start);

create table if not exists meta (
  key text primary key,
  value integer not null,
  updated_at integer not null
);
`;
