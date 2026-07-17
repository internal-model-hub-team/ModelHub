import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..database import get_db
from ..gitea import GiteaFile, gitea, normalize_repo_path
from ..models import RepoType, Repository, User, Visibility
from ..schemas import (
    PaginatedRepositories,
    RepositoryCreate,
    RepositoryFileOut,
    RepositoryFilesOut,
    RepositoryOut,
    RepositoryUpdate,
)
from ..security import get_current_user, get_optional_user

router = APIRouter(prefix="/repositories", tags=["repositories"])


def serialize(repo: Repository, readme: str | None = None) -> RepositoryOut:
    return RepositoryOut(
        id=repo.id,
        name=repo.name,
        slug=repo.slug,
        repo_type=repo.repo_type,
        visibility=repo.visibility,
        description=repo.description,
        tags=[tag for tag in repo.tags.split(",") if tag],
        license=repo.license,
        readme=repo.readme if readme is None else readme,
        clone_url=repo.clone_url,
        download_count=repo.download_count,
        owner={"username": repo.owner.username, "display_name": repo.owner.display_name},
        created_at=repo.created_at,
        updated_at=repo.updated_at,
    )


def serialize_file(file: GiteaFile) -> RepositoryFileOut:
    return RepositoryFileOut(
        name=file.name,
        path=file.path,
        type=file.type,
        size=file.size,
        sha=file.sha,
        is_lfs=file.is_lfs,
    )


def find_repository(
    db: Session,
    repo_type: RepoType,
    owner: str,
    slug: str,
) -> Repository | None:
    return db.scalar(
        select(Repository)
        .join(Repository.owner)
        .options(joinedload(Repository.owner))
        .where(
            Repository.repo_type == repo_type,
            User.username == owner.lower(),
            Repository.slug == slug,
        )
    )


def readable_repository(
    db: Session,
    repo_type: RepoType,
    owner: str,
    slug: str,
    user: User | None,
) -> Repository:
    repo = find_repository(db, repo_type, owner, slug)
    if repo is None or (
        repo.visibility == Visibility.private
        and (user is None or repo.owner_id != user.id)
    ):
        raise HTTPException(404, "Repository not found")
    return repo


def owned_repository(
    db: Session,
    repo_type: RepoType,
    owner: str,
    slug: str,
    user: User,
) -> Repository:
    repo = find_repository(db, repo_type, owner, slug)
    if repo is None or repo.owner_id != user.id:
        raise HTTPException(404, "Repository not found")
    return repo


@router.get("", response_model=PaginatedRepositories)
def list_repositories(
    q: str = "",
    repo_type: RepoType | None = None,
    tag: str = "",
    owner: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    filters = [
        or_(
            Repository.visibility == Visibility.public,
            Repository.owner_id == (user.id if user else -1),
        )
    ]
    if q:
        needle = f"%{q}%"
        filters.append(
            or_(
                Repository.name.ilike(needle),
                Repository.description.ilike(needle),
                Repository.tags.ilike(needle),
            )
        )
    if repo_type:
        filters.append(Repository.repo_type == repo_type)
    if tag:
        filters.append(Repository.tags.ilike(f"%{tag.lower()}%"))
    if owner:
        filters.append(User.username == owner.lower())
    base = select(Repository).join(Repository.owner).where(*filters)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    repos = db.scalars(
        base.options(joinedload(Repository.owner))
        .order_by(Repository.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return PaginatedRepositories(
        items=[serialize(repo) for repo in repos],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=RepositoryOut, status_code=status.HTTP_201_CREATED)
def create_repository(
    payload: RepositoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exists = db.scalar(
        select(Repository).where(
            Repository.owner_id == user.id,
            Repository.slug == payload.slug,
            Repository.repo_type == payload.repo_type,
        )
    )
    if exists:
        raise HTTPException(409, "Repository already exists")
    remote_name = f"{payload.repo_type.value}-{payload.slug}"
    remote = gitea.create_repository(
        user.username,
        remote_name,
        payload.visibility == Visibility.private,
        payload.description,
        payload.readme,
    )
    repo = Repository(
        owner_id=user.id,
        name=payload.name,
        slug=payload.slug,
        repo_type=payload.repo_type,
        visibility=payload.visibility,
        description=payload.description,
        tags=",".join(payload.tags),
        license=payload.license,
        readme=payload.readme,
        gitea_owner=remote.owner,
        gitea_repo=remote.name,
        clone_url=remote.clone_url,
    )
    try:
        db.add(repo)
        db.commit()
        db.refresh(repo)
    except Exception:
        db.rollback()
        gitea.delete_repository(remote.owner, remote.name)
        raise
    repo.owner = user
    return serialize(repo)


@router.get("/{repo_type}/{owner}/{slug}", response_model=RepositoryOut)
def get_repository(
    repo_type: RepoType,
    owner: str,
    slug: str,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    repo = readable_repository(db, repo_type, owner, slug, user)
    readme = gitea.read_text_file(repo.gitea_owner, repo.gitea_repo, "README.md")
    return serialize(repo, readme)


@router.patch("/{repo_type}/{owner}/{slug}", response_model=RepositoryOut)
def update_repository(
    repo_type: RepoType,
    owner: str,
    slug: str,
    payload: RepositoryUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = owned_repository(db, repo_type, owner, slug, user)
    values = payload.model_dump(exclude_unset=True)
    if "tags" in values:
        values["tags"] = ",".join(
            dict.fromkeys(tag.strip().lower() for tag in values["tags"] if tag.strip())
        )
    if "readme" in values:
        gitea.put_file_bytes(
            repo.gitea_owner,
            repo.gitea_repo,
            "README.md",
            values["readme"].encode(),
            "Update README from Model Hub",
        )
    if "visibility" in values or "description" in values:
        gitea.update_repository(
            repo.gitea_owner,
            repo.gitea_repo,
            private=(values["visibility"] == Visibility.private) if "visibility" in values else None,
            description=values.get("description"),
        )
    for key, value in values.items():
        setattr(repo, key, value)
    db.commit()
    db.refresh(repo)
    return serialize(repo)


@router.delete(
    "/{repo_type}/{owner}/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_repository(
    repo_type: RepoType,
    owner: str,
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = owned_repository(db, repo_type, owner, slug, user)
    gitea.delete_repository(repo.gitea_owner, repo.gitea_repo)
    db.delete(repo)
    db.commit()


@router.get(
    "/{repo_type}/{owner}/{slug}/files",
    response_model=RepositoryFilesOut,
)
def list_repository_files(
    repo_type: RepoType,
    owner: str,
    slug: str,
    path: str = Query(""),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    repo = readable_repository(db, repo_type, owner, slug, user)
    directory = normalize_repo_path(path, allow_empty=True)
    items = gitea.list_files(repo.gitea_owner, repo.gitea_repo, directory)
    return RepositoryFilesOut(
        path=directory,
        items=[serialize_file(item) for item in items],
        total=len(items),
    )


@router.post(
    "/{repo_type}/{owner}/{slug}/files",
    response_model=RepositoryFileOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_repository_file(
    repo_type: RepoType,
    owner: str,
    slug: str,
    file: UploadFile = File(...),
    path: str = Form(""),
    use_lfs: bool = Form(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = owned_repository(db, repo_type, owner, slug, user)
    filename = PurePosixPath((file.filename or "").replace("\\", "/")).name
    if not filename or filename in {".", ".."}:
        raise HTTPException(422, "Invalid file name")
    directory = normalize_repo_path(path, allow_empty=True)
    target_path = normalize_repo_path(f"{directory}/{filename}" if directory else filename)
    settings = get_settings()
    temporary_path: Path | None = None
    size = 0
    try:
        with tempfile.NamedTemporaryFile(prefix="modelhub-upload-", delete=False) as handle:
            temporary_path = Path(handle.name)
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_size_bytes:
                    raise HTTPException(413, "File exceeds the configured upload limit")
                handle.write(chunk)
        result = gitea.put_file(
            repo.gitea_owner,
            repo.gitea_repo,
            target_path,
            temporary_path,
            size,
            use_lfs,
        )
        return serialize_file(result)
    finally:
        file.file.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


@router.get("/{repo_type}/{owner}/{slug}/files/{file_path:path}")
def download_repository_file(
    repo_type: RepoType,
    owner: str,
    slug: str,
    file_path: str,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    repo = readable_repository(db, repo_type, owner, slug, user)
    normalized_path = normalize_repo_path(file_path)
    download = gitea.download_file(repo.gitea_owner, repo.gitea_repo, normalized_path)
    repo.download_count += 1
    db.commit()
    filename = PurePosixPath(normalized_path).name
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        "X-ModelHub-LFS": "true" if gitea.should_use_lfs(normalized_path, download.size or 0) else "false",
    }
    if download.size is not None:
        headers["Content-Length"] = str(download.size)
    return StreamingResponse(download.chunks, media_type=download.media_type, headers=headers)
