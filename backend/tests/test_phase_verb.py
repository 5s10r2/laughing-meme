"""_phase_verb narrates BOTH command vocabularies (legacy Property + Space tree).

Regression for the review finding: on the tree path the thinking bar degraded to the
generic 'Saving your changes...' because _phase_verb only knew legacy op names.
"""
from tarini.agent import _phase_verb


def test_tree_ops_narrate():
    assert _phase_verb([{"op": "MapOffering"}]) == "Mapping the rooms..."
    assert _phase_verb([{"op": "UnmapOffering"}]) == "Mapping the rooms..."
    assert _phase_verb([{"op": "CreateOffering"}]) == "Setting up packages..."
    assert _phase_verb([{"op": "AddSpaces"}]) == "Structuring the floors..."
    assert _phase_verb([{"op": "SetSharing"}]) == "Structuring the floors..."
    assert _phase_verb([{"op": "SetProperty"}]) == "Updating the rooms..."


def test_publish_wins_over_structural_in_same_batch():
    assert _phase_verb([{"op": "AddSpaces"}, {"op": "Publish"}]) == "Publishing your listing..."


def test_legacy_ops_unchanged():
    assert _phase_verb([{"op": "AddFloors"}]) == "Structuring the floors..."
    assert _phase_verb([{"op": "CreatePackage"}]) == "Setting up packages..."
    assert _phase_verb([{"op": "MapRooms"}]) == "Mapping the rooms..."
    assert _phase_verb([]) == "Saving your changes..."
