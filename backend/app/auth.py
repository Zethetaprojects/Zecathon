from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import (
    GlobalSettings,
    RateLimitEvent,
    User,
    UserRole,
    _default_role_permissions,
    effective_role_permissions,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except JWTError:
        return None


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    username = decode_access_token(token)
    if username is None:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def is_superadmin(user: User) -> bool:
    return user.role == UserRole.superadmin


def is_platform_admin(user: User) -> bool:
    """Admins and superadmins have platform-wide access to every hackathon."""
    return user.role in (UserRole.admin, UserRole.superadmin)


def get_global_settings(db: Session) -> GlobalSettings:
    settings_row = db.query(GlobalSettings).first()
    if not settings_row:
        settings_row = GlobalSettings(
            registration_open=True,
            role_permissions=_default_role_permissions(),
        )
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def get_role_permissions(db: Session) -> dict:
    """The full permission matrix, with defaults filled in for any missing feature."""
    return effective_role_permissions(get_global_settings(db).role_permissions)


def permissions_for_user(user: User, db: Session) -> dict:
    matrix = get_role_permissions(db)
    if user.role == UserRole.superadmin:
        # Superadmin always passes to avoid lockouts.
        return {f: True for f in matrix["superadmin"]}
    return matrix.get(user.role.value, {})


def has_permission(user: User, permission: str, db: Session) -> bool:
    """Check whether a user has a granular feature permission.

    Superadmin always passes; other roles are gated by the global
    `role_permissions` settings, falling back to defaults for unset features.
    """
    return bool(permissions_for_user(user, db).get(permission, False))


def require_permission(permission: str):
    def checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not has_permission(current_user, permission, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}",
            )
        return current_user

    return checker


# Role-based gates for routes that should not be affected by permission toggles.
def _require_role(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of the following roles: {', '.join(r.value for r in roles)}",
            )
        return current_user

    return checker


require_superadmin = _require_role(UserRole.superadmin)
require_admin = _require_role(UserRole.admin, UserRole.superadmin)


def registration_open(db: Session) -> bool:
    return bool(get_global_settings(db).registration_open)


class RateLimiter:
    """Sliding-window rate limiter backed by the database, so the limit is
    shared by every gunicorn worker instead of being multiplied by them."""

    def __init__(self, action: str, key_func, max_requests: int = 5, window_seconds: int = 300):
        self.action = action
        self.key_func = key_func
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def __call__(self, request: Request, db: Session = Depends(get_db)):
        key = self.key_func(request)
        cutoff = datetime.utcnow() - timedelta(seconds=self.window_seconds)
        query = db.query(RateLimitEvent).filter(
            RateLimitEvent.key == key,
            RateLimitEvent.action == self.action,
        )
        # Expire old attempts for this key so the table stays small.
        query.filter(RateLimitEvent.created_at < cutoff).delete(synchronize_session=False)
        recent = query.filter(RateLimitEvent.created_at >= cutoff).count()
        if recent >= self.max_requests:
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {self.action}. Please try again later.",
            )
        db.add(RateLimitEvent(key=key, action=self.action))
        db.commit()
        return True


def _client_ip(request: Request) -> str:
    # nginx sets X-Real-IP to the connecting address and overwrites anything the
    # client sent. X-Forwarded-For is not used: its first entry is client-controlled.
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"
