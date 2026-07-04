from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.transactions_wallets import TransactionWallet, TransactionWalletRead
from app.models.transactions import Transaction
from app.models.users import User
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/transaction-wallets", tags=["Transaction Wallets"])


# No hay POST/PATCH/DELETE publicos en esta ruta: las asignaciones a
# wallets se gestionan exclusivamente a traves del servicio interno
# (app/services/wallet_assignment.py), disparado desde los endpoints de
# transactions y wallet_rules. Aca solo se consulta el resultado.


@router.get("/by-transaction/{transaction_id}", response_model=List[TransactionWalletRead])
def get_wallets_for_transaction(
    transaction_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Devuelve en que wallets custom esta una transaccion (manual y/o
    por regla). No incluye el wallet default, que es implicito."""
    trx = session.get(Transaction, transaction_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Transaction not found")

    return session.exec(
        select(TransactionWallet).where(TransactionWallet.transaction_id == transaction_id)
    ).all()
