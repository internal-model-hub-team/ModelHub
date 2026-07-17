from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import RepoType, Visibility


class UserCreate(BaseModel):
    username: str = Field(pattern=r"^[a-zA-Z0-9_-]{3,40}$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=100)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=2000)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr
    display_name: str
    bio: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RepositoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(pattern=r"^[a-zA-Z0-9_.-]{1,100}$")
    repo_type: RepoType
    visibility: Visibility = Visibility.public
    description: str = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    license: str = Field(default="", max_length=100)
    readme: str = Field(default="", max_length=100_000)

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(tag.strip().lower() for tag in value if tag.strip()))


class RepositoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    visibility: Visibility | None = None
    description: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = Field(default=None, max_length=30)
    license: str | None = Field(default=None, max_length=100)
    readme: str | None = Field(default=None, max_length=100_000)


class OwnerSummary(BaseModel):
    username: str
    display_name: str


class RepositoryOut(BaseModel):
    id: int
    name: str
    slug: str
    repo_type: RepoType
    visibility: Visibility
    description: str
    tags: list[str]
    license: str
    readme: str
    clone_url: str
    download_count: int
    owner: OwnerSummary
    created_at: datetime
    updated_at: datetime


class PaginatedRepositories(BaseModel):
    items: list[RepositoryOut]
    total: int
    page: int
    page_size: int


class RepositoryFileOut(BaseModel):
    name: str
    path: str
    type: str
    size: int
    sha: str
    is_lfs: bool


class RepositoryFilesOut(BaseModel):
    path: str
    items: list[RepositoryFileOut]
    total: int


class ApiTokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ApiTokenCreated(BaseModel):
    id: int
    name: str
    token: str
    prefix: str
    created_at: datetime


class ApiTokenSummary(BaseModel):
    id: int
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None
