import json
import os
import shutil
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_hub.db"
os.environ["GITEA_MOCK"] = "true"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["MOCK_STORAGE_ROOT"] = "./test_mock_gitea"
os.environ["LFS_THRESHOLD_BYTES"] = "16"
os.environ["MAX_UPLOAD_SIZE_BYTES"] = "1048576"

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app

MOCK_ROOT = Path("test_mock_gitea")


def setup_module():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    shutil.rmtree(MOCK_ROOT, ignore_errors=True)


def teardown_module():
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_hub.db"):
        os.remove("test_hub.db")
    shutil.rmtree(MOCK_ROOT, ignore_errors=True)


def test_complete_flow():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "alice",
                "email": "alice@example.com",
                "password": "password123",
                "display_name": "Alice",
            },
        )
        assert response.status_code == 201
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

        synced_user = json.loads((MOCK_ROOT / "users" / "alice.json").read_text())
        assert synced_user["email"] == "alice@example.com"

        response = client.patch(
            "/api/v1/auth/me",
            headers=headers,
            json={"display_name": "Alice Lab", "bio": "Model researcher"},
        )
        assert response.status_code == 200
        assert json.loads((MOCK_ROOT / "users" / "alice.json").read_text())["full_name"] == "Alice Lab"

        response = client.post(
            "/api/v1/repositories",
            headers=headers,
            json={
                "name": "Tiny BERT",
                "slug": "tiny-bert",
                "repo_type": "model",
                "description": "A small test model",
                "tags": ["NLP", "bert"],
                "license": "apache-2.0",
                "readme": "# Tiny BERT\n\nInitial README.",
            },
        )
        assert response.status_code == 201
        assert response.json()["tags"] == ["nlp", "bert"]
        assert response.json()["category"] == "model-upload"
        assert response.json()["readme"].startswith("# Tiny BERT")

        response = client.post(
            "/api/v1/repositories",
            headers=headers,
            json={
                "name": "Structured Data Generator",
                "slug": "structured-generator",
                "repo_type": "model",
                "category": "model-generator",
                "description": "Generate structured support data",
                "tags": ["generator", "support"],
            },
        )
        assert response.status_code == 201
        assert response.json()["category"] == "model-generator"
        assert response.json()["tags"] == ["generator", "support"]

        response = client.get(
            "/api/v1/repositories?repo_type=model&category=model-generator"
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1
        response = client.get(
            "/api/v1/repositories?repo_type=model&category=model-upload"
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

        response = client.get("/api/v1/repositories?q=bert")
        assert response.status_code == 200
        assert response.json()["total"] == 1

        response = client.get("/api/v1/repositories/model/alice/tiny-bert")
        assert response.status_code == 200
        assert response.json()["owner"]["username"] == "alice"
        assert response.json()["readme"] == "# Tiny BERT\n\nInitial README."

        response = client.post(
            "/api/v1/repositories/model/alice/tiny-bert/files",
            headers=headers,
            data={"path": "configs"},
            files={"file": ("config.json", b'{"hidden_size": 64}', "application/json")},
        )
        assert response.status_code == 201
        assert response.json()["path"] == "configs/config.json"
        assert response.json()["is_lfs"] is True

        response = client.post(
            "/api/v1/repositories/model/alice/tiny-bert/files",
            headers=headers,
            files={"file": ("weights.bin", b"model-weights", "application/octet-stream")},
        )
        assert response.status_code == 201
        assert response.json()["is_lfs"] is True

        response = client.get("/api/v1/repositories/model/alice/tiny-bert/files")
        assert response.status_code == 200
        names = {item["name"] for item in response.json()["items"]}
        assert {"README.md", "configs", "weights.bin", ".gitattributes"} <= names
        weights = next(item for item in response.json()["items"] if item["name"] == "weights.bin")
        assert weights["size"] == len(b"model-weights")
        assert weights["is_lfs"] is True

        response = client.get(
            "/api/v1/repositories/model/alice/tiny-bert/files?path=configs"
        )
        assert response.status_code == 200
        assert response.json()["items"][0]["name"] == "config.json"

        response = client.get(
            "/api/v1/repositories/model/alice/tiny-bert/files/configs/config.json"
        )
        assert response.status_code == 200
        assert response.content == b'{"hidden_size": 64}'

        response = client.patch(
            "/api/v1/repositories/model/alice/tiny-bert",
            headers=headers,
            json={"readme": "# Tiny BERT\n\nUpdated in Gitea."},
        )
        assert response.status_code == 200
        response = client.get(
            "/api/v1/repositories/model/alice/tiny-bert/files/README.md"
        )
        assert response.content == b"# Tiny BERT\n\nUpdated in Gitea."

        response = client.post(
            "/api/v1/repositories",
            headers=headers,
            json={
                "name": "Private Data",
                "slug": "private-data",
                "repo_type": "dataset",
                "visibility": "private",
                "readme": "# Private",
            },
        )
        assert response.status_code == 201
        response = client.get("/api/v1/repositories/dataset/alice/private-data/files")
        assert response.status_code == 404
        response = client.get(
            "/api/v1/repositories/dataset/alice/private-data/files", headers=headers
        )
        assert response.status_code == 200

        response = client.post(
            "/api/v1/repositories",
            headers=headers,
            json={
                "name": "Support Synthetic Data",
                "slug": "support-synthetic",
                "repo_type": "dataset",
                "category": "dataset-synthetic",
                "description": "Synthetic customer support conversations",
                "tags": ["support", "chinese"],
            },
        )
        assert response.status_code == 201
        assert response.json()["category"] == "dataset-synthetic"

        response = client.get(
            "/api/v1/repositories?repo_type=dataset&category=dataset-synthetic"
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1
        response = client.get(
            "/api/v1/repositories?repo_type=dataset&category=mine", headers=headers
        )
        assert response.status_code == 200
        assert response.json()["total"] == 2

        response = client.post(
            "/api/v1/assistant/chat",
            headers=headers,
            json={"message": "帮我找 support 数据集", "mode": "search"},
        )
        assert response.status_code == 200
        assert response.json()["action"] == "search"
        assert response.json()["repositories"][0]["slug"] == "support-synthetic"

        response = client.post(
            "/api/v1/assistant/chat",
            headers=headers,
            json={
                "message": "生成客服问答结构化数据",
                "mode": "generate",
                "row_count": 5,
            },
        )
        assert response.status_code == 200
        assert response.json()["action"] == "generate"
        assert response.json()["generator"] == "local"
        assert len(response.json()["rows"]) == 5
        assert response.json()["columns"] == [
            "id",
            "question",
            "answer",
            "category",
            "quality_score",
        ]

        response = client.post("/api/v1/tokens", headers=headers, json={"name": "CLI"})
        assert response.status_code == 201
        assert response.json()["token"].startswith("imh_")
