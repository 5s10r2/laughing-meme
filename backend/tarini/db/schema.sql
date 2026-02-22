-- Tarini Agent — Supabase Schema
-- Apply via: Supabase Dashboard > SQL Editor > Run

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-user ready from day 1
  user_id TEXT,

  -- Legacy field from Agent SDK era — unused but kept for compatibility
  sdk_session_id TEXT,

  -- Onboarding stage: intro | structure | packages | mapping | verification
  stage TEXT NOT NULL DEFAULT 'intro',

  -- All property data as a flexible JSONB blob.
  -- Schema is defined in the system prompt.
  state JSONB NOT NULL DEFAULT '{}',

  -- Monotonically increasing version — incremented on every update_state call
  state_version INTEGER NOT NULL DEFAULT 1,

  -- Conversation history for persistence across server restarts
  messages JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_sdk_id ON sessions(sdk_session_id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Atomic state update: replaces state JSONB and increments state_version in ONE statement.
-- Eliminates the read-modify-write race condition that existed when Python did:
--   get_session → compute new_version → update
-- Called via: client.rpc("update_session_state_atomic", {...}).execute()
CREATE OR REPLACE FUNCTION update_session_state_atomic(
  p_session_id UUID,
  p_new_state   JSONB
)
RETURNS SETOF sessions
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE sessions
     SET state         = p_new_state,
         state_version = state_version + 1,
         updated_at    = NOW()
   WHERE id = p_session_id
   RETURNING *;
END;
$$;
