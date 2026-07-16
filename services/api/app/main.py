import os
from datetime import date

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


class ModelSummary(BaseModel):
    id: int
    name: str
    author: str
    task: str
    summary: str
    tags: list[str]
    downloads: int
    likes: int
    updated_at: date


class HealthResponse(BaseModel):
    status: str
    database: str


MODELS = [
    ModelSummary(
        id=1,
        name="Qwen2.5-Chinese-Chat",
        author="open-lab",
        task="文本生成",
        summary="适合中文问答、摘要和内容生成的基础对话模型。",
        tags=["中文", "对话", "Transformers"],
        downloads=12_840,
        likes=326,
        updated_at=date(2026, 7, 15),
    ),
    ModelSummary(
        id=2,
        name="Vision-Document-Parser",
        author="data-team",
        task="图像转文字",
        summary="从扫描文档和截图中提取结构化文本。",
        tags=["OCR", "文档", "视觉"],
        downloads=8_210,
        likes=194,
        updated_at=date(2026, 7, 13),
    ),
    ModelSummary(
        id=3,
        name="Text-Embedding-Small",
        author="model-hub",
        task="特征提取",
        summary="用于语义搜索和知识库检索的轻量文本向量模型。",
        tags=["Embedding", "搜索", "轻量"],
        downloads=6_930,
        likes=158,
        updated_at=date(2026, 7, 10),
    ),
]

database_url = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://modelhub:modelhub@localhost:5432/modelhub",
)
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 2},
)

app = FastAPI(
    title="Model Hub API",
    version="0.1.0",
    description="模型和数据集托管平台的业务接口。",
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return HealthResponse(status="ok", database="connected")
    except SQLAlchemyError:
        return HealthResponse(status="degraded", database="unavailable")


@app.get("/api/v1/models", response_model=list[ModelSummary], tags=["models"])
def list_models(
    q: str | None = Query(default=None, max_length=100),
) -> list[ModelSummary]:
    if not q:
        return MODELS

    keyword = q.casefold().strip()
    if not keyword:
        return MODELS

    return [
        model
        for model in MODELS
        if keyword
        in " ".join(
            [model.name, model.author, model.task, model.summary, *model.tags]
        ).casefold()
    ]
