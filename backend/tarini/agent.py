"""
ClaudeSDKClient options factory.

build_options(session_id, sdk_session_id) returns a ClaudeAgentOptions object
configured with:
  - claude-sonnet-4-20250514 model (direct Anthropic API)
  - Tarini's system prompt
  - In-process MCP tools bound to the session
  - bypassPermissions (tools run autonomously — no user permission dialogs)
  - resume= for session continuity across server restarts
"""
from claude_agent_sdk import ClaudeAgentOptions

from tarini.prompts import load_system_prompt
from tarini.tools import build_mcp_server


def build_options(
    session_id: str,
    sdk_session_id: str | None = None,
) -> ClaudeAgentOptions:
    """
    Create a fully configured ClaudeAgentOptions for a Tarini session.

    Uses direct Anthropic API. ANTHROPIC_API_KEY must be set in the environment.

    Args:
        session_id: Our Supabase session UUID (used to bind tools to correct session).
        sdk_session_id: Claude SDK session ID from a prior ResultMessage, for resumption.
    """
    return ClaudeAgentOptions(
        model="claude-sonnet-4-20250514",
        system_prompt=load_system_prompt(),
        allowed_tools=[
            "mcp__tarini__get_state",
            "mcp__tarini__update_state",
            "mcp__tarini__advance_stage",
        ],
        mcp_servers={"tarini": build_mcp_server(session_id)},
        permission_mode="bypassPermissions",
        resume=sdk_session_id,
    )
