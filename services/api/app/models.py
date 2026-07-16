from datetime import UTC, date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ModelRepository(Base):
    __tablename__ = "models"
    __table_args__ = (UniqueConstraint("author", "name", name="uq_model_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    author: Mapped[str] = mapped_column(String(40), index=True)
    task: Mapped[str] = mapped_column(String(30), index=True)
    summary: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    downloads: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[date] = mapped_column(Date, default=date.today)
    files: Mapped[list["ModelFileRecord"]] = relationship(
        back_populates="model",
        cascade="all, delete-orphan",
    )


class ModelFileRecord(Base):
    __tablename__ = "model_files"
    __table_args__ = (UniqueConstraint("model_id", "name", name="uq_model_file_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(
        ForeignKey("models.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(512), unique=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    content_type: Mapped[str] = mapped_column(
        String(120),
        default="application/octet-stream",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    model: Mapped[ModelRepository] = relationship(back_populates="files")
