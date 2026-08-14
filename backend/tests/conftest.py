import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


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


@pytest.fixture
def auth_client(client, db):
    r = client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "testuser@example.com",
        "password": "secret123"
    })
    assert r.status_code == 201
    user = db.query(User).filter(User.username == "testuser").first()
    user.role = UserRole.organizer
    db.commit()
    r = client.post("/api/auth/login", data={"username": "testuser", "password": "secret123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
