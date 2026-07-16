from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ApiToken, User
from ..schemas import ApiTokenCreate, ApiTokenCreated, ApiTokenSummary
from ..security import get_current_user, hash_api_token, new_api_token

router = APIRouter(prefix="/tokens", tags=["API tokens"])


@router.get("", response_model=list[ApiTokenSummary])
def list_tokens(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(ApiToken).where(ApiToken.owner_id == user.id).order_by(ApiToken.created_at.desc())).all()


@router.post("", response_model=ApiTokenCreated, status_code=status.HTTP_201_CREATED)
def create_token(payload: ApiTokenCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    raw = new_api_token()
    record = ApiToken(owner_id=user.id, name=payload.name, prefix=raw[:12], token_hash=hash_api_token(raw))
    db.add(record)
    db.commit()
    db.refresh(record)
    return ApiTokenCreated(id=record.id, name=record.name, token=raw, prefix=record.prefix, created_at=record.created_at)


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_token(token_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.get(ApiToken, token_id)
    if record is None or record.owner_id != user.id:
        raise HTTPException(404, "Token not found")
    db.delete(record)
    db.commit()
