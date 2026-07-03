from fastapi import FastAPI
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
)

app = FastAPI(title="Finanzas API", version="1.0.0")


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


@app.get("/")
def root():
    return {"message": "Finanzas API running"}
