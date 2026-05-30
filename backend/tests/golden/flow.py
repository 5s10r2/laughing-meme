"""Golden-flow driver — replays a conversation as command batches through CommandService.

A golden flow is a full onboarding conversation expressed as the typed commands the agent
would emit, turn by turn. After each turn we assert the resulting model + completeness, so
any behavioural drift in the domain/application layer fails loudly.

The driver mirrors the real agent loop: it reads the model back after every turn (like
`get_model`) and lets later turns reference entities by their *human label* rather than the
uuid ids — exactly what the agent does when it inspects state before emitting `apply_commands`.
"""
from __future__ import annotations

from tarini.application.command_service import CommandService
from tarini.adapters.inmemory_repository import InMemoryPropertyRepository


class Flow:
    """Drives one session through CommandService and exposes label→id lookups for readability."""

    def __init__(self, session_id: str = "golden") -> None:
        self.svc = CommandService(InMemoryPropertyRepository())
        self.sid = session_id
        self.snapshot: dict = {}

    async def start(self) -> "Flow":
        self.snapshot = await self.svc.get_model(self.sid)
        return self

    async def turn(self, *commands) -> dict:
        """Apply one batch (one agent tool call) and refresh the snapshot."""
        self.snapshot = await self.svc.apply(self.sid, list(commands))
        return self.snapshot

    # ---- read-side helpers (the agent reads ids back from get_model the same way) ----
    @property
    def model(self) -> dict:
        return self.snapshot["model"]

    @property
    def completeness(self) -> dict:
        return self.snapshot["completeness"]

    @property
    def facets(self) -> dict:
        return self.snapshot["completeness"]["facets"]

    @property
    def warnings(self) -> list[str]:
        return self.snapshot.get("warnings", [])

    def floor_id(self, label: str) -> str:
        for f in self.model["floors"]:
            if f["label"] == label:
                return f["id"]
        raise KeyError(f"no floor labelled {label!r} (have {[f['label'] for f in self.model['floors']]})")

    def floor_ids(self) -> list[str]:
        return [f["id"] for f in self.model["floors"]]

    def package_id(self, name: str) -> str:
        for p in self.model["packages"]:
            if p["name"].lower() == name.lower():
                return p["id"]
        raise KeyError(f"no package named {name!r} (have {[p['name'] for p in self.model['packages']]})")

    def room_ids_on(self, floor_label: str) -> list[str]:
        fid = self.floor_id(floor_label)
        return [r["id"] for r in self.model["rooms"] if r["floor_id"] == fid]

    def rooms_for_package(self, name: str) -> list[dict]:
        pid = self.package_id(name)
        return [r for r in self.model["rooms"] if r["package_id"] == pid]
