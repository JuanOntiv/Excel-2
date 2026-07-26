from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(title="Finanzas API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # ver problema 2 para saber por qué es 3000
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # En produccion, usar Alembic (migraciones) en vez de create_all.
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
    return {"message": "Finanzas API running"}
