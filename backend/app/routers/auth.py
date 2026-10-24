from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import (
    RateLimiter,
    _client_ip,
    create_access_token,
    get_current_active_user,
    get_global_settings,
    get_password_hash,
    get_role_permissions,
    is_superadmin,
    permissions_for_user,
    registration_open,
    require_permission,
    require_superadmin,
    verify_password,
)
from app.database import get_db
from app.models import User, UserRole, effective_role_permissions
from app.schemas import (
    AdminPasswordUpdate,
    AdminUserCreate,
    GlobalSettingsOut,
    GlobalSettingsUpdate,
    MyPermissionsOut,
    Token,
    UserCreate,
    UserOut,
    UserRoleUpdate,
)

router = APIRouter()

# Rate limits. Many legitimate users can share one IP (a campus Wi-Fi NAT, or
# Cloudflare if real-IP restoration is missing), so per-IP limits are generous
# and the strict limit is per account: 10 login attempts per username per IP in 5 minutes.
REGISTER_PER_IP = RateLimiter("register", _client_ip, max_requests=30, window_seconds=600)
LOGIN_PER_IP = RateLimiter("login", _client_ip, max_requests=100, window_seconds=300)
LOGIN_PER_ACCOUNT = RateLimiter("login-account", _client_ip, max_requests=10, window_seconds=300)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    _: bool = Depends(REGISTER_PER_IP),
):
    if not registration_open(db):
        raise HTTPException(status_code=403, detail="New registrations are currently closed")
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
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    _: bool = Depends(LOGIN_PER_IP),
):
    LOGIN_PER_ACCOUNT.hit(db, f"{_client_ip(request)}|{form_data.username.strip().lower()}")
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")
    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.get("/me/permissions", response_model=MyPermissionsOut)
def my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Effective feature toggles for the current user, used by the frontend to show or hide actions."""
    return MyPermissionsOut(role=current_user.role, permissions=permissions_for_user(current_user, db))


@router.get("/admin/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("manage_users")),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/admin/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    if payload.role in (UserRole.superadmin, UserRole.admin) and not is_superadmin(current_user):
        raise HTTPException(status_code=403, detail="Only superadmin can create admin or superadmin users")
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
def admin_update_password(
    user_id: int,
    payload: AdminPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role in (UserRole.superadmin, UserRole.admin) and not is_superadmin(current_user) and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Only superadmin can reset admin or superadmin passwords")
    user.hashed_password = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
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
def admin_stats(
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


@router.get("/admin/settings", response_model=GlobalSettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    gs = get_global_settings(db)
    return GlobalSettingsOut(
        registration_open=gs.registration_open,
        role_permissions=get_role_permissions(db),
    )


@router.put("/admin/settings", response_model=GlobalSettingsOut)
def update_settings(
    payload: GlobalSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    gs = get_global_settings(db)
    if payload.registration_open is not None:
        gs.registration_open = payload.registration_open
    if payload.role_permissions is not None:
        updated = effective_role_permissions(payload.role_permissions.model_dump())
        # Superadmin always keeps every feature, so it cannot be locked out.
        updated["superadmin"] = {f: True for f in updated["superadmin"]}
        gs.role_permissions = updated
    db.commit()
    db.refresh(gs)
    return GlobalSettingsOut(
        registration_open=gs.registration_open,
        role_permissions=get_role_permissions(db),
    )
