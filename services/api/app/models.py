from datetime import date

from sqlalchemy import JSON, Date, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

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
