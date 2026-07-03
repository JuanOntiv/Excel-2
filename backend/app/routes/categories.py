import logging
from datetime import datetime
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from passlib.context import CryptContext

from app.db.db import get_session
from app.models.categories import Category, CategoryType, CategoryCreate, CategoryUpdate, CategoryRead
from app.models.users import User

from app.auth. import get_current_user
from app.utils.logs_decorator import log_action


router = APIRouter(prefix="/categories", tags=["Categories"])


def check_category_ownership(category: Category, current_user: User) -> bool:
    """Retorna True si el usuario actual puede modificar/eliminar la categoría."""
    # Categoría pública (user_id None) -> solo lectura
    if category.user_id is None:
        return False
    # Privada: solo el dueño
    return category.user_id == current_user.id


@router.post("/register", response_model=CategoryCreate, status_code=status.HTTP_201_CREATED)
# @log_action(action="CREATE", entity="User", level="INFO")
def register_category(
    category_data: CategoryCreate,
    session: Session = Depends(get_session)
):

    db_category = Category.model_validate(user_dict)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category


@router.get("/", response_model=List[CategoryRead])
def get_all_categories(
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
    base_category = session.exec(select(Category).where(Category.is_active == True)).all()

    if current_user:
        query = base_category.where(
            (Category.user_id == None) | (Category.user_id == current_user.id)
        )
    else:
        query = base_category.where(Category.user_id == None)

    db_category = session.exec(query).all()
    return db_category


@router.get("/{category_id}", response_model=CategoryRead)
def get_category_by_id(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user)
):
	db_category = session.get(Category, category_id)

    if not db_category or not db_category.is_active:
    	raise HTTPException(status_code=404, detail="Category not found")

    if db_category.user_id is not None and (not current_user or db_category.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view this category")

    return db_category


# @log_action(action="UPDATE", entity="User", level="INFO")
@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
	category_id: UUID,
    category_in: CategoryUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
	category = session.get(Category, category_id)
    if not category or not category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")

    # Permisos: solo dueño o admin
    if not check_category_ownership(category, current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = category_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)

    category.updated_at = datetime.now()
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


# ============
# SOFT DELETE
# ============
@router.delete("/{category_id}", status_code=200)
# @log_action(action="SOFT_DELETE", entity="Category", level="WARNING")
def deactivate_category(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    category = session.get(Category, category_id)
    if not category or not category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")

    if not check_category_ownership(category, current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    category.is_active = False
    category.updated_at = datetime.now()
    session.add(category)
    session.commit()
    return {"message": "Category deactivated successfully"}


# ============
# HARD DELETE (solo admin, opcional)
# ============
@router.delete("/{category_id}/hard", status_code=200)
# @log_action(action="HARD_DELETE", entity="Category", level="ERROR")
def hard_delete_category(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    session.delete(category)
    session.commit()
    return {"message": "Category permanently deleted"}
