import time

import jwt
import pytest

from agent.dependencies import get_agent_settings, get_completion_service, get_session_issuer
from agent.schemas import Graph, Plan, PlannedEdge, PlannedNode, PlannedUpdate
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


def plan_of(nodes, edges, rationale="because", remove=(), updates=()) -> Plan:
    return Plan(rationale=rationale, nodes=nodes, edges=edges, removeEdges=list(remove), updates=list(updates))


def upd(id, name=None, config=None, x=None, y=None) -> PlannedUpdate:
    return PlannedUpdate(id=id, name=name, config=config, x=x, y=y)


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


CHAIN = Graph.model_validate(
    {
        "version": 1,
        "nodes": [
            {"id": "client", "service": "client", "config": {}, "position": {"x": 0, "y": 0}},
            {"id": "db", "service": "rds", "config": {"queryMs": 5}, "position": {"x": 320, "y": 0}},
            {"id": "reg", "service": "region", "config": {}, "position": {"x": 0, "y": 500}},
        ],
        "edges": [{"id": "e1", "from": "client", "to": "db"}],
    }
)


def test_materialize_insert_between_removes_old_edge_and_moves():
    plan = plan_of(
        [PlannedNode(id="ai-lb", service="lb", name=None, config="{}", x=320, y=0, parentId=None)],
        [PlannedEdge(id="n1", source="client", target="ai-lb"), PlannedEdge(id="n2", source="ai-lb", target="db"), PlannedEdge(id="n3", source="client", target="db")],
        remove=["e1", "e1", "ghost"],
        updates=[upd("db", x=640, y=0, config='{"maxConnections": 200}'), upd("db", name="dup"), upd("reg", x=1, y=1), upd("nope", name="x"), upd("client"), upd("client", x=5, y=None)],
    )
    added = CompletionService.materialize(CHAIN, plan)
    assert added.removedEdges == ["e1"]
    assert [(e.from_, e.to) for e in added.edges] == [("client", "ai-lb"), ("ai-lb", "db"), ("client", "db")]
    assert len(added.updates) == 1
    u = added.updates[0]
    assert u.id == "db" and u.position.x == 640 and u.config == {"maxConnections": 200} and u.name is None


def test_materialize_rejects_frames_and_client():
    plan = plan_of(
        [
            PlannedNode(id="ai-vpc", service="vpc", name=None, config="{}", x=0, y=0, parentId=None),
            PlannedNode(id="ai-reg", service="region", name=None, config="{}", x=0, y=0, parentId=None),
            PlannedNode(id="ai-client", service="client", name=None, config="{}", x=0, y=0, parentId=None),
            PlannedNode(id="ai-asg", service="asg", name=None, config="{}", x=0, y=0, parentId=None),
            PlannedNode(id="ai-ec2", service="ec2", name=None, config="{}", x=0, y=0, parentId="ai-asg"),
            PlannedNode(id="ai-in-reg", service="s3", name=None, config="{}", x=0, y=0, parentId="reg"),
        ],
        [],
    )
    added = CompletionService.materialize(CHAIN, plan)
    assert [n.id for n in added.nodes] == ["ai-asg", "ai-ec2", "ai-in-reg"]
    assert added.nodes[1].parentId == "ai-asg"
    assert added.nodes[2].parentId is None


def test_complete_merges_updates_and_removals(wired, issuer):
    graph = CHAIN.model_dump(by_alias=True, exclude_none=True)
    plan = plan_of(
        [PlannedNode(id="ai-lb", service="lb", name=None, config="{}", x=320, y=0, parentId=None)],
        [PlannedEdge(id="n1", source="client", target="ai-lb"), PlannedEdge(id="n2", source="ai-lb", target="db")],
        remove=["e1"],
        updates=[upd("db", x=640, y=0, config='{"maxConnections": 200}', name="primary")],
    )
    app.dependency_overrides[get_completion_service] = lambda: CompletionService(lambda s, p: plan)
    body = wired.post("/agent/complete", json={"graph": graph}, headers=bearer(issuer)).json()
    assert body["added"]["removedEdges"] == ["e1"]
    assert body["added"]["updates"] == [{"id": "db", "name": "primary", "config": {"maxConnections": 200}, "position": {"x": 640.0, "y": 0.0}}]
    db = next(n for n in body["graph"]["nodes"] if n["id"] == "db")
    assert db["config"] == {"queryMs": 5, "maxConnections": 200} and db["position"]["x"] == 640 and db["name"] == "primary"
    assert [e["id"] for e in body["graph"]["edges"]] == ["n1", "n2"]


def test_feedback_note_reports_accepted_and_discarded(issuer):
    calls = []

    def planner(session_id, prompt):
        calls.append(prompt)
        return plan_of(
            [PlannedNode(id="ai-lb", service="lb", name=None, config="{}", x=0, y=0, parentId=None), PlannedNode(id="ai-cache", service="elasticache", name=None, config="{}", x=0, y=0, parentId=None)],
            [PlannedEdge(id="ai-e1", source="client", target="ai-lb")],
        )

    service = CompletionService(planner)
    service.complete("s1", CHAIN, None)
    assert "Since your last proposal" not in calls[0]
    accepted = CHAIN.model_copy(update={"nodes": [*CHAIN.nodes, GraphNodeOf("ai-lb", "lb")], "edges": [*CHAIN.edges, GraphEdgeOf("ai-e1", "client", "ai-lb")]})
    service.complete("s1", accepted, None)
    assert calls[1].startswith("Since your last proposal — accepted: ai-lb, ai-e1; discarded: ai-cache.")
    service.complete("s2", CHAIN, None)
    assert "Since your last proposal" not in calls[2]


def GraphNodeOf(id, service):
    from agent.schemas import GraphNode

    return GraphNode(id=id, service=service)


def GraphEdgeOf(id, a, b):
    from agent.schemas import GraphEdge

    return GraphEdge(id=id, **{"from": a}, to=b)


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
