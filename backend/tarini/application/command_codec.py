"""Command codec — the anti-corruption boundary between Claude's JSON and the domain.

Claude emits commands as JSON objects tagged with an `op` (the command name), e.g.
    {"op": "CreatePackage", "name": "AC Double", "rent": 9000}
The discriminator is `op`, not `type`, on purpose: `type` is itself a domain field (a property's
type — pg/hostel), and a flat object can't carry both. This module decodes payloads into the
frozen domain dataclasses, validating strictly at the boundary: unknown op, unknown field, or
missing required field raises CommandDecodeError with a message Claude can read and correct.
Nothing downstream ever sees malformed input.

The command vocabulary is derived from the domain `Command` union, so it can never drift from
what the aggregate actually accepts (add a command to the domain → it appears here for free).
"""
from __future__ import annotations

import typing
from dataclasses import MISSING, fields

from tarini.domain import commands as c

# name -> dataclass, auto-synced with the domain's Command union.
COMMAND_TYPES: dict[str, type] = {t.__name__: t for t in typing.get_args(c.Command)}


class CommandDecodeError(Exception):
    """A command payload was malformed — wrong type, unknown/missing field, or bad value."""


def _field_map(cls: type) -> dict:
    return {f.name: f for f in fields(cls)}


def _required_fields(cls: type) -> list[str]:
    return [
        f.name for f in fields(cls)
        if f.default is MISSING and f.default_factory is MISSING  # type: ignore[misc]
    ]


def decode_command(payload: dict) -> c.Command:
    """Decode one command object into its domain dataclass. Raises CommandDecodeError."""
    if not isinstance(payload, dict):
        raise CommandDecodeError("each command must be a JSON object")

    op = payload.get("op")
    if not op:
        raise CommandDecodeError("command is missing its 'op' field (the command name)")

    cls = COMMAND_TYPES.get(op)
    if cls is None:
        raise CommandDecodeError(
            f"unknown command op {op!r}; valid ops: {sorted(COMMAND_TYPES)}"
        )

    args = {k: v for k, v in payload.items() if k != "op"}
    allowed = _field_map(cls)

    unknown = sorted(set(args) - set(allowed))
    if unknown:
        raise CommandDecodeError(
            f"{op}: unknown field(s) {unknown}; allowed: {sorted(allowed)}"
        )

    missing = [name for name in _required_fields(cls) if name not in args]
    if missing:
        raise CommandDecodeError(f"{op}: missing required field(s) {missing}")

    try:
        return cls(**args)
    except TypeError as e:  # defensive — shouldn't trigger after the checks above
        raise CommandDecodeError(f"{op}: {e}")


def decode_commands(payloads: list) -> list[c.Command]:
    """Decode a batch. Fails fast on the first bad command (nothing is applied)."""
    if not isinstance(payloads, list):
        raise CommandDecodeError("'commands' must be a JSON array")
    if not payloads:
        raise CommandDecodeError("'commands' is empty — provide at least one command")
    return [decode_command(p) for p in payloads]


def command_catalog_text() -> str:
    """A compact, never-drifting signature list of the command vocabulary, for the prompt /
    tool description: `CreatePackage(name, sharing?, ac?, food?, furnishing?, rent?, amenities?)`."""
    lines = []
    required = {name: set(_required_fields(cls)) for name, cls in COMMAND_TYPES.items()}
    for name, cls in COMMAND_TYPES.items():
        req = required[name]
        params = ", ".join(
            f.name if f.name in req else f"{f.name}?" for f in fields(cls)
        )
        lines.append(f"{name}({params})")
    return "\n".join(lines)
