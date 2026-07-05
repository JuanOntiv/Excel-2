import logging
from datetime import datetime
from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.income import Income, IncomeCreate, IncomeUpdate, IncomeRead
from app.models.users import User
from app.models.categories import Category
from app.models.wallets import Wallet
from app.db.db import get_current_user
from app.utils.logs_decorator import log_action


router = APIRouter(prefix="/incomes", tags=["Incomes"])


@router.post("/", response_model=IncomeRead, status_code=status.HTTP_201_CREATED)
# @log_action(action="CREATE", entity="Income", level="INFO")
def create_income(
    income_in: IncomeCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):

    if income_in.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Cannot create income for another user"
        )

    # Validar que la categoría existe y pertenece al usuario o es pública
    category = session.get(Category, income_in.category_id)
    if not category or not category.is_active:
        raise HTTPException(404, "Category not found")
    if category.user_id is not None and category.user_id != current_user.id:
        raise HTTPException(403, "Category does not belong to you")

    # Validar wallet (si se envía wallet_id)
    if income_in.wallet_id:
        wallet = session.get(Wallet, income_in.wallet_id)
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found or not yours")

    session.add(income_in)
    session.commit()
    session.refresh(income_in)
    return income_in


# ============ LIST (solo del usuario) ============
@router.get("/", response_model=List[IncomeRead])
def list_incomes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    query = select(Income).where(
        Income.user_id == current_user.id,
        Income.is_active == True
    )
    if category_id:
        query = query.where(Income.category_id == category_id)
    if start_date:
        query = query.where(Income.date >= start_date)
    if end_date:
        query = query.where(Income.date <= end_date)

    incomes = session.exec(query.offset(skip).limit(limit)).all()
    return incomes


# ============ GET ONE ============
@router.get("/{income_id}", response_model=IncomeRead)
def get_income(
    income_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    income = session.get(Income, income_id)
    if not income or not income.is_active or income.user_id != current_user.id:
        raise HTTPException(404, "Income not found")
    return income


# ============ UPDATE (PATCH) ============
@router.patch("/{income_id}", response_model=IncomeRead)
@log_action(action="UPDATE", entity="Income", level="INFO")
def update_income(
    income_id: UUID,
    income_in: IncomeUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    income = session.get(Income, income_id)
    if not income or not income.is_active or income.user_id != current_user.id:
        raise HTTPException(404, "Income not found")

    update_data = income_in.model_dump(exclude_unset=True)
    # Validar nueva categoría si viene
    if "category_id" in update_data and update_data["category_id"]:
        category = session.get(Category, update_data["category_id"])
        if not category or not category.is_active:
            raise HTTPException(404, "Category not found")
        if category.user_id is not None and category.user_id != current_user.id:
            raise HTTPException(403, "Category not yours")

    # Validar nueva wallet si viene
    if "wallet_id" in update_data and update_data["wallet_id"]:
        wallet = session.get(Wallet, update_data["wallet_id"])
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found")

    for key, value in update_data.items():
        setattr(income, key, value)
    income.updated_at = datetime.now()
    session.add(income)
    session.commit()
    session.refresh(income)
    return income


# ============ SOFT DELETE ============
@router.delete("/{income_id}", status_code=200)
@log_action(action="SOFT_DELETE", entity="Income", level="WARNING")
def deactivate_income(
    income_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    income = session.get(Income, income_id)
    if not income or not income.is_active or income.user_id != current_user.id:
        raise HTTPException(404, "Income not found")
    income.is_active = False
    income.updated_at = datetime.now()
    session.add(income)
    session.commit()
    return {"message": "Income deactivated"}
