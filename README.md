# Internal Model Hub — backend MVP

An internal Hugging Face-style model and dataset registry. The first version includes:

- registration, login and user profiles;
- model/dataset repository creation backed by Gitea;
- public/private visibility;
- discovery search, type/tag/owner filters and pagination;
- repository detail, update and delete endpoints;
- personal API tokens for scripts and future CLI clients;
- automatic OpenAPI documentation.

Online inference, compute scheduling, discussions and online editing are intentionally out of scope.

## Run locally (beginner-friendly mock mode)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Open:

- API documentation: http://localhost:8000/docs
- Health check: http://localhost:8000/health

`GITEA_MOCK=true` lets the whole API run before Gitea is configured. It returns realistic clone URLs but does not create a real Git repository.

## Run tests

```bash
cd backend
pytest -q
```

## Connect real Gitea

1. Start Gitea and PostgreSQL with `docker compose up -d gitea postgres`.
2. Complete Gitea's first-time setup at http://localhost:3001.
3. Create the matching platform user in Gitea (the MVP expects the same username).
4. Generate a Gitea administrator access token.
5. Put it in `backend/.env` as `GITEA_ADMIN_TOKEN=...` and set `GITEA_MOCK=false`.
6. Start the backend.

The live integration creates repositories through Gitea's administrator API. A production iteration should replace the shared administrator token with Gitea OAuth/account synchronization.

## Frontend contract

All product endpoints are under `/api/v1`:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register and receive JWT |
| POST | `/auth/login` | Log in and receive JWT |
| GET/PATCH | `/auth/me` | Basic user page |
| GET/POST | `/repositories` | Discovery list / create repository |
| GET/PATCH/DELETE | `/repositories/{type}/{owner}/{slug}` | Repository detail and management |
| GET/POST | `/tokens` | List/create API tokens |
| DELETE | `/tokens/{id}` | Revoke API token |

For protected endpoints send `Authorization: Bearer <token>`. The interactive `/docs` page contains exact request/response schemas and can be used as the shared contract with the frontend developer.

## Important next iteration

Before deploying to real users, add Alembic migrations, account synchronization with Gitea, Git LFS/storage quotas, virus scanning, audit logging, backups and stricter rate limits.
