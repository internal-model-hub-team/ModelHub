from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ModelCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$",
    )
    author: str = Field(
        min_length=2,
        max_length=40,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$",
    )
    task: str = Field(min_length=2, max_length=30)
    summary: str = Field(min_length=5, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str]) -> list[str]:
        normalized: list[str] = []
        for raw_tag in tags:
            tag = raw_tag.strip()
            if not tag or tag in normalized:
                continue
            if len(tag) > 20:
                raise ValueError("每个标签最多 20 个字符")
            normalized.append(tag)
        return normalized


class ModelFileSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    size_bytes: int
    content_type: str
    created_at: datetime


class ModelSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    author: str
    task: str
    summary: str
    tags: list[str]
    downloads: int
    likes: int
    updated_at: date


class ModelDetail(ModelSummary):
    files: list[ModelFileSummary]


class HealthResponse(BaseModel):
    status: str
    database: str
