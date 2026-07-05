from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from uuid import UUID
from datetime import datetime
from typing import List, Optional

from app.db.db import get_session
from app.models.transactions import Transaction, TransactionCreate, TransactionRead, TransactionUpdate
from app.models.users import User
from app.models.categories import Category
from app.models.wallets import Wallet
from app.auth import get_current_user
from app.utils.logs_decorator import log_action


router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/", response_model=TransactionCreate, status_code=201)
@log_action(action="CREATE", entity="Transactions", level="INFO")
def create_egress(
    egress_in: TransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if egress_in.user_id != current_user.id:
        raise HTTPException(403, "Cannot create egress for another user")

    # Validar categoría
    category = session.get(Category, egress_in.category_id)
    if not category or not category.is_active:
        raise HTTPException(404, "Category not found")
    if category.user_id is not None and category.user_id != current_user.id:
        raise HTTPException(403, "Category not yours")

    if egress_in.wallet_id:
        wallet = session.get(Wallet, egress_in.wallet_id)
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found")

    egress_dict = egress_in.model_dump()
    egress_dict["user_id"] = current_user.id
    new_egress = Egress(**egress_dict, is_active=True)
    session.add(new_egress)
    session.commit()
    session.refresh(new_egress)
    return new_egress

@router.get("/", response_model=List[EgressRead])
def list_egress(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    query = select(Egress).where(Egress.user_id == current_user.id, Egress.is_active == True)
    if category_id:
        query = query.where(Egress.category_id == category_id)
    if start_date:
        query = query.where(Egress.date >= start_date)
    if end_date:
        query = query.where(Egress.date <= end_date)
    egress = session.exec(query.offset(skip).limit(limit)).all()
    return egress

@router.get("/{egress_id}", response_model=EgressRead)
def get_egress(
    egress_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    egress = session.get(Egress, egress_id)
    if not egress or not egress.is_active or egress.user_id != current_user.id:
        raise HTTPException(404, "Egress not found")
    return egress

@router.patch("/{egress_id}", response_model=EgressRead)
@log_action(action="UPDATE", entity="Egress", level="INFO")
def update_egress(
    egress_id: UUID,
    egress_in: EgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    egress = session.get(Egress, egress_id)
    if not egress or not egress.is_active or egress.user_id != current_user.id:
        raise HTTPException(404, "Egress not found")
    update_data = egress_in.model_dump(exclude_unset=True)
    if "user_id" in update_data and update_data["user_id"] != current_user.id:
        raise HTTPException(403, "Cannot change user_id")
    update_data.pop("user_id", None)

    # Validaciones de categoría y wallet similares a incomes...
    if "category_id" in update_data and update_data["category_id"]:
        category = session.get(Category, update_data["category_id"])
        if not category or not category.is_active:
            raise HTTPException(404, "Category not found")
        if category.user_id is not None and category.user_id != current_user.id:
            raise HTTPException(403, "Category not yours")
    if "wallet_id" in update_data and update_data["wallet_id"]:
        wallet = session.get(Wallet, update_data["wallet_id"])
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found")

    for key, value in update_data.items():
        setattr(egress, key, value)
    egress.updated_at = datetime.now()
    session.add(egress)
    session.commit()
    session.refresh(egress)
    return egress

@router.delete("/{egress_id}", status_code=200)
@log_action(action="SOFT_DELETE", entity="Egress", level="WARNING")
def deactivate_egress(
    egress_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    egress = session.get(Egress, egress_id)
    if not egress or not egress.is_active or egress.user_id != current_user.id:
        raise HTTPException(404, "Egress not found")
    egress.is_active = False
    egress.updated_at = datetime.now()
    session.add(egress)
    session.commit()
    return {"message": "Egress deactivated"}
