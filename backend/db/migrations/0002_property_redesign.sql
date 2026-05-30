-- 0002_property_redesign.sql
-- Persistence for the redesigned backend (the domain spine / CommandService).
--
-- Lives ALONGSIDE the legacy `sessions` table — the new experience is flag-gated and runs
-- in parallel with the live path, so it gets its own tables and never touches sessions.state.
-- Drop these tables to fully roll the redesign back; the live path is unaffected.

create extension if not exists "pgcrypto";

-- One row per session: the serialised Property aggregate + its optimistic-concurrency version.
create table if not exists property_snapshots (
  session_id uuid        primary key,
  snapshot   jsonb       not null,
  version    integer     not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only command log: audit trail + foundation for future undo/replay.
create table if not exists command_log (
  id           bigserial   primary key,
  session_id   uuid        not null,
  version      integer     not null,
  command_type text        not null,
  args         jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_command_log_session on command_log(session_id);

-- Atomic compare-and-set save (optimistic concurrency in one statement).
--   p_expected_version IS NULL  → insert a new snapshot; if one already exists, return nothing.
--   p_expected_version IS NOT NULL → update only if the stored version still matches; else nothing.
-- Either way an empty result set signals a conflict, which the adapter turns into a Conflict error.
create or replace function save_property_snapshot(
  p_session_id       uuid,
  p_snapshot         jsonb,
  p_version          integer,
  p_expected_version integer
)
returns setof property_snapshots
language plpgsql
as $$
begin
  if p_expected_version is null then
    return query
      insert into property_snapshots (session_id, snapshot, version)
      values (p_session_id, p_snapshot, p_version)
      on conflict (session_id) do nothing
      returning *;
  else
    return query
      update property_snapshots
         set snapshot   = p_snapshot,
             version    = p_version,
             updated_at = now()
       where session_id = p_session_id
         and version    = p_expected_version
      returning *;
  end if;
end;
$$;
