from sqlmodel import SQLModel, Session, create_engine
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=False)


def init_db() -> None:
    """Crea las tablas que no existan. Para produccion se recomienda usar
    una herramienta de migraciones (ej. Alembic) en vez de esta funcion,
    pero sirve para desarrollo/pruebas rapidas."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Dependencia de FastAPI: entrega una sesion de BD por request."""
    with Session(engine) as session:
        yield session
