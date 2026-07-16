import os

os.environ["DATABASE_URL"] = "sqlite:///./test_hub.db"
os.environ["GITEA_MOCK"] = "true"
os.environ["SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


def setup_module():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_module():
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_hub.db"):
        os.remove("test_hub.db")


def test_complete_flow():
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/register", json={
            "username": "alice", "email": "alice@example.com", "password": "password123"
        })
        assert response.status_code == 201
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

        response = client.post("/api/v1/repositories", headers=headers, json={
            "name": "Tiny BERT", "slug": "tiny-bert", "repo_type": "model",
            "description": "A small test model", "tags": ["NLP", "bert"], "license": "apache-2.0"
        })
        assert response.status_code == 201
        assert response.json()["tags"] == ["nlp", "bert"]

        response = client.get("/api/v1/repositories?q=bert")
        assert response.status_code == 200
        assert response.json()["total"] == 1

        response = client.get("/api/v1/repositories/model/alice/tiny-bert")
        assert response.status_code == 200
        assert response.json()["owner"]["username"] == "alice"

        response = client.post("/api/v1/tokens", headers=headers, json={"name": "CLI"})
        assert response.status_code == 201
        assert response.json()["token"].startswith("imh_")
