import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides.clear()
    return TestClient(app)
