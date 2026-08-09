"""
Configuracion central de la aplicacion.
Lee todo desde variables de entorno, con valores por defecto solo para
desarrollo local (NUNCA usar estos defaults en produccion).
"""
import os
from functools import lru_cache


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    # --- Entorno ---
    # "development" | "production". Solo decide que se expone de mas en local
    # (Swagger); no cambia ninguna regla de negocio ni de autorizacion.
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    IS_PRODUCTION: bool = ENVIRONMENT.strip().lower() == "production"

    # --- Base de datos ---
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@db:5432/finanzas_db"
    )

    # create_all() al arrancar es comodo en local, pero el esquema lo gobierna
    # Alembic: en un despliegue es una escritura de esquema en cada boot. Se
    # deja ACTIVO por defecto a proposito — apagarlo en un entorno donde el
    # arranque no corre `alembic upgrade head` dejaria la BD sin tablas. Poner
    # a "false" solo tras confirmar que las migraciones corren en el deploy.
    RUN_CREATE_ALL_ON_STARTUP: bool = _env_flag("RUN_CREATE_ALL_ON_STARTUP", True)

    # --- JWT ---
    # Sin valor por defecto A PROPOSITO: es la clave con la que se firman los
    # access tokens, asi que un default en el repo equivale a publicarla —
    # cualquiera podria fabricar un token valido para el user_id que quisiera.
    # Si falta, la app no arranca (ver get_settings) en vez de arrancar
    # insegura en silencio. Generar con `openssl rand -hex 32`.
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # --- Rate limiting de login ---
    # El bloqueo es POR CUENTA (el correo introducido), no por IP: detras de un
    # proxy todas las peticiones llegan con la misma IP y el bloqueo acabaria
    # siendo global. Tras LOGIN_MAX_ATTEMPTS fallos seguidos sobre la misma
    # cuenta se bloquea, con castigo progresivo segun LOGIN_LOCKOUT_LADDER:
    # 1 min el primer bloqueo, 5 min el segundo, 15 min del tercero en
    # adelante. Sin fallos durante LOGIN_STRIKE_DECAY_SECONDS se olvida todo.
    LOGIN_MAX_ATTEMPTS: int = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
    LOGIN_LOCKOUT_LADDER_SECONDS: tuple[int, ...] = tuple(
        int(x) for x in os.getenv("LOGIN_LOCKOUT_LADDER_SECONDS", "60,300,900").split(",") if x.strip()
    )
    LOGIN_STRIKE_DECAY_SECONDS: int = int(os.getenv("LOGIN_STRIKE_DECAY_SECONDS", "3600"))

    # --- CORS ---
    # Origenes permitidos para el frontend, como lista separada por comas.
    # Se lee de entorno para no tener que tocar codigo cada vez que cambia un
    # dominio (en Render se define como variable del servicio).
    CORS_ALLOWED_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:3000,https://excel-2-xypy.vercel.app",
        ).split(",")
        if o.strip()
    ]
    # Los deploys de preview de Vercel usan un subdominio distinto por rama y
    # por commit, asi que no se pueden enumerar. Se acotan con un regex ligado
    # al nombre del proyecto: NO usar `.*\.vercel\.app` (abriria la API a
    # cualquier sitio alojado en Vercel).
    CORS_ALLOWED_ORIGIN_REGEX: str = os.getenv(
        "CORS_ALLOWED_ORIGIN_REGEX",
        r"^https://excel-2-[a-z0-9-]+\.vercel\.app$",
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()

    # Fallar al arrancar, no en la primera peticion: un backend en pie que
    # firma tokens con una clave conocida es peor que un backend caido.
    if not settings.JWT_SECRET_KEY.strip():
        raise RuntimeError(
            "JWT_SECRET_KEY no esta definida. Es la clave con la que se firman "
            "los access tokens. Genera una con `openssl rand -hex 32` y cargala "
            "como variable de entorno (en local va en el .env; en Render, en la "
            "seccion Environment del servicio)."
        )

    return settings


settings = get_settings()
