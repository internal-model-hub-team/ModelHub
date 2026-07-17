import base64
import hashlib
import json
import mimetypes
import os
import shutil
import subprocess
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from .config import get_settings

CHUNK_SIZE = 1024 * 1024


@dataclass
class GiteaRepository:
    owner: str
    name: str
    clone_url: str


@dataclass
class GiteaFile:
    name: str
    path: str
    type: str
    size: int
    sha: str
    is_lfs: bool


@dataclass
class GiteaDownload:
    chunks: Iterator[bytes]
    media_type: str
    size: int | None


def normalize_repo_path(value: str, *, allow_empty: bool = False) -> str:
    cleaned = value.strip().replace("\\", "/").strip("/")
    if not cleaned:
        if allow_empty:
            return ""
        raise HTTPException(422, "Repository path cannot be empty")
    path = PurePosixPath(cleaned)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise HTTPException(422, "Invalid repository path")
    return path.as_posix()


class GiteaClient:
    def __init__(self):
        self.settings = get_settings()

    @property
    def _headers(self) -> dict[str, str]:
        if not self.settings.gitea_admin_token:
            raise HTTPException(503, "Gitea admin token is not configured")
        return {
            "Authorization": f"token {self.settings.gitea_admin_token}",
            "Accept": "application/json",
        }

    def _api_url(self, path: str) -> str:
        return f"{self.settings.gitea_url.rstrip('/')}/api/v1{path}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        expected: tuple[int, ...] = (200,),
        allow_not_found: bool = False,
        **kwargs,
    ) -> httpx.Response | None:
        try:
            with httpx.Client(timeout=60, trust_env=False) as client:
                response = client.request(
                    method,
                    self._api_url(path),
                    headers=self._headers,
                    **kwargs,
                )
        except httpx.HTTPError as exc:
            raise HTTPException(503, "Gitea is unavailable") from exc
        if allow_not_found and response.status_code == 404:
            return None
        if response.status_code not in expected:
            detail = response.text[:500] or f"HTTP {response.status_code}"
            raise HTTPException(502, f"Gitea rejected the request: {detail}")
        return response

    def _mock_root(self) -> Path:
        root = Path(self.settings.mock_storage_root).resolve()
        root.mkdir(parents=True, exist_ok=True)
        return root

    def _mock_repository_path(self, owner: str, repo: str) -> Path:
        root = self._mock_root()
        path = (root / "repositories" / owner / repo).resolve()
        if not path.is_relative_to(root):
            raise HTTPException(422, "Invalid mock repository path")
        return path

    def _mock_file_path(self, owner: str, repo: str, file_path: str) -> Path:
        repository = self._mock_repository_path(owner, repo)
        path = (repository / Path(*PurePosixPath(file_path).parts)).resolve()
        if not path.is_relative_to(repository):
            raise HTTPException(422, "Invalid repository path")
        return path

    def ensure_user(self, username: str, email: str, password: str, display_name: str = "") -> None:
        if self.settings.gitea_mock:
            users = self._mock_root() / "users"
            users.mkdir(parents=True, exist_ok=True)
            record = users / f"{username}.json"
            record.write_text(
                json.dumps(
                    {"username": username, "email": email, "full_name": display_name},
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            return

        payload = {
            "username": username,
            "email": email,
            "password": password,
            "full_name": display_name,
            "must_change_password": False,
            "send_notify": False,
        }
        response = self._request(
            "POST",
            "/admin/users",
            expected=(201, 422),
            json=payload,
        )
        if response is not None and response.status_code == 422:
            existing = self._request(
                "GET",
                f"/users/{quote(username, safe='')}",
                allow_not_found=True,
            )
            if existing is not None:
                raise HTTPException(409, "Username already exists in Gitea")
            raise HTTPException(502, "Gitea could not create the matching user")

    def update_user(self, username: str, email: str, display_name: str) -> None:
        if self.settings.gitea_mock:
            users = self._mock_root() / "users"
            users.mkdir(parents=True, exist_ok=True)
            (users / f"{username}.json").write_text(
                json.dumps(
                    {"username": username, "email": email, "full_name": display_name},
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            return
        self._request(
            "PATCH",
            f"/admin/users/{quote(username, safe='')}",
            json={
                "source_id": 0,
                "login_name": username,
                "email": email,
                "full_name": display_name,
            },
        )

    def create_repository(
        self,
        owner: str,
        name: str,
        private: bool,
        description: str,
        readme: str = "",
    ) -> GiteaRepository:
        if self.settings.gitea_mock:
            repository = self._mock_repository_path(owner, name)
            repository.mkdir(parents=True, exist_ok=False)
            if readme:
                (repository / "README.md").write_text(readme, encoding="utf-8")
            return GiteaRepository(
                owner,
                name,
                f"{self.settings.gitea_public_url.rstrip('/')}/{owner}/{name}.git",
            )

        response = self._request(
            "POST",
            f"/admin/users/{quote(owner, safe='')}/repos",
            expected=(201,),
            json={
                "name": name,
                "private": private,
                "description": description,
                "auto_init": True,
                "default_branch": "main",
            },
        )
        assert response is not None
        data = response.json()
        remote = GiteaRepository(data["owner"]["login"], data["name"], data["clone_url"])
        if readme:
            self.put_file_bytes(remote.owner, remote.name, "README.md", readme.encode(), "Initialize README")
        return remote

    def update_repository(
        self,
        owner: str,
        name: str,
        *,
        private: bool | None = None,
        description: str | None = None,
    ) -> None:
        if self.settings.gitea_mock:
            return
        payload: dict[str, object] = {}
        if private is not None:
            payload["private"] = private
        if description is not None:
            payload["description"] = description
        if not payload:
            return
        self._request(
            "PATCH",
            f"/repos/{quote(owner, safe='')}/{quote(name, safe='')}",
            json=payload,
        )

    def delete_repository(self, owner: str, name: str) -> None:
        if self.settings.gitea_mock:
            shutil.rmtree(self._mock_repository_path(owner, name), ignore_errors=True)
            return
        self._request(
            "DELETE",
            f"/repos/{quote(owner, safe='')}/{quote(name, safe='')}",
            expected=(204,),
        )

    def _content_path(self, owner: str, repo: str, file_path: str) -> str:
        encoded_path = quote(file_path, safe="/")
        return f"/repos/{quote(owner, safe='')}/{quote(repo, safe='')}/contents/{encoded_path}"

    def _get_content(self, owner: str, repo: str, file_path: str) -> dict | list | None:
        path = self._content_path(owner, repo, file_path) if file_path else (
            f"/repos/{quote(owner, safe='')}/{quote(repo, safe='')}/contents"
        )
        response = self._request("GET", path, allow_not_found=True)
        return None if response is None else response.json()

    def put_file_bytes(
        self,
        owner: str,
        repo: str,
        file_path: str,
        content: bytes,
        message: str,
    ) -> GiteaFile:
        file_path = normalize_repo_path(file_path)
        if self.settings.gitea_mock:
            target = self._mock_file_path(owner, repo, file_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            return self._mock_file(owner, repo, target)

        existing = self._get_content(owner, repo, file_path)
        payload = {"content": base64.b64encode(content).decode(), "message": message}
        method = "POST"
        expected = (201,)
        if isinstance(existing, dict):
            method = "PUT"
            expected = (200,)
            payload["sha"] = existing["sha"]
        response = self._request(
            method,
            self._content_path(owner, repo, file_path),
            expected=expected,
            json=payload,
        )
        assert response is not None
        data = response.json()["content"]
        return self._serialize_file(data)

    def read_text_file(self, owner: str, repo: str, file_path: str) -> str:
        file_path = normalize_repo_path(file_path)
        if self.settings.gitea_mock:
            path = self._mock_file_path(owner, repo, file_path)
            return path.read_text(encoding="utf-8") if path.is_file() else ""
        content = self._get_content(owner, repo, file_path)
        if not isinstance(content, dict) or content.get("type") != "file":
            return ""
        try:
            return base64.b64decode(content.get("content", "")).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            return ""

    def should_use_lfs(self, file_path: str, size: int, force_lfs: bool = False) -> bool:
        return (
            force_lfs
            or size >= self.settings.lfs_threshold_bytes
            or PurePosixPath(file_path).suffix.lower() in self.settings.lfs_extension_set
        )

    def put_file(
        self,
        owner: str,
        repo: str,
        file_path: str,
        source: Path,
        size: int,
        force_lfs: bool = False,
    ) -> GiteaFile:
        file_path = normalize_repo_path(file_path)
        use_lfs = self.should_use_lfs(file_path, size, force_lfs)
        if self.settings.gitea_mock:
            target = self._mock_file_path(owner, repo, file_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            if use_lfs:
                self._update_mock_gitattributes(owner, repo, file_path)
            result = self._mock_file(owner, repo, target)
            result.is_lfs = use_lfs
            return result
        if use_lfs:
            self._put_lfs_file(owner, repo, file_path, source)
            digest = self._sha256(source)
            return GiteaFile(PurePosixPath(file_path).name, file_path, "file", size, digest, True)
        return self.put_file_bytes(owner, repo, file_path, source.read_bytes(), f"Upload {file_path}")

    def _git_environment(self) -> dict[str, str]:
        auth = base64.b64encode(
            f"{self.settings.gitea_admin_username}:{self.settings.gitea_admin_token}".encode()
        ).decode()
        env = os.environ.copy()
        env.update(
            {
                "GIT_TERMINAL_PROMPT": "0",
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_KEY_0": "http.extraHeader",
                "GIT_CONFIG_VALUE_0": f"Authorization: Basic {auth}",
            }
        )
        return env

    def _run_git(self, arguments: list[str], cwd: Path, env: dict[str, str]) -> None:
        try:
            subprocess.run(
                [self.settings.git_executable, *arguments],
                cwd=cwd,
                env=env,
                check=True,
                capture_output=True,
                text=True,
                timeout=300,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            raise HTTPException(503, "Git or Git LFS is not available in the backend") from exc
        except subprocess.CalledProcessError as exc:
            message = (exc.stderr or exc.stdout or "Git operation failed")[-1000:]
            message = message.replace(self.settings.gitea_admin_token, "***")
            raise HTTPException(502, f"Gitea Git operation failed: {message}") from exc

    def _put_lfs_file(self, owner: str, repo: str, file_path: str, source: Path) -> None:
        if not self.settings.gitea_admin_token:
            raise HTTPException(503, "Gitea admin token is not configured")
        clone_url = f"{self.settings.gitea_url.rstrip('/')}/{owner}/{repo}.git"
        env = self._git_environment()
        with tempfile.TemporaryDirectory(prefix="modelhub-lfs-") as temp_dir:
            root = Path(temp_dir)
            checkout = root / "repository"
            self._run_git(["clone", "--depth", "1", clone_url, str(checkout)], root, env)
            self._run_git(["lfs", "install", "--local"], checkout, env)
            # Gitea advertises its browser-facing ROOT_URL for LFS. Inside Docker,
            # use the same internal endpoint as the Git clone instead.
            self._run_git(["config", "lfs.url", f"{clone_url}/info/lfs"], checkout, env)
            target = checkout / Path(*PurePosixPath(file_path).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            self._run_git(["lfs", "track", file_path], checkout, env)
            self._run_git(["add", "--", file_path, ".gitattributes"], checkout, env)
            self._run_git(
                [
                    "-c",
                    "user.name=Model Hub",
                    "-c",
                    "user.email=modelhub@local",
                    "commit",
                    "-m",
                    f"Upload {file_path} with Git LFS",
                ],
                checkout,
                env,
            )
            self._run_git(["push", "origin", "HEAD"], checkout, env)

    def _update_mock_gitattributes(self, owner: str, repo: str, file_path: str) -> None:
        attributes = self._mock_file_path(owner, repo, ".gitattributes")
        line = f"{file_path} filter=lfs diff=lfs merge=lfs -text"
        existing = attributes.read_text(encoding="utf-8").splitlines() if attributes.exists() else []
        if line not in existing:
            attributes.write_text("\n".join([*existing, line]) + "\n", encoding="utf-8")

    def _sha256(self, path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            while chunk := handle.read(CHUNK_SIZE):
                digest.update(chunk)
        return digest.hexdigest()

    def _mock_file(self, owner: str, repo: str, path: Path) -> GiteaFile:
        repository = self._mock_repository_path(owner, repo)
        relative = path.relative_to(repository).as_posix()
        is_dir = path.is_dir()
        size = 0 if is_dir else path.stat().st_size
        sha = "" if is_dir else self._sha256(path)
        return GiteaFile(
            path.name,
            relative,
            "dir" if is_dir else "file",
            size,
            sha,
            False if is_dir else self.should_use_lfs(relative, size),
        )

    def _parse_lfs_pointer(self, content: str) -> int | None:
        if not content.startswith("version https://git-lfs.github.com/spec/v1"):
            return None
        for line in content.splitlines():
            if line.startswith("size "):
                try:
                    return int(line.removeprefix("size "))
                except ValueError:
                    return None
        return None

    def _serialize_file(self, item: dict) -> GiteaFile:
        return GiteaFile(
            item.get("name", ""),
            item.get("path", ""),
            item.get("type", "file"),
            int(item.get("size") or 0),
            item.get("sha", ""),
            False,
        )

    def list_files(self, owner: str, repo: str, directory: str = "") -> list[GiteaFile]:
        directory = normalize_repo_path(directory, allow_empty=True)
        if self.settings.gitea_mock:
            root = self._mock_repository_path(owner, repo)
            target = root if not directory else self._mock_file_path(owner, repo, directory)
            if not target.exists() or not target.is_dir():
                raise HTTPException(404, "Directory not found")
            return sorted(
                (self._mock_file(owner, repo, item) for item in target.iterdir()),
                key=lambda item: (item.type != "dir", item.name.lower()),
            )

        content = self._get_content(owner, repo, directory)
        if content is None:
            raise HTTPException(404, "Directory not found")
        items = content if isinstance(content, list) else [content]
        result = [self._serialize_file(item) for item in items]
        for entry in result:
            if entry.type != "file" or not self.should_use_lfs(entry.path, entry.size):
                continue
            details = self._get_content(owner, repo, entry.path)
            if not isinstance(details, dict):
                continue
            try:
                pointer = base64.b64decode(details.get("content", "")).decode()
            except (ValueError, UnicodeDecodeError):
                continue
            lfs_size = self._parse_lfs_pointer(pointer)
            if lfs_size is not None:
                entry.size = lfs_size
                entry.is_lfs = True
        return sorted(result, key=lambda item: (item.type != "dir", item.name.lower()))

    def download_file(self, owner: str, repo: str, file_path: str) -> GiteaDownload:
        file_path = normalize_repo_path(file_path)
        media_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        if self.settings.gitea_mock:
            path = self._mock_file_path(owner, repo, file_path)
            if not path.is_file():
                raise HTTPException(404, "File not found")

            def local_chunks() -> Iterator[bytes]:
                with path.open("rb") as handle:
                    while chunk := handle.read(CHUNK_SIZE):
                        yield chunk

            return GiteaDownload(local_chunks(), media_type, path.stat().st_size)

        client = httpx.Client(timeout=300, trust_env=False)
        path = (
            f"/repos/{quote(owner, safe='')}/{quote(repo, safe='')}/media/"
            f"{quote(file_path, safe='/')}"
        )
        try:
            request = client.build_request("GET", self._api_url(path), headers=self._headers)
            response = client.send(request, stream=True)
        except httpx.HTTPError as exc:
            client.close()
            raise HTTPException(503, "Gitea is unavailable") from exc
        if response.status_code == 404:
            response.close()
            client.close()
            raise HTTPException(404, "File not found")
        if response.status_code != 200:
            response.close()
            client.close()
            raise HTTPException(502, "Gitea could not download the file")

        def remote_chunks() -> Iterator[bytes]:
            try:
                yield from response.iter_bytes(CHUNK_SIZE)
            finally:
                response.close()
                client.close()

        size_header = response.headers.get("content-length")
        size = int(size_header) if size_header and size_header.isdigit() else None
        return GiteaDownload(
            remote_chunks(),
            response.headers.get("content-type", media_type),
            size,
        )


gitea = GiteaClient()
