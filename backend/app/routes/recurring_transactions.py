# app/routes/recurring_transactions.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime, timedelta
from typing import List, Optional

from app.db.db import get_session
from app.models.transactions import (
    Transaction, TransactionCreate, TransactionUpdate, TransactionRead, TransactionType
)
from app.models.income import Income
from app.models.egress import Egress
from app.models.users import User
from app.models.wallets import Wallet
from app.models.categories import Category
from app.auth import get_current_user
from app.utils.logs_decorator import log_action

router = APIRouter(prefix="/recurring", tags=["Recurring Transactions"])

# ============ CREATE ============
@router.post("/", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
@log_action(action="CREATE", entity="RecurringTransaction", level="INFO")
def create_recurring(
    trx_in: TransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Validar que el user_id enviado sea el mismo que el autenticado
    if trx_in.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Cannot create recurring transaction for another user"
        )

    # Validar categoría (pública o del usuario)
    category = session.get(Category, trx_in.category_id)
    if not category or not category.is_active:
        raise HTTPException(404, "Category not found")
    if category.user_id is not None and category.user_id != current_user.id:
        raise HTTPException(403, "Category does not belong to you")

    # Validar wallet (si se envía)
    if trx_in.wallet_id:
        wallet = session.get(Wallet, trx_in.wallet_id)
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found or not yours")

    trx_dict = trx_in.model_dump()
    trx_dict["user_id"] = current_user.id
    # next_execution se inicializa con start_date (o ahora si no se envía)
    next_exec = trx_dict.get("start_date", datetime.now())
    trx_dict["next_execution"] = next_exec

    new_trx = Transaction(
        **trx_dict,
        is_active=True
    )
    session.add(new_trx)
    session.commit()
    session.refresh(new_trx)
    return new_trx

# ============ LIST ============
@router.get("/", response_model=List[TransactionRead])
def list_recurring(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    transactions = session.exec(
        select(Transaction)
        .where(Transaction.user_id == current_user.id, Transaction.is_active == True)
        .offset(skip)
        .limit(limit)
    ).all()
    return transactions

# ============ GET ONE ============
@router.get("/{trx_id}", response_model=TransactionRead)
def get_recurring(
    trx_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    trx = session.get(Transaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")
    return trx

# ============ UPDATE (PATCH) ============
@router.patch("/{trx_id}", response_model=TransactionRead)
@log_action(action="UPDATE", entity="RecurringTransaction", level="INFO")
def update_recurring(
    trx_id: UUID,
    trx_in: TransactionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    trx = session.get(Transaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")

    update_data = trx_in.model_dump(exclude_unset=True)

    # No permitir cambiar user_id
    if "user_id" in update_data and update_data["user_id"] != current_user.id:
        raise HTTPException(403, "Cannot change user_id")
    update_data.pop("user_id", None)

    # Validar categoría si viene
    if "category_id" in update_data and update_data["category_id"]:
        category = session.get(Category, update_data["category_id"])
        if not category or not category.is_active:
            raise HTTPException(404, "Category not found")
        if category.user_id is not None and category.user_id != current_user.id:
            raise HTTPException(403, "Category not yours")

    # Validar wallet si viene
    if "wallet_id" in update_data and update_data["wallet_id"]:
        wallet = session.get(Wallet, update_data["wallet_id"])
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found")

    # Si se actualiza start_date, también actualizar next_execution?
    # Depende de la lógica de negocio. Aquí no lo hacemos automáticamente.
    # El usuario puede actualizar next_execution explícitamente si lo desea.

    for key, value in update_data.items():
        setattr(trx, key, value)
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    session.refresh(trx)
    return trx

# ============ SOFT DELETE ============
@router.delete("/{trx_id}", status_code=200)
@log_action(action="SOFT_DELETE", entity="RecurringTransaction", level="WARNING")
def deactivate_recurring(
    trx_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    trx = session.get(Transaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")
    trx.is_active = False
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    return {"message": "Recurring transaction deactivated"}

# ============ EJECUTAR TRANSACCIONES PENDIENTES ============
@router.post("/execute-pending", status_code=200)
@log_action(action="EXECUTE_PENDING", entity="RecurringTransaction", level="INFO")
def execute_pending(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Busca todas las transacciones recurrentes activas del usuario cuya next_execution <= ahora.
    Crea el ingreso o egreso correspondiente y actualiza la próxima ejecución.
    """
    now = datetime.now()
    pending = session.exec(
        select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.is_active == True,
            Transaction.next_execution <= now
        )
    ).all()

    created_count = 0
    errors = []

    for trx in pending:
        try:
            # Crear el ingreso o egreso
            if trx.type == TransactionType.INCOME:
                new_income = Income(
                    user_id=current_user.id,
                    name=trx.name,
                    description=trx.description,
                    amount=trx.amount,
                    date=now,
                    category_id=trx.category_id,
                    wallet_id=trx.wallet_id,
                    is_active=True
                )
                session.add(new_income)
            else:  # EGRESS
                new_egress = Egress(
                    user_id=current_user.id,
                    name=trx.name,
                    description=trx.description,
                    amount=trx.amount,
                    date=now,
                    category_id=trx.category_id,
                    wallet_id=trx.wallet_id,
                    is_active=True
                )
                session.add(new_egress)

            # Actualizar next_execution sumando la frecuencia en días
            trx.next_execution = trx.next_execution + timedelta(days=trx.frecuency)
            session.add(trx)
            created_count += 1
        except Exception as e:
            errors.append({"id": str(trx.id), "error": str(e)})

    # Commit al final (si algo falla, se revierte todo en caso de error, pero aquí manejamos excepciones)
    session.commit()

    return {
        "message": f"Executed {created_count} pending recurring transactions",
        "errors": errors if errors else None
    }
