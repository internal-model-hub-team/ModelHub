from dataclasses import dataclass

import httpx
from fastapi import HTTPException

from .config import get_settings


@dataclass
class GiteaRepository:
    owner: str
    name: str
    clone_url: str


class GiteaClient:
    def __init__(self):
        self.settings = get_settings()

    def create_repository(self, owner: str, name: str, private: bool, description: str) -> GiteaRepository:
        if self.settings.gitea_mock:
            return GiteaRepository(owner, name, f"{self.settings.gitea_url}/{owner}/{name}.git")
        if not self.settings.gitea_admin_token:
            raise HTTPException(503, "Gitea admin token is not configured")
        headers = {"Authorization": f"token {self.settings.gitea_admin_token}"}
        payload = {"name": name, "private": private, "description": description, "auto_init": True}
        try:
            response = httpx.post(
                f"{self.settings.gitea_url}/api/v1/user/repos",
                headers=headers,
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"Gitea rejected repository creation: {exc.response.text}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(503, "Gitea is unavailable") from exc
        data = response.json()
        return GiteaRepository(data["owner"]["login"], data["name"], data["clone_url"])

    def delete_repository(self, owner: str, name: str) -> None:
        if self.settings.gitea_mock:
            return
        headers = {"Authorization": f"token {self.settings.gitea_admin_token}"}
        try:
            response = httpx.delete(
                f"{self.settings.gitea_url}/api/v1/repos/{owner}/{name}", headers=headers, timeout=15
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(502, "Could not delete the Gitea repository") from exc


gitea = GiteaClient()

