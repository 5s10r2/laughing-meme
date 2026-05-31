"""Experience flags — single source of truth for the env switches.

Kept tiny and import-cheap so any layer (agent, tools, server) can read a flag without
circular imports.
"""
from __future__ import annotations

import os


def use_new_experience() -> bool:
    """Switch from the legacy stepper to the redesigned conversational backend.
    Default OFF — legacy path is byte-identical until flipped."""
    return os.environ.get("USE_NEW_EXPERIENCE", "").strip().lower() in {"1", "true", "yes", "on"}


def use_tree_model() -> bool:
    """Switch the new-experience domain from the flat Property model to the recursive
    Space tree. Default OFF — the existing v2/legacy paths are byte-identical until flipped."""
    return os.environ.get("USE_TREE_MODEL", "").strip().lower() in {"1", "true", "yes", "on"}


def ui_components_enabled() -> bool:
    """The generative-UI switch. Default ON (the rich experience is the product);
    set ENABLE_UI_COMPONENTS=0/false/no/off for a pure-text AI chat."""
    return os.environ.get("ENABLE_UI_COMPONENTS", "1").strip().lower() not in {"0", "false", "no", "off"}
