from fastapi.testclient import TestClient

from main import app


def test_lifespan_starts_and_stops_consumer():
    with TestClient(app) as client:
        res = client.get("/runs/")
        assert res.status_code == 200
