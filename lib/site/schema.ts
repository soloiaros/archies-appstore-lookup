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

create table if not exists user (
  id text not null primary key,
  name text not null,
  email text not null unique,
  emailVerified integer not null,
  image text,
  createdAt date not null,
  updatedAt date not null
);

create table if not exists session (
  id text not null primary key,
  expiresAt date not null,
  token text not null unique,
  createdAt date not null,
  updatedAt date not null,
  ipAddress text,
  userAgent text,
  userId text not null references user (id) on delete cascade
);

create table if not exists account (
  id text not null primary key,
  accountId text not null,
  providerId text not null,
  userId text not null references user (id) on delete cascade,
  accessToken text,
  refreshToken text,
  idToken text,
  accessTokenExpiresAt date,
  refreshTokenExpiresAt date,
  scope text,
  password text,
  createdAt date not null,
  updatedAt date not null
);

create table if not exists verification (
  id text not null primary key,
  identifier text not null,
  value text not null,
  expiresAt date not null,
  createdAt date not null,
  updatedAt date not null
);

create index if not exists session_userId_idx on session (userId);

create index if not exists account_userId_idx on account (userId);

create index if not exists verification_identifier_idx on verification (identifier);
`;
