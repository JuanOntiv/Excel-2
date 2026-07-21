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
    # Tras LOGIN_MAX_ATTEMPTS fallos dentro de la ventana, se bloquean nuevos
    # intentos hasta que la ventana expire (protege contra fuerza bruta).
    LOGIN_MAX_ATTEMPTS: int = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
    LOGIN_ATTEMPT_WINDOW_SECONDS: int = int(os.getenv("LOGIN_ATTEMPT_WINDOW_SECONDS", "900"))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
