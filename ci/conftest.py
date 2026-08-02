"""Configuracion compartida de pytest para la suite de CI.

Las pruebas corren contra una base de datos Postgres REAL (no SQLite): este
proyecto ya fue mordido por diferencias especificas de Postgres (tipos ENUM,
UUID), asi que probar sobre el mismo motor que produccion evita falsos verdes.

La URL de la BD se toma de la variable de entorno DATABASE_URL; si no existe se
usa una local por defecto. En GitHub Actions la provee el `services: postgres`
del workflow (.github/workflows/ci.yml).
"""
import os
import sys

# 1) El backend debe ser importable como paquete `app` sin instalar nada:
#    agregamos backend/ al path ANTES de importar cualquier modulo de la app.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_REPO_ROOT, "backend"))

# 2) Config leida en tiempo de import (app.core.config usa lru_cache), asi que
#    las variables de entorno deben quedar fijadas ANTES de importar la app.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/finanzas_test",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-not-for-prod")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "30")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import SQLModel, Session

# Importar el paquete de modelos registra TODAS las tablas en SQLModel.metadata
# (necesario para create_all y para resolver las relaciones por string).
import app.models  # noqa: F401,E402
from app.db.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.utils.password import hash_password  # noqa: E402
from app.routes.auth import login_rate_limiter  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    """Crea el esquema una vez para toda la sesion de tests y lo elimina al
    final. drop_all elimina tambien los tipos ENUM (a diferencia de un
    downgrade de Alembic), dejando la BD limpia."""
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    """Aisla cada test: vacia todas las tablas al terminar. TRUNCATE ...
    CASCADE es rapido y respeta las FKs; RESTART IDENTITY reinicia secuencias."""
    yield
    table_names = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """El limiter de login guarda estado en memoria del proceso (por cuenta).
    Como varios tests reutilizan los mismos correos, se limpia antes y despues
    de cada test para que no se filtren intentos entre casos."""
    login_rate_limiter.clear()
    yield
    login_rate_limiter.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


@pytest.fixture
def make_user():
    """Crea un usuario directamente en la BD (evita depender del endpoint de
    registro cuando queremos controlar is_admin/is_active). Devuelve un dict
    con la contrasena en claro para poder loguear despues."""
    def _make(
        mail="user@test.com",
        password="Password123",
        name="Test User",
        is_admin=False,
        is_active=True,
    ):
        with Session(engine) as session:
            user = User(
                name=name,
                mail=mail,
                password=hash_password(password),
                is_admin=is_admin,
                is_active=is_active,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return {
                "id": str(user.id),
                "mail": mail,
                "password": password,
                "name": name,
                "is_admin": is_admin,
            }

    return _make


@pytest.fixture
def login(client):
    """Devuelve headers de Authorization para un usuario. El login es
    form-encoded (OAuth2PasswordRequestForm): username = mail."""
    def _login(mail, password):
        resp = client.post(
            "/auth/login",
            data={"username": mail, "password": password},
        )
        assert resp.status_code == 200, resp.text
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    return _login


@pytest.fixture
def admin(make_user):
    return make_user(mail="admin@test.com", password="AdminPass123", name="Admin", is_admin=True)


@pytest.fixture
def admin_headers(admin, login):
    return login(admin["mail"], admin["password"])
