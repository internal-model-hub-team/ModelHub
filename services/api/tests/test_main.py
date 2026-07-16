import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'test-modelhub.db'}"
    with TestClient(create_app(database_url)) as test_client:
        yield test_client


def test_list_models_returns_seed_data(client: TestClient) -> None:
    response = client.get("/api/v1/models")

    assert response.status_code == 200
    assert len(response.json()) == 3


def test_list_models_filters_by_keyword(client: TestClient) -> None:
    response = client.get("/api/v1/models", params={"q": "中文"})

    assert response.status_code == 200
    models = response.json()
    assert len(models) == 1
    assert models[0]["name"] == "Qwen2.5-Chinese-Chat"


def test_create_model_persists_and_lists_it(client: TestClient) -> None:
    payload = {
        "name": "Chinese-Reranker-Small",
        "author": "demo-team",
        "task": "文本排序",
        "summary": "用于中文搜索结果重排的轻量模型。",
        "tags": ["中文", "Reranker", "中文"],
    }

    response = client.post("/api/v1/models", json=payload)

    assert response.status_code == 201
    created = response.json()
    assert created["downloads"] == 0
    assert created["tags"] == ["中文", "Reranker"]

    list_response = client.get("/api/v1/models", params={"q": "Reranker"})
    assert list_response.status_code == 200
    assert [model["id"] for model in list_response.json()] == [created["id"]]


def test_create_model_rejects_duplicate_owner_and_name(client: TestClient) -> None:
    payload = {
        "name": "New-Model",
        "author": "demo-team",
        "task": "文本生成",
        "summary": "这是一个用于测试重复名称检查的模型。",
        "tags": [],
    }

    assert client.post("/api/v1/models", json=payload).status_code == 201
    response = client.post("/api/v1/models", json=payload)

    assert response.status_code == 409
    assert response.json()["detail"] == "这个作者名下已经存在同名模型"


def test_create_model_validates_repository_name(client: TestClient) -> None:
    response = client.post(
        "/api/v1/models",
        json={
            "name": "包含空格的名称",
            "author": "demo-team",
            "task": "文本生成",
            "summary": "名称不符合仓库命名规则。",
            "tags": [],
        },
    )

    assert response.status_code == 422


def test_health_reports_connected_database(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
