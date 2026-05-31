from pathlib import Path

_HERE = Path(__file__).parent


def _read(name: str) -> str:
    try:
        return (_HERE / name).read_text(encoding="utf-8")
    except FileNotFoundError as e:
        raise RuntimeError(
            f"{name} not found — ensure it is included in your deployment. "
            f"Expected path: {_HERE / name}"
        ) from e


def load_system_prompt() -> str:
    """Return Tarini's legacy system prompt (cached at module load)."""
    return _SYSTEM_PROMPT


def load_system_prompt_v2() -> str:
    """Return the redesigned thin system prompt — the stable, cacheable core.

    Correctness lives in the command layer, not here; this prompt only guides judgment.
    Per-turn state is NOT baked in (that would break prompt caching) — it is appended
    separately via render_live_context() after the cache breakpoint.

    Returns the recursive-tree variant when USE_TREE_MODEL is on (the agent must speak the
    tree command vocabulary), else the flat Property variant. Both are stable + cacheable.
    """
    from tarini.flags import use_tree_model

    return _SYSTEM_PROMPT_V2_TREE if use_tree_model() else _SYSTEM_PROMPT_V2


_SYSTEM_PROMPT = _read("system_prompt.md")
_SYSTEM_PROMPT_V2 = _read("system_prompt_v2.md")
_SYSTEM_PROMPT_V2_TREE = _read("system_prompt_v2_tree.md")


_FACET_GLYPH = {"complete": "✓", "partial": "◐", "empty": "✗"}


def render_live_context(snapshot: dict) -> str:
    """Render the small per-turn live block appended after the cached core (the redesign's
    `[DYNAMIC — injected each turn]` section).

    Deliberately compact: a one-line identity, the completeness glyphs, and the open items —
    enough to orient and nudge without a round-trip. The full model + ids come from get_model.
    `snapshot` is a CommandService snapshot: {model, completeness, version, warnings}.
    """
    model = snapshot.get("model", {})
    comp = snapshot.get("completeness", {})
    facets = comp.get("facets", {})
    counts = comp.get("counts", {})

    name = model.get("name")
    if name:
        bits = [b for b in (model.get("type"), model.get("location")) if b]
        identity = f"{name}" + (f" ({', '.join(bits)})" if bits else "")
    else:
        identity = "new property — nothing captured yet"

    facet_line = " · ".join(
        f"{k} {_FACET_GLYPH.get(v, v)}"
        for k, v in (("property", facets.get("property")),
                     ("structure", facets.get("structure")),
                     ("packages", facets.get("packages")),
                     ("mapping", facets.get("mapping")))
        if v is not None
    )

    lines = [
        "## Current model (live)",
        f"Property: {identity}",
        f"Counts: {counts.get('floors', 0)} floors · {counts.get('rooms', 0)} rooms · "
        f"{counts.get('packages', 0)} packages · {counts.get('rooms_mapped', 0)} mapped",
    ]
    if facet_line:
        lines.append(f"Completeness: {facet_line}")

    open_items = comp.get("open_items") or []
    if open_items:
        lines.append("Still open before publish:")
        lines.extend(f"- {item}" for item in open_items)
    elif comp.get("publishable"):
        lines.append("Ready to publish — nothing is open.")

    lines.append("(Call get_model for the full model and the ids you need.)")
    return "\n".join(lines)


# Single source of truth for the silent opening prompt that triggers the greeting.
# Imported by both server.py (web) and main.py (CLI) — never duplicated.
INITIAL_PROMPT = (
    "Session started. Call get_state immediately to check current progress, "
    "then greet the user appropriately based on their stage and what has been saved."
)

# Redesigned-path opening prompt — get_model, not get_state; no stage language.
INITIAL_PROMPT_V2 = (
    "Session started. Call get_model immediately to see what's already captured, "
    "then greet the owner warmly and continue from wherever they left off."
)
