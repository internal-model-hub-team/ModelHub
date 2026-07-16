import os
from collections.abc import Generator
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine, func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, create_database_engine, create_session_factory
from app.models import ModelRepository
from app.schemas import HealthResponse, ModelCreate, ModelSummary

SEED_MODELS = [
    {
        "name": "Qwen2.5-Chinese-Chat",
        "author": "open-lab",
        "task": "文本生成",
        "summary": "适合中文问答、摘要和内容生成的基础对话模型。",
        "tags": ["中文", "对话", "Transformers"],
        "downloads": 12_840,
        "likes": 326,
        "updated_at": date(2026, 7, 15),
    },
    {
        "name": "Vision-Document-Parser",
        "author": "data-team",
        "task": "图像转文字",
        "summary": "从扫描文档和截图中提取结构化文本。",
        "tags": ["OCR", "文档", "视觉"],
        "downloads": 8_210,
        "likes": 194,
        "updated_at": date(2026, 7, 13),
    },
    {
        "name": "Text-Embedding-Small",
        "author": "model-hub",
        "task": "特征提取",
        "summary": "用于语义搜索和知识库检索的轻量文本向量模型。",
        "tags": ["Embedding", "搜索", "轻量"],
        "downloads": 6_930,
        "likes": 158,
        "updated_at": date(2026, 7, 10),
    },
]


def seed_models(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as session:
        model_count = session.scalar(select(func.count()).select_from(ModelRepository))
        if model_count:
            return
        session.add_all(ModelRepository(**model) for model in SEED_MODELS)
        session.commit()


def create_app(database_url: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = create_database_engine(database_url)
        session_factory = create_session_factory(engine)
        Base.metadata.create_all(engine)
        seed_models(session_factory)
        app.state.engine = engine
        app.state.session_factory = session_factory
        yield
        engine.dispose()

    app = FastAPI(
        title="Model Hub API",
        version="0.2.0",
        description="模型和数据集托管平台的业务接口。",
        lifespan=lifespan,
    )

    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in cors_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_session(request: Request) -> Generator[Session]:
        session_factory: sessionmaker[Session] = request.app.state.session_factory
        with session_factory() as session:
            yield session

    @app.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
    def health(request: Request) -> HealthResponse:
        engine: Engine = request.app.state.engine
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return HealthResponse(status="ok", database="connected")
        except SQLAlchemyError:
            return HealthResponse(status="degraded", database="unavailable")

    @app.get(
        "/api/v1/models",
        response_model=list[ModelSummary],
        tags=["models"],
    )
    def list_models(
        q: str | None = Query(default=None, max_length=100),
        session: Session = Depends(get_session),
    ) -> list[ModelRepository]:
        models = list(
            session.scalars(
                select(ModelRepository).order_by(
                    ModelRepository.updated_at.desc(),
                    ModelRepository.id.desc(),
                )
            )
        )
        if not q or not q.strip():
            return models

        keyword = q.casefold().strip()
        return [
            model
            for model in models
            if keyword
            in " ".join(
                [model.name, model.author, model.task, model.summary, *model.tags]
            ).casefold()
        ]

    @app.post(
        "/api/v1/models",
        response_model=ModelSummary,
        status_code=status.HTTP_201_CREATED,
        tags=["models"],
    )
    def create_model(
        payload: ModelCreate,
        session: Session = Depends(get_session),
    ) -> ModelRepository:
        existing = session.scalar(
            select(ModelRepository).where(
                ModelRepository.author == payload.author,
                ModelRepository.name == payload.name,
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="这个作者名下已经存在同名模型",
            )

        model = ModelRepository(**payload.model_dump(), updated_at=date.today())
        session.add(model)
        try:
            session.commit()
        except IntegrityError as error:
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="这个作者名下已经存在同名模型",
            ) from error
        session.refresh(model)
        return model

    return app


app = create_app()
