from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..gitea import gitea
from ..models import User
from ..schemas import LoginRequest, TokenOut, UserCreate, UserOut, UserUpdate
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(or_(User.username == payload.username, User.email == payload.email)))
    if existing:
        raise HTTPException(409, "Username or email already exists")
    username = payload.username.lower()
    email = payload.email.lower()
    gitea.ensure_user(username, email, payload.password, payload.display_name)
    user = User(
        username=username, email=email,
        password_hash=hash_password(payload.password), display_name=payload.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect username or password")
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    values = payload.model_dump(exclude_unset=True)
    if "display_name" in values:
        gitea.update_user(user.username, user.email, values["display_name"] or "")
    for key, value in values.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
