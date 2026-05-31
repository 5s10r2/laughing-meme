"""Funnel stats — derive the onboarding funnel from stored snapshots (no new instrumentation).

Each persisted snapshot tells how far that session got: Started → Named → Units → Offerings →
Mapped → Published. We classify each to its *furthest* stage and report a cumulative funnel
(a published session also counts as named/units/offerings/mapped), plus drop-off between stages.
Pure — the route feeds it the snapshots + the total session count; this does the arithmetic.
"""
from __future__ import annotations

# ordered, cumulative — reaching a later stage implies all earlier ones
STAGES: list[tuple[str, str]] = [
    ("started", "Started"),
    ("named", "Property named"),
    ("units", "Units added"),
    ("offerings", "Offerings created"),
    ("mapped", "Units mapped"),
    ("published", "Published"),
]
_ORDER = [k for k, _ in STAGES]


def stage_of(snapshot: dict) -> str:
    """The furthest funnel stage a single snapshot reached (tree or legacy shape)."""
    if "spaces" in snapshot:  # recursive Space tree
        meta = snapshot.get("meta") or {}
        spaces = snapshot.get("spaces") or []
        offerings = snapshot.get("offerings") or []
        rentable = [s for s in spaces if s.get("rentable")]
        mapped = [s for s in rentable if s.get("offering_id")]
        named, published = bool(meta.get("name")), bool(meta.get("published"))
    else:  # legacy flat Property
        named = bool(snapshot.get("name"))
        rentable = snapshot.get("rooms") or []
        offerings = snapshot.get("packages") or []
        mapped = [r for r in rentable if r.get("package_id")]
        published = False  # legacy snapshot carries no published flag

    if published:
        return "published"
    if mapped:
        return "mapped"
    if offerings:
        return "offerings"
    if rentable:
        return "units"
    if named:
        return "named"
    return "started"


def compute_funnel(snapshots: list[dict], sessions_total: int) -> dict:
    """Cumulative funnel over all sessions. `sessions_total` includes sessions that never
    engaged (no snapshot); `snapshots` are the engaged ones."""
    counts = {k: 0 for k in _ORDER}
    counts["started"] = max(sessions_total, len(snapshots))
    for snap in snapshots:
        idx = _ORDER.index(stage_of(snap))
        for i in range(1, idx + 1):  # 'started' is the total; count named..published
            counts[_ORDER[i]] += 1

    total = counts["started"] or 1  # avoid /0
    stages = []
    prev = counts["started"]
    for key, label in STAGES:
        c = counts[key]
        stages.append({
            "key": key,
            "label": label,
            "count": c,
            "pctOfStarted": round(100 * c / total),
            "dropFromPrev": prev - c,
        })
        prev = c

    return {
        "sessionsTotal": counts["started"],
        "engaged": len(snapshots),
        "published": counts["published"],
        "stages": stages,
    }
