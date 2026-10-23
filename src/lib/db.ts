import postgres from "postgres";

const SCHEMA = `
create table if not exists media (
  id bigint generated always as identity primary key,
  key text not null unique,
  -- Shared by the same song or album on every service; group by it for popularity.
  match_key text not null,
  source text not null,
  kind text not null,
  title text not null,
  artists text[] not null default '{}',
  curator text,
  cover_url text not null,
  url text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists media_events (
  id bigint generated always as identity primary key,
  media_id bigint not null references media (id) on delete cascade,
  type text not null check (type in ('created', 'download', 'copy', 'share')),
  theme text check (theme in ('auto', 'light', 'dark')),
  edited boolean not null default false,
  locale text,
  -- Keyed hash of address, match_key, type and minute: one count per person per minute.
  dedupe_key text not null unique,
  at timestamptz not null default now()
);

create index if not exists media_match_key_idx on media (match_key);
create index if not exists media_events_at_idx on media_events (at);
create index if not exists media_events_media_at_idx on media_events (media_id, at);
`;

interface DbState {
  sql: postgres.Sql;
  ready: Promise<unknown>;
}

// Survives dev hot reloads, which would otherwise open a new pool on every edit.
const g = globalThis as typeof globalThis & { __trackshareDb?: DbState | null };

/** The database, with its tables created. Null when DATABASE_URL is not set. */
export async function db(): Promise<postgres.Sql | null> {
  if (g.__trackshareDb === undefined) {
    const url = process.env.DATABASE_URL;
    if (url) {
      const sql = postgres(url, { max: 5, idle_timeout: 20, onnotice: () => {} });
      g.__trackshareDb = { sql, ready: sql.unsafe(SCHEMA) };
    } else {
      g.__trackshareDb = null;
    }
  }
  const state = g.__trackshareDb;
  if (!state) return null;
  try {
    await state.ready;
  } catch (err) {
    // Retry the schema on the next call instead of failing forever.
    state.ready = state.sql.unsafe(SCHEMA);
    throw err;
  }
  return state.sql;
}
