from datetime import datetime, date, timedelta
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.recurring_transactions import (
    RecurringTransaction,
    RecurringTransactionCreate,
    RecurringTransactionUpdate,
    RecurringTransactionRead,
    RecurringTransactionFrequency,
    RecurringTransactionStatus,
)
from app.models.transactions import Transaction
from app.models.users import User
from app.models.categories import Category, CategoryType
from app.models.wallets import Wallet
from app.models.logs import LogAction, LogLevel
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action
from app.services.wallet_assignment import assign_wallets_for_transaction

router = APIRouter(prefix="/recurring-transactions", tags=["Recurring Transactions"])


_FREQUENCY_TO_TIMEDELTA = {
    RecurringTransactionFrequency.DAILY: timedelta(days=1),
    RecurringTransactionFrequency.WEEKLY: timedelta(weeks=1),
    RecurringTransactionFrequency.BIWEEKLY: timedelta(weeks=2),
    RecurringTransactionFrequency.YEARLY: timedelta(days=365),
}


def _advance_date(current: date, frequency: RecurringTransactionFrequency) -> date:
    """Calcula la siguiente fecha de ejecucion segun la frecuencia.
    MONTHLY se maneja aparte porque los meses no tienen duracion fija
    (28-31 dias); se avanza por calendario, no por timedelta."""
    if frequency == RecurringTransactionFrequency.MONTHLY:
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        # Ajusta el dia si el mes destino tiene menos dias (ej. 31 -> 28/29)
        day = current.day
        while True:
            try:
                return date(year, month, day)
            except ValueError:
                day -= 1
    return current + _FREQUENCY_TO_TIMEDELTA[frequency]


def _validate_category_for_recurring(category: Category, recurring_type, current_user: User) -> None:
    if not category or not category.is_active:
        raise HTTPException(404, "Category not found")
    if category.user_id is not None and category.user_id != current_user.id:
        raise HTTPException(403, "Category not yours")
    if category.type != CategoryType.BOTH and category.type.value != recurring_type.value:
        raise HTTPException(
            400,
            f"Category type '{category.type.value}' does not match recurring transaction type '{recurring_type.value}'",
        )


@router.post("/", response_model=RecurringTransactionRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="recurring_transactions")
def create_recurring(
    trx_in: RecurringTransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    category = session.get(Category, trx_in.category_id)
    _validate_category_for_recurring(category, trx_in.type, current_user)

    if trx_in.wallet_id:
        wallet = session.get(Wallet, trx_in.wallet_id)
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found")

    new_recurring = RecurringTransaction(
        user_id=current_user.id,
        name=trx_in.name,
        description=trx_in.description,
        amount=trx_in.amount,
        type=trx_in.type,
        frequency=trx_in.frequency,
        start_date=trx_in.start_date,
        next_execution=trx_in.start_date,  # la primera ejecucion es en start_date
        auto_execute=trx_in.auto_execute,
        category_id=trx_in.category_id,
        status=RecurringTransactionStatus.ACTIVE,
    )
    session.add(new_recurring)
    session.commit()
    session.refresh(new_recurring)
    return new_recurring


@router.get("/", response_model=List[RecurringTransactionRead])
def list_recurring(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[RecurringTransactionStatus] = None,
):
    query = select(RecurringTransaction).where(
        RecurringTransaction.user_id == current_user.id,
        RecurringTransaction.is_active == True,
    )
    if status_filter:
        query = query.where(RecurringTransaction.status == status_filter)
    return session.exec(query.offset(skip).limit(limit)).all()


@router.get("/{trx_id}", response_model=RecurringTransactionRead)
def get_recurring(
    trx_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trx = session.get(RecurringTransaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")
    return trx


@router.patch("/{trx_id}", response_model=RecurringTransactionRead)
@log_action(action=LogAction.UPDATE, table="recurring_transactions")
def update_recurring(
    trx_id: UUID,
    trx_in: RecurringTransactionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trx = session.get(RecurringTransaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")

    update_data = trx_in.model_dump(exclude_unset=True)
    update_data.pop("wallet_id", None)  # se usa solo al ejecutar, no se persiste aqui

    if "category_id" in update_data:
        category = session.get(Category, update_data["category_id"])
        final_type = update_data.get("type", trx.type)
        _validate_category_for_recurring(category, final_type, current_user)

    for key, value in update_data.items():
        setattr(trx, key, value)
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    session.refresh(trx)
    return trx


@router.delete("/{trx_id}", status_code=200)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="recurring_transactions")
def cancel_recurring(
    trx_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Cancela la recurrencia (status=Cancelled), distinto del soft
    delete (is_active). Conserva el historial pero deja de ejecutarse."""
    trx = session.get(RecurringTransaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")

    trx.status = RecurringTransactionStatus.CANCELLED
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    return {"message": "Recurring transaction cancelled"}


@router.post("/{trx_id}/pause", response_model=RecurringTransactionRead)
@log_action(action=LogAction.UPDATE, table="recurring_transactions")
def pause_recurring(
    trx_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trx = session.get(RecurringTransaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")
    if trx.status == RecurringTransactionStatus.CANCELLED:
        raise HTTPException(400, "Cannot pause a cancelled recurring transaction")

    trx.status = RecurringTransactionStatus.PAUSED
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    session.refresh(trx)
    return trx


@router.post("/{trx_id}/resume", response_model=RecurringTransactionRead)
@log_action(action=LogAction.UPDATE, table="recurring_transactions")
def resume_recurring(
    trx_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trx = session.get(RecurringTransaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")
    if trx.status != RecurringTransactionStatus.PAUSED:
        raise HTTPException(400, "Recurring transaction is not paused")

    trx.status = RecurringTransactionStatus.ACTIVE
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    session.refresh(trx)
    return trx


def _execute_one(trx: RecurringTransaction, session: Session, wallet_id: Optional[UUID] = None) -> Transaction:
    """Genera la Transaction real a partir de una recurrencia, la pasa
    por el servicio de asignacion de wallets, y avanza next_execution."""
    new_trx = Transaction(
        user_id=trx.user_id,
        name=trx.name,
        description=trx.description,
        amount=trx.amount,
        type=trx.type,
        date=trx.next_execution,
        category_id=trx.category_id,
    )
    session.add(new_trx)
    session.commit()
    session.refresh(new_trx)

    assign_wallets_for_transaction(new_trx, session, manual_wallet_id=wallet_id)

    trx.last_executed = trx.next_execution
    trx.next_execution = _advance_date(trx.next_execution, trx.frequency)
    session.add(trx)
    session.commit()

    return new_trx


@router.post("/{trx_id}/execute", response_model=RecurringTransactionRead)
@log_action(action=LogAction.CREATE, table="transactions")
def execute_recurring_now(
    trx_id: UUID,
    wallet_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Ejecuta manualmente una recurrencia (sin importar next_execution).
    Util tanto para Auto_Execute=False (el usuario confirma a mano) como
    para forzar una ejecucion fuera de calendario."""
    trx = session.get(RecurringTransaction, trx_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Recurring transaction not found")
    if trx.status != RecurringTransactionStatus.ACTIVE:
        raise HTTPException(400, "Recurring transaction is not active")

    if wallet_id:
        wallet = session.get(Wallet, wallet_id)
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found")

    _execute_one(trx, session, wallet_id)
    session.refresh(trx)
    return trx


@router.post("/execute-pending", status_code=200)
@log_action(action=LogAction.CREATE, table="transactions")
def execute_pending(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Busca las recurrencias activas del usuario con next_execution <= hoy
    y Auto_Execute=True, genera sus transacciones, y avanza next_execution.
    Las que tienen Auto_Execute=False quedan pendientes de confirmacion
    manual via POST /{trx_id}/execute.

    Pensado para ser llamado por un scheduler (cron job) o, en su
    defecto, al loguearse el usuario.
    """
    today = date.today()
    pending = session.exec(
        select(RecurringTransaction).where(
            RecurringTransaction.user_id == current_user.id,
            RecurringTransaction.is_active == True,
            RecurringTransaction.status == RecurringTransactionStatus.ACTIVE,
            RecurringTransaction.auto_execute == True,
            RecurringTransaction.next_execution <= today,
        )
    ).all()

    created_count = 0
    errors = []

    for trx in pending:
        try:
            _execute_one(trx, session)
            created_count += 1
        except Exception as e:
            errors.append({"id": str(trx.id), "error": str(e)})

    return {
        "message": f"Executed {created_count} pending recurring transactions",
        "errors": errors if errors else None,
    }


@router.get("/pending-confirmation/list", response_model=List[RecurringTransactionRead])
def list_pending_confirmation(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Recurrencias con Auto_Execute=False cuya next_execution ya llego,
    esperando que el usuario las confirme manualmente."""
    today = date.today()
    return session.exec(
        select(RecurringTransaction).where(
            RecurringTransaction.user_id == current_user.id,
            RecurringTransaction.is_active == True,
            RecurringTransaction.status == RecurringTransactionStatus.ACTIVE,
            RecurringTransaction.auto_execute == False,
            RecurringTransaction.next_execution <= today,
        )
    ).all()
