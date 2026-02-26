"""
emit_ui tool — instructs the frontend to render a rich UI component.

This is a side-channel tool: it doesn't mutate state, it tells the frontend
to render a component in the chat. The tool result returned to Claude confirms
the component was emitted, so Claude knows it was shown to the user.
"""
import json


# Components that Claude can request via emit_ui
AVAILABLE_COMPONENTS = {
    "WelcomeHero",
    "PropertyTypeSelector",
    "IntroSummaryCard",
    "FloorBuilder",
    "UnitCountInput",
    "NamingPreview",
    "FloorMilestoneReceipt",
    "StructureSummaryCard",
    "PackageSuggestionCard",
    "PackageForm",
    "PackageReceipt",
    "PackageList",
    "MappingSuggestionCard",
    "FloorMappingRow",
    "MappingMatrix",
    "BulkMappingPreview",
    "UnmappedUnitsWarning",
    "VerificationSummary",
    "PendingItemsList",
    "CompletionCelebration",
}


def validate_emit_ui(component: str, props: dict) -> str | None:
    """Validate emit_ui input. Returns error message or None if valid."""
    if not component:
        return "Missing 'component' field."
    if component not in AVAILABLE_COMPONENTS:
        return (
            f"Unknown component: '{component}'. "
            f"Available: {', '.join(sorted(AVAILABLE_COMPONENTS))}"
        )
    if not isinstance(props, dict):
        return "'props' must be a JSON object."
    return None


def emit_ui_result(component: str) -> str:
    """Return the tool result string confirming the component was rendered."""
    return json.dumps({
        "rendered": True,
        "component": component,
    })
