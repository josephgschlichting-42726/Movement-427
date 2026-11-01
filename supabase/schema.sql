-- mōv — Supabase schema (run once in Supabase → SQL Editor → New query → paste → Run)
--
-- One generic table mirrors every local (IndexedDB) table. Each row is owned by the
-- signed-in user and row-level security guarantees nobody can read or write anyone
-- else's rows. Local-first: the phone is the source of truth; this is sync + backup.

create table if not exists public.records (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl               text not null,                 -- local table name, e.g. 'sessions'
  data              jsonb not null,                -- the full local row
  updated_at        bigint not null,               -- client clock (ms) — last-write-wins
  deleted_at        bigint,                        -- soft delete (ms), mirrors the app
  server_updated_at timestamptz not null default now()  -- server clock — pull cursor
);

create index if not exists records_user_cursor on public.records (user_id, server_updated_at);

alter table public.records enable row level security;

drop policy if exists "own rows: select" on public.records;
drop policy if exists "own rows: insert" on public.records;
drop policy if exists "own rows: update" on public.records;
create policy "own rows: select" on public.records for select using (user_id = auth.uid());
create policy "own rows: insert" on public.records for insert with check (user_id = auth.uid());
create policy "own rows: update" on public.records for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No delete policy: the app only soft-deletes, so rows can always be restored.

-- Stamp the server clock on every write (the pull cursor never trusts phone clocks).
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.records_touch();

-- Push a batch of rows. Last-write-wins: an incoming row only replaces the stored one if
-- it is at least as new, so an old phone can never clobber newer edits.
-- security invoker = runs as the caller, so the RLS policies above still apply.
create or replace function public.push_records(rows jsonb) returns integer
language sql security invoker as $$
  with incoming as (
    select (r->>'id')::uuid                     as id,
           r->>'tbl'                             as tbl,
           r->'data'                             as data,
           (r->>'updated_at')::bigint            as updated_at,
           nullif(r->>'deleted_at', '')::bigint  as deleted_at
    from jsonb_array_elements(rows) r
  ), upserted as (
    insert into public.records (id, user_id, tbl, data, updated_at, deleted_at)
    select id, auth.uid(), tbl, data, updated_at, deleted_at from incoming
    on conflict (id) do update
      set tbl = excluded.tbl,
          data = excluded.data,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      where public.records.user_id = auth.uid()
        and public.records.updated_at <= excluded.updated_at
    returning 1
  )
  select count(*)::integer from upserted;
$$;

grant execute on function public.push_records(jsonb) to authenticated;
