# app/routes/wallets.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime
from typing import List, Optional

from app.db.db import get_session
from app.models.wallets import Wallet, WalletCreate, WalletUpdate, WalletRead
from app.models.users import User
from app.auth import get_current_user
from app.utils.logs_decorator import log_action

router = APIRouter(prefix="/wallets", tags=["Wallets"])

# ============ CREATE ============
@router.post("/", response_model=WalletRead, status_code=status.HTTP_201_CREATED)
@log_action(action="CREATE", entity="Wallet", level="INFO")
def create_wallet(
    wallet_in: WalletCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Si se pide is_default=True, primero desmarcar la anterior default del usuario
    if wallet_in.is_default:
        existing_default = session.exec(
            select(Wallet).where(
                Wallet.user_id == current_user.id,
                Wallet.is_default == True,
                Wallet.is_active == True
            )
        ).first()
        if existing_default:
            existing_default.is_default = False
            session.add(existing_default)

    wallet_dict = wallet_in.model_dump()
    new_wallet = Wallet(
        **wallet_dict,
        user_id=current_user.id,
        is_active=True
    )
    session.add(new_wallet)
    session.commit()
    session.refresh(new_wallet)
    return new_wallet

# ============ LIST ============
@router.get("/", response_model=List[WalletRead])
def list_wallets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    wallets = session.exec(
        select(Wallet)
        .where(Wallet.user_id == current_user.id, Wallet.is_active == True)
        .offset(skip)
        .limit(limit)
    ).all()
    return wallets

# ============ GET ONE ============
@router.get("/{wallet_id}", response_model=WalletRead)
def get_wallet(
    wallet_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet

# ============ UPDATE (PATCH) ============
@router.patch("/{wallet_id}", response_model=WalletRead)
@log_action(action="UPDATE", entity="Wallet", level="INFO")
def update_wallet(
    wallet_id: UUID,
    wallet_in: WalletUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    update_data = wallet_in.model_dump(exclude_unset=True)

    # Si se quiere marcar como default, desmarcar la anterior (excepto esta misma)
    if update_data.get("is_default") == True:
        existing_default = session.exec(
            select(Wallet).where(
                Wallet.user_id == current_user.id,
                Wallet.is_default == True,
                Wallet.is_active == True,
                Wallet.id != wallet_id
            )
        ).first()
        if existing_default:
            existing_default.is_default = False
            session.add(existing_default)

    for key, value in update_data.items():
        setattr(wallet, key, value)
    wallet.updated_at = datetime.now()
    session.add(wallet)
    session.commit()
    session.refresh(wallet)
    return wallet

# ============ SOFT DELETE ============
@router.delete("/{wallet_id}", status_code=200)
@log_action(action="SOFT_DELETE", entity="Wallet", level="WARNING")
def deactivate_wallet(
    wallet_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    # No permitir desactivar la wallet si es la única wallet activa o si es la default?
    # Podrías dejar que el usuario decida, pero se recomienda validar.
    # Aquí solo lo desactivamos sin restricciones.
    wallet.is_active = False
    wallet.updated_at = datetime.now()
    session.add(wallet)
    session.commit()
    return {"message": "Wallet deactivated successfully"}
