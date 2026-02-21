from pathlib import Path


def load_system_prompt() -> str:
    """Load Tarini's system prompt from the markdown file."""
    prompt_file = Path(__file__).parent / "system_prompt.md"
    return prompt_file.read_text(encoding="utf-8")


# Single source of truth for the silent opening prompt that triggers the greeting.
# Imported by both server.py (web) and main.py (CLI) — never duplicated.
INITIAL_PROMPT = (
    "Session started. Call get_state immediately to check current progress, "
    "then greet the user appropriately based on their stage and what has been saved."
)
