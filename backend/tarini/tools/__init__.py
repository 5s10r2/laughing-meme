from claude_agent_sdk import create_sdk_mcp_server
from .state import build_state_tools


def build_mcp_server(session_id: str):
    """Create an in-process MCP server with state tools bound to session_id."""
    tools = build_state_tools(session_id)
    return create_sdk_mcp_server(
        name="tarini",
        version="1.0.0",
        tools=tools,
    )
