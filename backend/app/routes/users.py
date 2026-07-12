from datetime import datetime
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.users import User, UserCreate, UserUpdate, UserRead
from app.models.logs import LogAction, LogLevel
from app.utils.password import hash_password, verify_password
from app.auth.dependencies import get_current_user
from app.auth.dependencies_admin import get_current_admin
from app.utils.logs_decorator import log_action
from app.services.wallets import create_default_wallet

router = APIRouter(prefix="/users", tags=["Users"])


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="users")
def register_user(
    user_data: UserCreate,
    session: Session = Depends(get_session),
):
    existing_user = session.exec(select(User).where(User.mail == user_data.mail)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    db_user = User(
        name=user_data.name,
        mail=user_data.mail,
        password=hash_password(user_data.password),
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    # Toda cuenta arranca con una wallet default ("todos los movimientos").
    create_default_wallet(db_user.id, session)

    return db_user


@router.get("/me", response_model=UserRead)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Devuelve el perfil del usuario autenticado. No existe un GET /users/
    que liste todos los usuarios: cada usuario solo puede ver lo suyo."""
    return current_user


@router.patch("/me", response_model=UserRead)
@log_action(action=LogAction.UPDATE, table="users")
def update_my_profile(
    user_data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    update_data = user_data.model_dump(exclude_unset=True)

    # El password NO se cambia por aca: requiere verificar el actual, para
    # eso esta el endpoint dedicado POST /users/me/change-password.
    update_data.pop("password", None)

    # is_active no se puede auto-desactivar via update; para eso esta
    # el endpoint DELETE (soft delete) explicito.
    update_data.pop("is_active", None)

    for key, value in update_data.items():
        setattr(current_user, key, value)

    current_user.updated_at = datetime.now()
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
@log_action(action=LogAction.UPDATE, table="users")
def change_my_password(
    body: ChangePasswordRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Cambia el password del usuario autenticado. Exige el password actual
    y verifica que coincida antes de aplicar el nuevo."""
    if not verify_password(body.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if not body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be empty",
        )

    current_user.password = hash_password(body.new_password)
    current_user.updated_at = datetime.now()
    session.add(current_user)
    session.commit()
    return {"message": "Password updated successfully"}


@router.delete("/me", status_code=status.HTTP_200_OK)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="users")
def deactivate_my_account(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft delete: el usuario desactiva su propia cuenta."""
    current_user.is_active = False
    current_user.updated_at = datetime.now()
    session.add(current_user)
    session.commit()
    return {"message": "Account deactivated successfully"}


# =========================================================
# ENDPOINTS DE ADMIN
# Requieren is_admin=True (ver app/auth/dependencies_admin.py).
# No hay forma de auto-otorgarse este rol desde la API: se hace
# unicamente via app/scripts/seed_admin.py.
# =========================================================

@router.get("/", response_model=List[UserRead])
def list_all_users(
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin),
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
):
    query = select(User)
    if not include_inactive:
        query = query.where(User.is_active == True)
    return session.exec(query.offset(skip).limit(limit)).all()


@router.get("/{user_id}", response_model=UserRead)
def get_user_by_id_admin(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}/deactivate", status_code=status.HTTP_200_OK)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="users")
def deactivate_user_admin(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin),
):
    """Soft delete de la cuenta de cualquier usuario, ejecutado por un admin."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot deactivate another admin via this endpoint")

    user.is_active = False
    user.updated_at = datetime.now()
    session.add(user)
    session.commit()
    return {"message": "User deactivated successfully", "user_id": str(user_id)}


@router.delete("/{user_id}/hard", status_code=status.HTTP_200_OK)
@log_action(action=LogAction.DELETE, level=LogLevel.ERROR, table="users")
def hard_delete_user_admin(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_admin),
):
    """Borrado fisico e irreversible de un usuario y todos sus datos
    asociados. Se borra en cascada de forma explicita (en vez de
    depender de ON DELETE CASCADE en la BD) para que quede claro y
    controlado exactamente que se elimina. Usar con extremo cuidado."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot hard-delete another admin")

    from app.models.refresh_tokens import RefreshToken
    from app.models.logs import Log
    from app.models.transactions import Transaction
    from app.models.transactions_wallets import TransactionWallet
    from app.models.recurring_transactions import RecurringTransaction
    from app.models.wallet_rules import WalletRule
    from app.models.wallets import Wallet
    from app.models.categories import Category

    # Orden importante: primero las tablas "hoja" que referencian a
    # transacciones/wallets, luego transacciones/wallets/reglas, y por
    # ultimo el usuario. Logs y refresh_tokens no dependen de nada mas.
    user_transaction_ids = [
        t.id for t in session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
        ).all()
    ]
    if user_transaction_ids:
        for tw in session.exec(
            select(TransactionWallet).where(TransactionWallet.transaction_id.in_(user_transaction_ids))
        ).all():
            session.delete(tw)

    for model in (Transaction, RecurringTransaction, WalletRule, Wallet, Category):
        for row in session.exec(select(model).where(model.user_id == user_id)).all():
            session.delete(row)

    for token in session.exec(select(RefreshToken).where(RefreshToken.user_id == user_id)).all():
        session.delete(token)

    for log in session.exec(select(Log).where(Log.user_id == user_id)).all():
        session.delete(log)

    session.delete(user)
    session.commit()
    return {"message": "User permanently deleted", "user_id": str(user_id)}
