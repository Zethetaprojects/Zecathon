import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth import RateLimiter
from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    RateLimiter._windows.clear()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    RateLimiter._windows.clear()
    yield


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _make_authenticated_client(db, username: str, email: str, role: UserRole = None):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    c = TestClient(app)
    r = c.post("/api/auth/register", json={
        "username": username,
        "email": email,
        "password": "Secret123!"
    })
    assert r.status_code == 201, r.text
    if role:
        user = db.query(User).filter(User.username == username).first()
        user.role = role
        db.commit()
    r = c.post("/api/auth/login", data={"username": username, "password": "Secret123!"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    c.headers["Authorization"] = f"Bearer {token}"
    return c


@pytest.fixture
def participant_client(db):
    c = _make_authenticated_client(db, "participant", "participant@example.com")
    try:
        yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def auth_client(db):
    c = _make_authenticated_client(db, "testuser", "testuser@example.com", UserRole.organizer)
    try:
        yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def admin_client(db):
    c = _make_authenticated_client(db, "adminuser", "admin@example.com", UserRole.admin)
    try:
        yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def superadmin_client(db):
    c = _make_authenticated_client(db, "superadminuser", "superadmin@example.com", UserRole.superadmin)
    try:
        yield c
    finally:
        app.dependency_overrides.clear()
