from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..gitea import gitea
from ..models import RepoType, Repository, User, Visibility
from ..schemas import PaginatedRepositories, RepositoryCreate, RepositoryOut, RepositoryUpdate
from ..security import get_current_user, get_optional_user

router = APIRouter(prefix="/repositories", tags=["repositories"])


def serialize(repo: Repository) -> RepositoryOut:
    return RepositoryOut(
        id=repo.id, name=repo.name, slug=repo.slug, repo_type=repo.repo_type,
        visibility=repo.visibility, description=repo.description,
        tags=[tag for tag in repo.tags.split(",") if tag], license=repo.license,
        readme=repo.readme, clone_url=repo.clone_url, download_count=repo.download_count,
        owner={"username": repo.owner.username, "display_name": repo.owner.display_name},
        created_at=repo.created_at, updated_at=repo.updated_at,
    )


@router.get("", response_model=PaginatedRepositories)
def list_repositories(
    q: str = "", repo_type: RepoType | None = None, tag: str = "",
    owner: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    user: User | None = Depends(get_optional_user), db: Session = Depends(get_db),
):
    filters = [or_(Repository.visibility == Visibility.public, Repository.owner_id == (user.id if user else -1))]
    if q:
        needle = f"%{q}%"
        filters.append(or_(Repository.name.ilike(needle), Repository.description.ilike(needle), Repository.tags.ilike(needle)))
    if repo_type:
        filters.append(Repository.repo_type == repo_type)
    if tag:
        filters.append(Repository.tags.ilike(f"%{tag.lower()}%"))
    if owner:
        filters.append(User.username == owner.lower())
    base = select(Repository).join(Repository.owner).where(*filters)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    repos = db.scalars(
        base.options(joinedload(Repository.owner)).order_by(Repository.updated_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return PaginatedRepositories(items=[serialize(repo) for repo in repos], total=total, page=page, page_size=page_size)


@router.post("", response_model=RepositoryOut, status_code=status.HTTP_201_CREATED)
def create_repository(payload: RepositoryCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exists = db.scalar(select(Repository).where(
        Repository.owner_id == user.id, Repository.slug == payload.slug, Repository.repo_type == payload.repo_type
    ))
    if exists:
        raise HTTPException(409, "Repository already exists")
    remote_name = f"{payload.repo_type.value}-{payload.slug}"
    remote = gitea.create_repository(user.username, remote_name, payload.visibility == Visibility.private, payload.description)
    repo = Repository(
        owner_id=user.id, name=payload.name, slug=payload.slug, repo_type=payload.repo_type,
        visibility=payload.visibility, description=payload.description, tags=",".join(payload.tags),
        license=payload.license, readme=payload.readme, gitea_owner=remote.owner,
        gitea_repo=remote.name, clone_url=remote.clone_url,
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    repo.owner = user
    return serialize(repo)


@router.get("/{repo_type}/{owner}/{slug}", response_model=RepositoryOut)
def get_repository(repo_type: RepoType, owner: str, slug: str, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    repo = db.scalar(select(Repository).join(Repository.owner).options(joinedload(Repository.owner)).where(
        Repository.repo_type == repo_type, User.username == owner.lower(), Repository.slug == slug
    ))
    if repo is None or (repo.visibility == Visibility.private and (user is None or repo.owner_id != user.id)):
        raise HTTPException(404, "Repository not found")
    return serialize(repo)


@router.patch("/{repo_type}/{owner}/{slug}", response_model=RepositoryOut)
def update_repository(repo_type: RepoType, owner: str, slug: str, payload: RepositoryUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = db.scalar(select(Repository).join(Repository.owner).options(joinedload(Repository.owner)).where(
        Repository.repo_type == repo_type, User.username == owner.lower(), Repository.slug == slug
    ))
    if repo is None or repo.owner_id != user.id:
        raise HTTPException(404, "Repository not found")
    values = payload.model_dump(exclude_unset=True)
    if "tags" in values:
        values["tags"] = ",".join(dict.fromkeys(tag.strip().lower() for tag in values["tags"] if tag.strip()))
    for key, value in values.items():
        setattr(repo, key, value)
    db.commit()
    db.refresh(repo)
    return serialize(repo)


@router.delete("/{repo_type}/{owner}/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repository(repo_type: RepoType, owner: str, slug: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = db.scalar(select(Repository).join(Repository.owner).where(
        Repository.repo_type == repo_type, User.username == owner.lower(), Repository.slug == slug
    ))
    if repo is None or repo.owner_id != user.id:
        raise HTTPException(404, "Repository not found")
    gitea.delete_repository(repo.gitea_owner, repo.gitea_repo)
    db.delete(repo)
    db.commit()

