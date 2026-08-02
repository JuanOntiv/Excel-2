"""
Configuracion central de la aplicacion.
Lee todo desde variables de entorno, con valores por defecto solo para
desarrollo local (NUNCA usar estos defaults en produccion).
"""
import os
from functools import lru_cache


class Settings:
    # --- Base de datos ---
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@db:5432/finanzas_db"
    )

    # --- JWT ---
    # IMPORTANTE: en produccion, generar con `openssl rand -hex 32` y
    # cargarlo via variable de entorno, nunca hardcodear.
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
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
    return Settings()


settings = get_settings()
