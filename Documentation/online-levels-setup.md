# Online Levels — Supabase Setup

The community level catalog is backed by a single Supabase table. GitHub Pages
serves only static files, so the browser talks to Supabase directly over
HTTPS+CORS using the public **anon** key (safe to ship in client JS when paired
with the row-level-security policies below).

This is a one-time manual setup. None of it lives in the repo's code except the
project URL + anon key, which go into `src/online.js`.

## 1. Create the project

1. Sign in at <https://supabase.com> and create a new project (free tier is fine).
2. Once provisioned, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon / public** key (a long JWT).
3. Paste both into the constants at the top of `src/online.js`:
   ```js
   const SUPABASE_URL = 'https://abcdefgh.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```

## 2. Create the table, policies and index

Open **SQL Editor** in the Supabase dashboard and run:

```sql
-- Trigram support for case-insensitive name/author search.
create extension if not exists pg_trgm;

create table public.levels (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  author         text not null,
  data           jsonb not null,
  author_time_ms integer,
  created_at     timestamptz not null default now(),
  edit_token     uuid not null default gen_random_uuid()
);

-- Search indexes (name OR author, ilike).
create index levels_name_trgm   on public.levels using gin (name gin_trgm_ops);
create index levels_author_trgm on public.levels using gin (author gin_trgm_ops);
create index levels_author_idx  on public.levels (author);
create index levels_created_idx on public.levels (created_at desc);

-- Row-level security: anyone may read and insert, nobody may update/delete
-- through the anon key (management is deferred; admins use the dashboard).
alter table public.levels enable row level security;

create policy "public read"
  on public.levels for select
  using (true);

create policy "public insert"
  on public.levels for insert
  with check (true);
```

### Why `edit_token` is exposed but unused

`edit_token` is generated per upload and returned to the uploader, who stashes it
in `localStorage`. The MVP never uses it — it exists so a future "manage my
uploads" feature can authorize update/delete (via an RPC or an edited policy)
without a migration. With the policies above, anon clients cannot update or
delete regardless, so leaking the token is harmless today.

> Note: the default Supabase REST API returns `edit_token` on insert because the
> client requests it. If you later want to hide it from `SELECT`, move it to a
> separate table or use a column-level grant; not needed for the MVP.

## 3. Moderation / cleanup (manual)

Open the **Table Editor → levels** in the dashboard to inspect or delete rows.
Deleting a row there removes it from the catalog. There is no in-app reporting or
rate limiting in the MVP — open anonymous uploads are an accepted risk for this
test.

## 4. Reserved for later

The schema deliberately leaves room for richer metadata without a breaking
migration:

- average completion time (aggregate of player times),
- 5-star rating (separate `ratings` table keyed by `level id`),
- per-level leaderboards (separate `times` table; `author_time_ms` already seeds
  the uploader's own time).

None of these are implemented yet.
