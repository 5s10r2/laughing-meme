from pathlib import Path


def load_system_prompt() -> str:
    """Return Tarini's system prompt (cached at module load)."""
    return _SYSTEM_PROMPT


try:
    _SYSTEM_PROMPT = (Path(__file__).parent / "system_prompt.md").read_text(encoding="utf-8")
except FileNotFoundError as e:
    raise RuntimeError(
        "system_prompt.md not found — ensure it is included in your deployment. "
        f"Expected path: {Path(__file__).parent / 'system_prompt.md'}"
    ) from e


# Single source of truth for the silent opening prompt that triggers the greeting.
# Imported by both server.py (web) and main.py (CLI) — never duplicated.
INITIAL_PROMPT = (
    "Session started. Call get_state immediately to check current progress, "
    "then greet the user appropriately based on their stage and what has been saved."
)
