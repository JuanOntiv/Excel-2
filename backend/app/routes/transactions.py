import csv
import io
from datetime import datetime, date
from uuid import UUID
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.transactions import Transaction, TransactionCreate, TransactionUpdate, TransactionRead, TransactionType
from app.models.users import User
from app.models.categories import Category, CategoryType
from app.models.wallets import Wallet
from app.models.logs import LogAction, LogLevel
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action
from app.services.wallet_assignment import assign_wallets_for_transaction
from app.services.wallets import get_default_wallet
from app.services.goals import evaluate_goal_completions

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _validate_category_for_transaction(category: Category, transaction_type, current_user: User) -> None:
    if not category or not category.is_active:
        raise HTTPException(404, "Category not found")
    if category.user_id is not None and category.user_id != current_user.id:
        raise HTTPException(403, "Category not yours")
    # Regla de negocio: la categoria solo puede usarse si su Type
    # coincide con el de la transaccion, o si es BOTH.
    if category.type != CategoryType.BOTH and category.type.value != transaction_type.value:
        raise HTTPException(
            400,
            f"Category type '{category.type.value}' does not match transaction type '{transaction_type.value}'",
        )


def _validate_wallet_ownership(wallet_id: UUID, current_user: User, session: Session) -> None:
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(404, "Wallet not found")


@router.post("/", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="transactions")
def create_transaction(
    trx_in: TransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    category = session.get(Category, trx_in.category_id)
    _validate_category_for_transaction(category, trx_in.type, current_user)

    if trx_in.wallet_id:
        _validate_wallet_ownership(trx_in.wallet_id, current_user, session)

    new_trx = Transaction(
        user_id=current_user.id,
        name=trx_in.name,
        description=trx_in.description,
        amount=trx_in.amount,
        type=trx_in.type,
        date=trx_in.date,
        category_id=trx_in.category_id,
    )
    session.add(new_trx)
    session.commit()
    session.refresh(new_trx)

    # Resuelve la asignacion manual (si vino wallet_id) + evalua las
    # wallet_rules activas del usuario contra esta transaccion nueva.
    assign_wallets_for_transaction(new_trx, session, manual_wallet_id=trx_in.wallet_id)

    # Tiempo real: ¿esta transaccion acaba de completar/rebasar alguna meta?
    evaluate_goal_completions(current_user.id, session)

    return new_trx


def _build_transaction_query(
    current_user: User,
    session: Session,
    type: Optional[TransactionType] = None,
    category_id: Optional[UUID] = None,
    wallet_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Filtro compartido por list_transactions y export_transactions. Si se
    pasa wallet_id, filtra SOLO las transacciones asociadas a ese wallet via
    Transaction_Wallets (manual o por regla). Sin wallet_id, devuelve todo
    (= comportamiento del wallet default, que es implicito)."""
    if wallet_id:
        _validate_wallet_ownership(wallet_id, current_user, session)
        from app.models.transactions_wallets import TransactionWallet
        query = (
            select(Transaction)
            .join(TransactionWallet, TransactionWallet.transaction_id == Transaction.id)
            .where(
                Transaction.user_id == current_user.id,
                Transaction.is_active == True,
                TransactionWallet.wallet_id == wallet_id,
            )
            .distinct()
        )
    else:
        query = select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.is_active == True,
        )

    if type:
        query = query.where(Transaction.type == type)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)

    return query


@router.get("/", response_model=List[TransactionRead])
def list_transactions(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    type: Optional[TransactionType] = None,
    category_id: Optional[UUID] = None,
    wallet_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = _build_transaction_query(current_user, session, type, category_id, wallet_id, start_date, end_date)
    return session.exec(query.offset(skip).limit(limit)).all()


@router.get("/export")
def export_transactions(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    format: Literal["csv", "xlsx"] = "csv",
    type: Optional[TransactionType] = None,
    category_id: Optional[UUID] = None,
    wallet_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Exporta las transacciones del usuario (mismos filtros que list_transactions,
    sin paginar) a CSV o XLSX."""
    query = _build_transaction_query(current_user, session, type, category_id, wallet_id, start_date, end_date)
    transactions = session.exec(query.order_by(Transaction.date.desc())).all()

    category_ids = {t.category_id for t in transactions}
    categories = session.exec(select(Category).where(Category.id.in_(category_ids))).all() if category_ids else []
    category_names = {c.id: c.name for c in categories}

    headers = ["Nombre", "Descripción", "Categoría", "Tipo", "Monto", "Fecha"]
    type_labels = {TransactionType.INCOME: "Ingreso", TransactionType.EXPENSE: "Egreso"}

    def rows():
        for t in transactions:
            yield [
                t.name,
                t.description or "",
                category_names.get(t.category_id, "—"),
                type_labels[t.type],
                float(t.amount),
                t.date.strftime("%Y-%m-%d"),
            ]

    filename_base = f"transacciones_{type.value if type else 'todas'}"

    if format == "csv":
        buffer = io.StringIO()
        buffer.write("﻿")  # BOM: para que Excel detecte UTF-8 correctamente
        writer = csv.writer(buffer)
        writer.writerow(headers)
        writer.writerows(rows())
        buffer.seek(0)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.csv"'},
        )

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Transacciones"
    sheet.append(headers)
    for row in rows():
        sheet.append(row)

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename_base}.xlsx"'},
    )


@router.get("/summary")
def get_transactions_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Resumen del dashboard: corresponde a la wallet default del usuario,
    que agrupa todos sus movimientos. El balance se calcula sumando las
    transacciones (income - expenses); la wallet default aporta la
    identidad/metadata estable que el frontend referencia."""
    query = select(Transaction).where(
        Transaction.user_id == current_user.id,
        Transaction.is_active == True,
    )
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)

    results = session.exec(query).all()

    total_income = sum(t.amount for t in results if t.type == TransactionType.INCOME)
    total_expenses = sum(t.amount for t in results if t.type == TransactionType.EXPENSE)

    default_wallet = get_default_wallet(current_user.id, session)

    return {
        "wallet_id": str(default_wallet.id) if default_wallet else None,
        "wallet_name": default_wallet.name if default_wallet else None,
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "balance": float(total_income - total_expenses),
        "count": len(results),
    }


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(
    transaction_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trx = session.get(Transaction, transaction_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Transaction not found")
    return trx


@router.patch("/{transaction_id}", response_model=TransactionRead)
@log_action(action=LogAction.UPDATE, table="transactions")
def update_transaction(
    transaction_id: UUID,
    trx_in: TransactionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trx = session.get(Transaction, transaction_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Transaction not found")

    update_data = trx_in.model_dump(exclude_unset=True)
    wallet_id_provided = "wallet_id" in update_data
    manual_wallet_id = update_data.pop("wallet_id", None)

    # Validar categoria si viene (usando el type final, ya sea el nuevo o el actual)
    final_type = update_data.get("type", trx.type)
    if "category_id" in update_data:
        category = session.get(Category, update_data["category_id"])
        _validate_category_for_transaction(category, final_type, current_user)

    if manual_wallet_id:
        _validate_wallet_ownership(manual_wallet_id, current_user, session)

    for key, value in update_data.items():
        setattr(trx, key, value)
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    session.refresh(trx)

    # Si la transaccion cambio (categoria, monto, fecha, tipo, nombre,
    # descripcion), hay que recalcular las asignaciones por regla.
    # La asignacion manual solo se actualiza si vino wallet_id explicito.
    assign_wallets_for_transaction(
        trx,
        session,
        manual_wallet_id=manual_wallet_id,
        update_manual=wallet_id_provided,
    )

    # Editar monto/fecha/categoria/tipo puede cruzar el umbral de una meta.
    evaluate_goal_completions(current_user.id, session)

    return trx


@router.delete("/{transaction_id}", status_code=200)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="transactions")
def deactivate_transaction(
    transaction_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trx = session.get(Transaction, transaction_id)
    if not trx or not trx.is_active or trx.user_id != current_user.id:
        raise HTTPException(404, "Transaction not found")
    trx.is_active = False
    trx.updated_at = datetime.now()
    session.add(trx)
    session.commit()
    return {"message": "Transaction deactivated", "name": trx.name}
