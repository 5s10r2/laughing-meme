-- 0001_baseline.sql
-- Reconstructs the existing Supabase schema as version-controlled code (no behaviour change).
-- The sessions table + atomic RPCs were previously defined only in the Supabase dashboard.

create extension if not exists "pgcrypto";

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,
  stage         text        not null default 'intro',
  state         jsonb       not null default '{}'::jsonb,
  state_version integer     not null default 0,
  messages      jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Atomic state update: deep-merge happens in app code; this persists the new state
-- and bumps the version in one statement.
create or replace function update_session_state_atomic(p_session_id uuid, p_new_state jsonb)
returns sessions
language plpgsql
as $$
declare
  result sessions;
begin
  update sessions
     set state         = p_new_state,
         state_version = state_version + 1,
         updated_at    = now()
   where id = p_session_id
  returning * into result;
  return result;
end;
$$;

create or replace function advance_stage_atomic(p_session_id uuid, p_new_stage text)
returns sessions
language plpgsql
as $$
declare
  result sessions;
begin
  update sessions
     set stage      = p_new_stage,
         updated_at = now()
   where id = p_session_id
  returning * into result;
  return result;
end;
$$;
