/**
 * Database schema (PostgreSQL).
 *
 * The same SQL runs on the embedded database used for local development
 * (PGlite) and on a hosted Postgres such as Neon in production.
 *
 * Everything lives in its own `duwa` schema with row-level security enabled
 * and no policies: only the application's own database role can read it.
 */
export const SCHEMA_VERSION = "2";

export const SCHEMA_SQL = /* sql */ `
select pg_advisory_xact_lock(727459001);

create schema if not exists duwa;

create table if not exists duwa.meta (
  key text primary key,
  value text not null
);

-- A private room: exactly two seats, entered with an invite code.
create table if not exists duwa.rooms (
  id text primary key,
  code text not null unique,
  version integer not null default 1,
  shared_points integer not null default 0,
  progress jsonb not null default '{}'::jsonb,
  active_session_id text,
  wake_ms double precision,
  recovery_fails integer not null default 0,
  recovery_locked_ms double precision not null default 0,
  created_ms double precision not null,
  updated_ms double precision not null
);

-- A player belongs to one room and owns one of its two seats.
create table if not exists duwa.players (
  id text primary key,
  room_id text not null references duwa.rooms(id) on delete cascade,
  seat smallint not null check (seat in (0, 1)),
  name text not null,
  gender text not null default 'm' check (gender in ('m', 'f')),
  avatar text not null,
  color text not null,
  title text not null,
  token_hash text not null,
  recovery_hash text not null,
  points integer not null default 0,
  stats jsonb not null default '{}'::jsonb,
  seen_until_ms double precision not null default 0,
  last_seen_ms double precision not null default 0,
  created_ms double precision not null,
  unique (room_id, seat)
);

-- One play-through of a game. "state" is the live round, so it survives
-- restarts and disconnects; "summary" is the final result.
create table if not exists duwa.sessions (
  id text primary key,
  room_id text not null references duwa.rooms(id) on delete cascade,
  game_id text not null,
  status text not null check (status in ('active', 'finished', 'aborted')),
  state jsonb not null,
  summary jsonb,
  started_ms double precision not null,
  finished_ms double precision
);
create index if not exists sessions_room_finished on duwa.sessions (room_id, finished_ms desc);

-- What each player submitted in each round (written once, at the reveal).
create table if not exists duwa.answers (
  session_id text not null references duwa.sessions(id) on delete cascade,
  round integer not null,
  seat smallint not null,
  kind text not null default 'answer',
  payload jsonb not null,
  created_ms double precision not null,
  primary key (session_id, round, seat, kind)
);

-- Points ledger. owner: 0/1 = a player, 2 = the pair (shared balance only).
-- The unique key makes a second award for the same thing impossible.
create table if not exists duwa.scores (
  room_id text not null references duwa.rooms(id) on delete cascade,
  key text not null,
  session_id text,
  owner smallint not null check (owner in (0, 1, 2)),
  reason text not null,
  points integer not null check (points > 0),
  created_ms double precision not null,
  primary key (room_id, key)
);

create table if not exists duwa.achievements (
  room_id text not null references duwa.rooms(id) on delete cascade,
  owner smallint not null check (owner in (0, 1, 2)),
  key text not null,
  unlocked_ms double precision not null,
  primary key (room_id, owner, key)
);

create table if not exists duwa.unlocks (
  room_id text not null references duwa.rooms(id) on delete cascade,
  world_id text not null,
  unlocked_ms double precision not null,
  primary key (room_id, world_id)
);

-- Drawing strokes for «خمن الرسمة», appended in small batches.
create table if not exists duwa.strokes (
  session_id text not null references duwa.sessions(id) on delete cascade,
  turn integer not null,
  seq integer not null,
  data jsonb not null,
  primary key (session_id, turn, seq)
);

-- v2: how to address each player in Arabic (masculine / feminine wording)
alter table duwa.players add column if not exists gender text not null default 'm';

alter table duwa.meta enable row level security;
alter table duwa.rooms enable row level security;
alter table duwa.players enable row level security;
alter table duwa.sessions enable row level security;
alter table duwa.answers enable row level security;
alter table duwa.scores enable row level security;
alter table duwa.achievements enable row level security;
alter table duwa.unlocks enable row level security;
alter table duwa.strokes enable row level security;

insert into duwa.meta (key, value) values ('schema', '${SCHEMA_VERSION}')
  on conflict (key) do update set value = excluded.value;
`;
