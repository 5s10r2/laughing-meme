"""Experience flags — single source of truth for the env switches.

Kept tiny and import-cheap so any layer (agent, tools, server) can read a flag without
circular imports.
"""
from __future__ import annotations

import os


def use_tree_model() -> bool:
    """Switch the new-experience domain from the flat Property model to the recursive
    Space tree. Default OFF — the existing v2/legacy paths are byte-identical until flipped."""
    return os.environ.get("USE_TREE_MODEL", "").strip().lower() in {"1", "true", "yes", "on"}
