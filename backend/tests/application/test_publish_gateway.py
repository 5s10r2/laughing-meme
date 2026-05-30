"""Stub publish gateway test."""
from tarini.adapters.stub_publish_gateway import StubPublishGateway
from tarini.domain.property import Property


async def test_stub_publish_returns_reference():
    g = StubPublishGateway()
    p = Property()
    p.name = "Sunrise PG"
    r = await g.publish("session-abcdef12", p)
    assert r.ok is True
    assert r.reference == "stub_session-"
