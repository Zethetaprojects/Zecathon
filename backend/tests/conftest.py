import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})


# pysqlite does not emit BEGIN itself, which breaks SAVEPOINT-based test
# isolation. Let SQLAlchemy control transactions (the documented recipe).
@event.listens_for(engine, "connect")
def _disable_pysqlite_transactions(dbapi_connection, _record):
    dbapi_connection.isolation_level = None


@event.listens_for(engine, "begin")
def _emit_begin(conn):
    conn.exec_driver_sql("BEGIN")


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# Rate-limit attempts are stored in the database, so the per-test transaction
# rollback in the `db` fixture resets them between tests.
@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    # Savepoint mode: a rollback inside an endpoint only undoes that endpoint's
    # work, like in production, instead of discarding the whole test transaction.
    session = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")()
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
