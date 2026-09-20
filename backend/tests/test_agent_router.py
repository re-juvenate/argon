import time

import jwt
import pytest

from agent.dependencies import get_agent_settings, get_completion_service, get_session_issuer
from agent.schemas import Graph, Plan, PlannedEdge, PlannedNode
from agent.service import CompletionService, parse_config
from agent.session import SessionError, SessionIssuer
from agent.settings import AgentSettings
from main import app

SETTINGS = AgentSettings(session_secret="test-secret-test-secret-test-secret", session_ttl_seconds=60)

GRAPH = {
    "version": 1,
    "defaults": {"dtSeconds": 1},
    "nodes": [
        {"id": "client", "service": "client", "config": {}, "position": {"x": 0, "y": 0}},
        {"id": "asg1", "service": "asg", "config": {}, "position": {"x": 400, "y": 0}},
        {"id": "ec2a", "service": "ec2", "config": {}, "parentId": "asg1"},
    ],
    "edges": [],
}


def plan_of(nodes, edges, rationale="because") -> Plan:
    return Plan(rationale=rationale, nodes=nodes, edges=edges)


@pytest.fixture
def issuer():
    return SessionIssuer(SETTINGS)


@pytest.fixture
def planner_calls():
    return []


@pytest.fixture
def wired(client, issuer, planner_calls):
    def planner(session_id, prompt):
        planner_calls.append((session_id, prompt))
        return plan_of(
            [
                PlannedNode(id="ai-lb", service="lb", name=None, config='{"lbType": "alb"}', x=200, y=0, parentId=None),
                PlannedNode(id="ai-ec2", service="ec2", name="web", config="not json", x=0, y=0, parentId="asg1"),
                PlannedNode(id="client", service="client", name=None, config="{}", x=0, y=0, parentId=None),
                PlannedNode(id="ai-orphan", service="rds", name=None, config="{}", x=0, y=0, parentId="missing"),
            ],
            [
                PlannedEdge(id="e1", source="client", target="ai-lb"),
                PlannedEdge(id="e2", source="ai-lb", target="asg1"),
                PlannedEdge(id="e3", source="ai-lb", target="ai-ec2"),
                PlannedEdge(id="e4", source="ai-lb", target="ai-lb"),
                PlannedEdge(id="e1", source="client", target="ai-lb"),
            ],
        )

    app.dependency_overrides[get_agent_settings] = lambda: SETTINGS
    app.dependency_overrides[get_session_issuer] = lambda: issuer
    app.dependency_overrides[get_completion_service] = lambda: CompletionService(planner)
    return client


def bearer(issuer):
    _, token, _ = issuer.issue()
    return {"authorization": f"Bearer {token}"}


def test_issue_and_verify_roundtrip(issuer):
    session_id, token, exp = issuer.issue()
    assert issuer.verify(token) == session_id
    assert len(session_id) >= 32
    assert exp - time.time() == pytest.approx(60, abs=2)


def test_verify_rejects_wrong_secret(issuer):
    token = jwt.encode({"sid": "x", "exp": int(time.time()) + 60}, "other-secret-other-secret-other-secret", algorithm="HS256")
    with pytest.raises(SessionError):
        issuer.verify(token)


def test_verify_rejects_expired(issuer):
    token = jwt.encode({"sid": "x", "exp": int(time.time()) - 1}, SETTINGS.session_secret, algorithm="HS256")
    with pytest.raises(SessionError):
        issuer.verify(token)


def test_verify_rejects_missing_sid(issuer):
    token = jwt.encode({"exp": int(time.time()) + 60}, SETTINGS.session_secret, algorithm="HS256")
    with pytest.raises(SessionError):
        issuer.verify(token)


def test_create_session_sets_cookie_and_returns_token(wired, issuer):
    res = wired.post("/agent/session")
    assert res.status_code == 201
    body = res.json()
    assert issuer.verify(body["token"]) == body["session_id"]
    assert body["expires_in"] == 60
    assert body["expires_at"] - time.time() == pytest.approx(60, abs=2)
    assert res.cookies.get("session") == body["token"]


def test_complete_requires_session(wired):
    res = wired.post("/agent/complete", json={"graph": GRAPH})
    assert res.status_code == 401
    assert res.json()["detail"] == "Session required"


def test_complete_rejects_bad_token(wired):
    res = wired.post("/agent/complete", json={"graph": GRAPH}, headers={"authorization": "Bearer nope"})
    assert res.status_code == 401
    assert res.json()["detail"].startswith("Invalid session")


def test_complete_accepts_cookie(wired, issuer):
    session_id, token, _ = issuer.issue()
    wired.cookies.set("session", token)
    res = wired.post("/agent/complete", json={"graph": GRAPH})
    assert res.status_code == 200
    assert res.json()["session_id"] == session_id


def test_complete_validates_graph(wired, issuer):
    res = wired.post("/agent/complete", json={"graph": {"version": 2, "nodes": [], "edges": []}}, headers=bearer(issuer))
    assert res.status_code == 422


def test_complete_returns_only_valid_additions(wired, issuer, planner_calls):
    res = wired.post("/agent/complete", json={"graph": GRAPH, "prompt": "add a load balancer"}, headers=bearer(issuer))
    assert res.status_code == 200
    body = res.json()
    assert body["rationale"] == "because"
    added = body["added"]
    assert [n["id"] for n in added["nodes"]] == ["ai-lb", "ai-ec2", "ai-orphan"]
    lb, ec2, orphan = added["nodes"]
    assert lb["config"] == {"lbType": "alb"}
    assert lb["position"] == {"x": 200, "y": 0}
    assert ec2["config"] == {}
    assert ec2["parentId"] == "asg1"
    assert "parentId" not in orphan
    assert "avgBytes" not in added["edges"][0]
    assert [(e["from"], e["to"]) for e in added["edges"]] == [("client", "ai-lb")]
    assert [n["id"] for n in body["graph"]["nodes"]] == ["client", "asg1", "ec2a", "ai-lb", "ai-ec2", "ai-orphan"]
    assert len(body["graph"]["edges"]) == 1


def test_complete_passes_prompt_and_graph_to_planner(wired, issuer, planner_calls):
    session_id, token, _ = issuer.issue()
    wired.post("/agent/complete", json={"graph": GRAPH, "prompt": "  add cache "}, headers={"authorization": f"Bearer {token}"})
    assert planner_calls[0][0] == session_id
    message = planner_calls[0][1]
    assert message.startswith("Task: propose the next step")
    assert "\nadd cache\n\nCurrent graph:\n" in message
    assert '"from"' not in message


def test_complete_default_prompt(wired, issuer, planner_calls):
    wired.post("/agent/complete", json={"graph": GRAPH}, headers=bearer(issuer))
    assert "\n(none)\n\nCurrent graph:\n" in planner_calls[0][1]


def test_system_prompt_covers_every_service():
    from agent.prompts import SYSTEM_PROMPT
    from agent.schemas import ServiceType

    for s in ServiceType:
        assert f"- {s.value}" in SYSTEM_PROMPT or f", {s.value}" in SYSTEM_PROMPT or f"{s.value}:" in SYSTEM_PROMPT


def test_complete_maps_throttle_to_429_with_retry_after(client, issuer):
    from agent.groq import Throttled

    def planner(session_id, prompt):
        raise Throttled(12.3, "rate limit, try again in 12.3s")

    app.dependency_overrides[get_session_issuer] = lambda: issuer
    app.dependency_overrides[get_completion_service] = lambda: CompletionService(planner)
    res = client.post("/agent/complete", json={"graph": GRAPH}, headers=bearer(issuer))
    assert res.status_code == 429
    assert res.headers["retry-after"] == "13"


def test_complete_maps_runtime_error_to_502(client, issuer):
    def planner(session_id, prompt):
        raise RuntimeError("model returned no plan")

    app.dependency_overrides[get_session_issuer] = lambda: issuer
    app.dependency_overrides[get_completion_service] = lambda: CompletionService(planner)
    res = client.post("/agent/complete", json={"graph": GRAPH}, headers=bearer(issuer))
    assert res.status_code == 502
    assert res.json()["detail"] == "model returned no plan"


def test_materialize_renames_colliding_edge_id():
    graph = Graph.model_validate({**GRAPH, "nodes": GRAPH["nodes"][:1] + [{"id": "s3", "service": "s3", "config": {}}], "edges": [{"id": "e1", "from": "client", "to": "s3"}]})
    plan = plan_of([PlannedNode(id="ai-cf", service="cloudfront", name=None, config="{}", x=0, y=0, parentId=None)],[PlannedEdge(id="e1", source="client", target="ai-cf")])
    added = CompletionService.materialize(graph, plan)
    assert added.edges[0].id == "ai-edge-client-ai-cf"


def test_parse_config_variants():
    assert parse_config("") == {}
    assert parse_config("[1]") == {}
    assert parse_config('{"a": 1}') == {"a": 1}


def test_default_settings_from_env(monkeypatch):
    monkeypatch.setenv("GROQ_MODEL", "m")
    monkeypatch.setenv("SESSION_SECRET", "s")
    s = AgentSettings()
    assert s.model_id == "m" and s.session_secret == "s"
    assert AgentSettings().session_secret == "s"
