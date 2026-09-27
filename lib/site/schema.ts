export const SCHEMA = `
create table if not exists slots (
  id integer primary key,
  kind text not null,
  status text not null,
  name text,
  url text,
  blurb text,
  logo_url text,
  color text,
  hold_until integer,
  paid_until integer,
  checkout_id text
);

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

create table if not exists orders (
  id text primary key,
  slot_id integer not null,
  email text not null,
  created_at integer not null,
  status text not null
);

create index if not exists orders_email on orders (email, status);

create table if not exists meta (
  key text primary key,
  value integer not null,
  updated_at integer not null
);

insert or ignore into slots (
  id,
  kind,
  status,
  name,
  url,
  blurb,
  logo_url,
  color
) values (
  1,
  'house',
  'taken',
  'Beau',
  'https://www.beaugymjournal.com/',
  'your frictionless gym journal',
  '/sponsors/beau.png',
  '#f4f1ea'
);

insert or ignore into slots (id, kind, status) values
  (2, 'sale', 'open'),
  (3, 'sale', 'open'),
  (4, 'sale', 'open'),
  (5, 'sale', 'open'),
  (6, 'sale', 'open');
`;
