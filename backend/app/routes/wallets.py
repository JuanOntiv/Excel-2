from datetime import datetime
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.wallets import Wallet, WalletCreate, WalletUpdate, WalletRead
from app.models.users import User
from app.models.logs import LogAction, LogLevel
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action

router = APIRouter(prefix="/wallets", tags=["Wallets"])


@router.post("/", response_model=WalletRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="wallets")
def create_wallet(
    wallet_in: WalletCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Las wallets creadas por el usuario nunca son default: la default es
    # unica y se crea automaticamente al registrarse (ver services/wallets.py).
    new_wallet = Wallet(
        user_id=current_user.id,
        name=wallet_in.name,
        description=wallet_in.description,
        is_default=False,
    )
    session.add(new_wallet)
    session.commit()
    session.refresh(new_wallet)
    return new_wallet


@router.get("/", response_model=List[WalletRead])
def list_wallets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    """Lista los wallets del usuario, incluyendo el wallet 'default'
    (is_default=True), que se materializa como fila real al registrarse y
    agrupa todos los movimientos."""
    wallets = session.exec(
        select(Wallet)
        .where(Wallet.user_id == current_user.id, Wallet.is_active == True)
        .offset(skip)
        .limit(limit)
    ).all()
    return wallets


@router.get("/{wallet_id}", response_model=WalletRead)
def get_wallet(
    wallet_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet


@router.patch("/{wallet_id}", response_model=WalletRead)
@log_action(action=LogAction.UPDATE, table="wallets")
def update_wallet(
    wallet_id: UUID,
    wallet_in: WalletUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    update_data = wallet_in.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(wallet, key, value)

    wallet.updated_at = datetime.now()
    session.add(wallet)
    session.commit()
    session.refresh(wallet)
    return wallet


@router.delete("/{wallet_id}", status_code=200)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="wallets")
def deactivate_wallet(
    wallet_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    if wallet.is_default:
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate the default wallet",
        )

    wallet.is_active = False
    wallet.updated_at = datetime.now()
    session.add(wallet)
    session.commit()
    return {"message": "Wallet deactivated successfully", "name": wallet.name}
