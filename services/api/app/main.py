import os
from collections.abc import Generator
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import Engine, func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload, sessionmaker

from app.database import Base, create_database_engine, create_session_factory
from app.models import ModelFileRecord, ModelRepository
from app.schemas import (
    HealthResponse,
    ModelCreate,
    ModelDetail,
    ModelFileSummary,
    ModelSummary,
)

UPLOAD_CHUNK_SIZE = 1024 * 1024
DEFAULT_MAX_UPLOAD_BYTES = 500 * 1024 * 1024
ALLOWED_FILE_SUFFIXES = {
    ".bin",
    ".csv",
    ".gguf",
    ".gz",
    ".json",
    ".md",
    ".onnx",
    ".pt",
    ".pth",
    ".py",
    ".safetensors",
    ".tar",
    ".txt",
    ".yaml",
    ".yml",
    ".zip",
}

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


def validate_upload_name(filename: str | None) -> str:
    if not filename:
        raise HTTPException(status_code=422, detail="请选择需要上传的文件")
    if len(filename) > 255 or filename in {".", ".."}:
        raise HTTPException(status_code=422, detail="文件名不符合要求")
    if "/" in filename or "\\" in filename or "\x00" in filename:
        raise HTTPException(status_code=422, detail="文件名不能包含路径")
    if Path(filename).suffix.casefold() not in ALLOWED_FILE_SUFFIXES:
        allowed = "、".join(sorted(ALLOWED_FILE_SUFFIXES))
        raise HTTPException(status_code=422, detail=f"仅支持这些文件格式：{allowed}")
    return filename


def create_app(
    database_url: str | None = None,
    storage_root: str | None = None,
    max_upload_bytes: int | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = create_database_engine(database_url)
        session_factory = create_session_factory(engine)
        resolved_storage_root = Path(
            storage_root or os.getenv("MODEL_STORAGE_ROOT", "./storage")
        ).resolve()
        resolved_storage_root.mkdir(parents=True, exist_ok=True)
        Base.metadata.create_all(engine)
        seed_models(session_factory)
        app.state.engine = engine
        app.state.session_factory = session_factory
        app.state.storage_root = resolved_storage_root
        app.state.max_upload_bytes = max_upload_bytes or int(
            os.getenv("MAX_MODEL_FILE_SIZE_BYTES", str(DEFAULT_MAX_UPLOAD_BYTES))
        )
        yield
        engine.dispose()

    app = FastAPI(
        title="Model Hub API",
        version="0.3.0",
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

    def find_model(
        session: Session,
        author: str,
        name: str,
        *,
        include_files: bool = False,
    ) -> ModelRepository:
        statement = select(ModelRepository).where(
            ModelRepository.author == author,
            ModelRepository.name == name,
        )
        if include_files:
            statement = statement.options(selectinload(ModelRepository.files))
        model = session.scalar(statement)
        if not model:
            raise HTTPException(status_code=404, detail="没有找到这个模型")
        return model

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

    @app.get(
        "/api/v1/models/{author}/{name}",
        response_model=ModelDetail,
        tags=["models"],
    )
    def get_model(
        author: str,
        name: str,
        session: Session = Depends(get_session),
    ) -> ModelRepository:
        return find_model(session, author, name, include_files=True)

    @app.post(
        "/api/v1/models/{author}/{name}/files",
        response_model=ModelFileSummary,
        status_code=status.HTTP_201_CREATED,
        tags=["files"],
    )
    def upload_model_file(
        request: Request,
        author: str,
        name: str,
        file: UploadFile = File(...),
        session: Session = Depends(get_session),
    ) -> ModelFileRecord:
        model = find_model(session, author, name)
        filename = validate_upload_name(file.filename)
        existing = session.scalar(
            select(ModelFileRecord).where(
                ModelFileRecord.model_id == model.id,
                ModelFileRecord.name == filename,
            )
        )
        if existing:
            raise HTTPException(status_code=409, detail="已经存在同名文件")

        storage_root: Path = request.app.state.storage_root
        max_bytes: int = request.app.state.max_upload_bytes
        model_directory = storage_root / model.author / model.name
        model_directory.mkdir(parents=True, exist_ok=True)
        storage_name = f"{uuid4().hex}{Path(filename).suffix.casefold()}"
        final_path = model_directory / storage_name
        temporary_path = model_directory / f".{storage_name}.upload"
        size_bytes = 0

        try:
            with temporary_path.open("wb") as destination:
                while chunk := file.file.read(UPLOAD_CHUNK_SIZE):
                    size_bytes += len(chunk)
                    if size_bytes > max_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail=f"文件不能超过 {max_bytes // (1024 * 1024)}MB",
                        )
                    destination.write(chunk)
            if size_bytes == 0:
                raise HTTPException(status_code=422, detail="不能上传空文件")
            temporary_path.replace(final_path)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            final_path.unlink(missing_ok=True)
            raise

        record = ModelFileRecord(
            model_id=model.id,
            name=filename,
            storage_path=final_path.relative_to(storage_root).as_posix(),
            size_bytes=size_bytes,
            content_type=file.content_type or "application/octet-stream",
        )
        model.updated_at = date.today()
        session.add(record)
        try:
            session.commit()
        except IntegrityError as error:
            session.rollback()
            final_path.unlink(missing_ok=True)
            raise HTTPException(status_code=409, detail="已经存在同名文件") from error
        session.refresh(record)
        return record

    @app.get(
        "/api/v1/models/{author}/{name}/files/{filename}",
        response_class=FileResponse,
        tags=["files"],
    )
    def download_model_file(
        request: Request,
        author: str,
        name: str,
        filename: str,
        session: Session = Depends(get_session),
    ) -> FileResponse:
        model = find_model(session, author, name)
        record = session.scalar(
            select(ModelFileRecord).where(
                ModelFileRecord.model_id == model.id,
                ModelFileRecord.name == filename,
            )
        )
        if not record:
            raise HTTPException(status_code=404, detail="没有找到这个文件")

        storage_root: Path = request.app.state.storage_root
        stored_file = (storage_root / record.storage_path).resolve()
        try:
            stored_file.relative_to(storage_root)
        except ValueError as error:
            raise HTTPException(status_code=404, detail="文件存储路径无效") from error
        if not stored_file.is_file():
            raise HTTPException(status_code=404, detail="文件已经不存在")

        model.downloads += 1
        session.commit()
        return FileResponse(
            stored_file,
            media_type=record.content_type,
            filename=record.name,
        )

    return app


app = create_app()
