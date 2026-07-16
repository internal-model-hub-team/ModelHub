import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'test-modelhub.db'}"
    storage_root = tmp_path / "model-files"
    app = create_app(
        database_url,
        storage_root=str(storage_root),
        max_upload_bytes=16,
    )
    with TestClient(app) as test_client:
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


def test_upload_list_and_download_model_file(client: TestClient) -> None:
    upload_response = client.post(
        "/api/v1/models/open-lab/Qwen2.5-Chinese-Chat/files",
        files={
            "file": (
                "weights.safetensors",
                b"model-bytes",
                "application/octet-stream",
            )
        },
    )

    assert upload_response.status_code == 201
    uploaded = upload_response.json()
    assert uploaded["name"] == "weights.safetensors"
    assert uploaded["size_bytes"] == 11

    detail_response = client.get(
        "/api/v1/models/open-lab/Qwen2.5-Chinese-Chat"
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["files"] == [uploaded]

    download_response = client.get(
        "/api/v1/models/open-lab/Qwen2.5-Chinese-Chat/files/weights.safetensors"
    )
    assert download_response.status_code == 200
    assert download_response.content == b"model-bytes"
    assert "weights.safetensors" in download_response.headers["content-disposition"]

    duplicate_response = client.post(
        "/api/v1/models/open-lab/Qwen2.5-Chinese-Chat/files",
        files={"file": ("weights.safetensors", b"again")},
    )
    assert duplicate_response.status_code == 409


def test_upload_rejects_unsupported_file_type(client: TestClient) -> None:
    response = client.post(
        "/api/v1/models/open-lab/Qwen2.5-Chinese-Chat/files",
        files={"file": ("installer.exe", b"not-a-model")},
    )

    assert response.status_code == 422


def test_upload_rejects_file_over_limit(client: TestClient) -> None:
    response = client.post(
        "/api/v1/models/open-lab/Qwen2.5-Chinese-Chat/files",
        files={"file": ("large.safetensors", b"x" * 17)},
    )

    assert response.status_code == 413
    detail_response = client.get(
        "/api/v1/models/open-lab/Qwen2.5-Chinese-Chat"
    )
    assert detail_response.json()["files"] == []


def test_health_reports_connected_database(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
