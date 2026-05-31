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

import types
import typing
from dataclasses import MISSING, fields

from tarini.domain import commands as c
from tarini.domain import space_commands as sc

# name -> dataclass, auto-synced with each domain command union (add a command to the
# union → it decodes for free). The codec functions take a `command_types` map so the
# legacy and tree vocabularies share one strict, tested boundary.
COMMAND_TYPES: dict[str, type] = {t.__name__: t for t in typing.get_args(c.Command)}
SPACE_COMMAND_TYPES: dict[str, type] = {t.__name__: t for t in typing.get_args(sc.SpaceCommand)}


class CommandDecodeError(Exception):
    """A command payload was malformed — wrong type, unknown/missing field, or bad value."""


def _field_map(cls: type) -> dict:
    return {f.name: f for f in fields(cls)}


def _matches(value: object, hint: object) -> bool:
    """Best-effort runtime type check of a decoded JSON value against a field annotation.

    Handles the shapes the command vocabulary actually uses: str/int/bool, list[str],
    dict[str, int], and Optional (X | None). `bool` is checked strictly (it's an int
    subclass, so a bool must not satisfy an int field, nor vice-versa)."""
    origin = typing.get_origin(hint)
    if origin in (typing.Union, types.UnionType):
        return any(_matches(value, arg) for arg in typing.get_args(hint))
    if hint is type(None):
        return value is None
    if origin in (list, set, tuple, frozenset):
        if not isinstance(value, list):
            return False
        args = typing.get_args(hint)
        elem = args[0] if args else object
        return all(_matches(v, elem) for v in value)
    if origin is dict:
        if not isinstance(value, dict):
            return False
        kt, vt = typing.get_args(hint) or (object, object)
        return all(_matches(k, kt) and _matches(v, vt) for k, v in value.items())
    if hint is bool:
        return isinstance(value, bool)
    if hint is int:
        return isinstance(value, int) and not isinstance(value, bool)
    if hint is float:
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if hint in (str, object) or hint is None:
        return isinstance(value, str) if hint is str else True
    try:
        return isinstance(value, hint)  # type: ignore[arg-type]
    except TypeError:
        return True


def _required_fields(cls: type) -> list[str]:
    return [
        f.name for f in fields(cls)
        if f.default is MISSING and f.default_factory is MISSING  # type: ignore[misc]
    ]


def decode_command(payload: dict, command_types: dict[str, type] | None = None) -> c.Command:
    """Decode one command object into its domain dataclass. Raises CommandDecodeError."""
    command_types = command_types or COMMAND_TYPES
    if not isinstance(payload, dict):
        raise CommandDecodeError("each command must be a JSON object")

    op = payload.get("op")
    if not op:
        raise CommandDecodeError("command is missing its 'op' field (the command name)")

    cls = command_types.get(op)
    if cls is None:
        raise CommandDecodeError(
            f"unknown command op {op!r}; valid ops: {sorted(command_types)}"
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

    # Validate value TYPES too — field names alone don't stop {"count": "two"} from
    # decoding and then blowing up at apply-time. This keeps the boundary honest:
    # nothing downstream sees a value of the wrong shape.
    hints = typing.get_type_hints(cls)
    for name, value in args.items():
        hint = hints.get(name)
        if hint is not None and not _matches(value, hint):
            raise CommandDecodeError(
                f"{op}: field {name!r} has the wrong type (got {type(value).__name__})"
            )

    try:
        return cls(**args)
    except (TypeError, ValueError) as e:  # defensive — shouldn't trigger after the checks above
        raise CommandDecodeError(f"{op}: {e}")


def decode_commands(payloads: list, command_types: dict[str, type] | None = None) -> list[c.Command]:
    """Decode a batch. Fails fast on the first bad command (nothing is applied)."""
    if not isinstance(payloads, list):
        raise CommandDecodeError("'commands' must be a JSON array")
    if not payloads:
        raise CommandDecodeError("'commands' is empty — provide at least one command")
    return [decode_command(p, command_types) for p in payloads]


def command_catalog_text(command_types: dict[str, type] | None = None) -> str:
    """A compact, never-drifting signature list of the command vocabulary, for the prompt /
    tool description: `CreatePackage(name, sharing?, ac?, food?, furnishing?, rent?, amenities?)`."""
    command_types = command_types or COMMAND_TYPES
    lines = []
    for name, cls in command_types.items():
        req = set(_required_fields(cls))
        params = ", ".join(f.name if f.name in req else f"{f.name}?" for f in fields(cls))
        lines.append(f"{name}({params})")
    return "\n".join(lines)


# ---- tree command vocabulary (thin wrappers over the shared, parameterised core) ----
def decode_space_command(payload: dict):
    return decode_command(payload, SPACE_COMMAND_TYPES)


def decode_space_commands(payloads: list):
    return decode_commands(payloads, SPACE_COMMAND_TYPES)


def space_command_catalog_text() -> str:
    return command_catalog_text(SPACE_COMMAND_TYPES)
