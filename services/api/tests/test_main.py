from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_models_returns_seed_data() -> None:
    response = client.get("/api/v1/models")

    assert response.status_code == 200
    assert len(response.json()) == 3


def test_list_models_filters_by_keyword() -> None:
    response = client.get("/api/v1/models", params={"q": "中文"})

    assert response.status_code == 200
    models = response.json()
    assert len(models) == 1
    assert models[0]["name"] == "Qwen2.5-Chinese-Chat"


def test_health_has_a_known_database_state() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["database"] in {"connected", "unavailable"}
