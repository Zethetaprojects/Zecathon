from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import (
    RateLimiter,
    _client_ip,
    create_access_token,
    get_current_active_user,
    get_current_user,
    get_password_hash,
    is_superadmin,
    require_admin,
    require_superadmin,
    verify_password,
)
from app.database import get_db
from app.models import User, UserRole
from app.schemas import (
    AdminPasswordUpdate,
    AdminUserCreate,
    Token,
    UserCreate,
    UserOut,
    UserRoleUpdate,
)

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    _: bool = Depends(RateLimiter("register", _client_ip, max_requests=5, window_seconds=600)),
):
    if db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first():
        raise HTTPException(status_code=400, detail="Username or email already registered")
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    _: bool = Depends(RateLimiter("login", _client_ip, max_requests=10, window_seconds=300)),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.get("/admin/users", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/admin/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.role == UserRole.superadmin and not is_superadmin(current_user):
        raise HTTPException(status_code=403, detail="Only superadmin can create superadmin users")
    if db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first():
        raise HTTPException(status_code=400, detail="Username or email already registered")
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/admin/users/{user_id}/password", response_model=UserOut)
async def admin_update_password(
    user_id: int,
    payload: AdminPasswordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and payload.role != user.role:
        if user.role == UserRole.superadmin:
            raise HTTPException(status_code=400, detail="You cannot demote yourself from superadmin")
        if user.role == UserRole.admin:
            raise HTTPException(status_code=400, detail="You cannot demote yourself from admin")

    if payload.role == UserRole.superadmin or user.role == UserRole.superadmin:
        if not is_superadmin(current_user):
            raise HTTPException(status_code=403, detail="Only superadmin can manage superadmin roles")

    if payload.role == UserRole.admin or user.role == UserRole.admin:
        if not is_superadmin(current_user):
            raise HTTPException(status_code=403, detail="Only superadmin can manage admin roles")

    if user.role == UserRole.admin and payload.role != UserRole.admin:
        if not is_superadmin(current_user):
            other_admin = db.query(User).filter(User.id != user.id, User.role == UserRole.admin).first()
            if not other_admin:
                raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.get("/admin/stats", response_model=dict)
async def admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    from app.models import Hackathon, Team, Submission, Evaluation
    users = db.query(User).count()
    return {
        "users": users,
        "users_by_role": {
            "superadmin": db.query(User).filter(User.role == UserRole.superadmin).count(),
            "admin": db.query(User).filter(User.role == UserRole.admin).count(),
            "organizer": db.query(User).filter(User.role == UserRole.organizer).count(),
            "judge": db.query(User).filter(User.role == UserRole.judge).count(),
            "participant": db.query(User).filter(User.role == UserRole.participant).count(),
        },
        "hackathons": db.query(Hackathon).count(),
        "teams": db.query(Team).count(),
        "submissions": db.query(Submission).count(),
        "evaluations": db.query(Evaluation).count(),
    }
