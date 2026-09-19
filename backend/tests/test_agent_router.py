from agent.dependencies import get_agent_service
from agent.service import AgentService
from main import app


def fresh_service(client):
    service = AgentService()
    app.dependency_overrides[get_agent_service] = lambda: service
    return service


def test_create_agent_returns_201_and_id(client):
    fresh_service(client)
    res = client.post("/agents/", json={"name": "a"})
    assert res.status_code == 201
    assert res.json() == {"id": 1, "name": "a", "description": None}


def test_create_agent_increments_ids(client):
    fresh_service(client)
    client.post("/agents/", json={"name": "a"})
    res = client.post("/agents/", json={"name": "b", "description": "d"})
    assert res.json() == {"id": 2, "name": "b", "description": "d"}


def test_create_agent_requires_name(client):
    fresh_service(client)
    assert client.post("/agents/", json={}).status_code == 422


def test_get_agent_found(client):
    fresh_service(client)
    client.post("/agents/", json={"name": "a"})
    assert client.get("/agents/1").json()["name"] == "a"


def test_get_agent_missing_is_404(client):
    fresh_service(client)
    res = client.get("/agents/99")
    assert res.status_code == 404
    assert res.json()["detail"] == "Agent not found"


def test_get_agent_non_int_id_is_422(client):
    fresh_service(client)
    assert client.get("/agents/abc").status_code == 422


def test_list_agents_empty(client):
    fresh_service(client)
    assert client.get("/agents/").json() == []


def test_list_agents_preserves_order(client):
    fresh_service(client)
    client.post("/agents/", json={"name": "a"})
    client.post("/agents/", json={"name": "b"})
    assert [a["name"] for a in client.get("/agents/").json()] == ["a", "b"]


def test_default_agent_service_is_cached():
    get_agent_service.cache_clear()
    assert get_agent_service() is get_agent_service()
    assert isinstance(get_agent_service(), AgentService)
