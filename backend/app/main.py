from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.db import init_db
from app.routes import (
    auth,
    users,
    categories,
    wallets,
    wallet_rules,
    transactions,
    transactions_wallets,
    recurring_transactions,
    logs,
    goals,
    notifications
)

# Swagger (/docs), ReDoc (/redoc) y el spec (/openapi.json) quedan solo en
# desarrollo. NO protegen ningun endpoint — todos exigen JWT igualmente, y
# desde /docs solo se puede hacer lo mismo que desde la app, autenticandose —
# pero /openapi.json publica el mapa completo de la API (rutas, campos,
# schemas, como funciona el auth) a cualquiera con la URL del servicio. En un
# despliegue publico no hay motivo para regalar ese reconocimiento.
_DOCS_ENABLED = not settings.IS_PRODUCTION

app = FastAPI(
    title="Finanzas API",
    version="1.0.0",
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
)

app.add_middleware(
    CORSMiddleware,
    # Fijos (dev local + dominio de produccion) y, ademas, los deploys de
    # preview de Vercel via regex — cada rama genera un subdominio nuevo.
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_origin_regex=settings.CORS_ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # En produccion el esquema lo gobierna Alembic; create_all solo cubre el
    # arranque en local. Ver RUN_CREATE_ALL_ON_STARTUP en core/config.py: sigue
    # activo por defecto, porque apagarlo donde el deploy no corre
    # `alembic upgrade head` dejaria la BD sin tablas.
    if settings.RUN_CREATE_ALL_ON_STARTUP:
        init_db()


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(wallets.router)
app.include_router(wallet_rules.router)
app.include_router(transactions.router)
app.include_router(transactions_wallets.router)
app.include_router(recurring_transactions.router)
app.include_router(logs.router)
app.include_router(goals.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    """Health check. Devuelve lo minimo a proposito: la raiz es lo primero que
    ve quien llega con la URL suelta, y no necesita saber que hay detras."""
    return {"status": "ok"}
