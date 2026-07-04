from datetime import datetime
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.categories import Category, CategoryCreate, CategoryUpdate, CategoryRead
from app.models.users import User
from app.models.logs import LogAction, LogLevel
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action

router = APIRouter(prefix="/categories", tags=["Categories"])


def _check_category_ownership(category: Category, current_user: User) -> bool:
    """True si el usuario puede modificar/eliminar la categoria.
    Las categorias globales (user_id None) no son editables por nadie
    via estos endpoints."""
    if category.user_id is None:
        return False
    return category.user_id == current_user.id


@router.post("/", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="categories")
def create_category(
    category_data: CategoryCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Crea una categoria privada del usuario actual. No se permite crear
    categorias globales desde este endpoint (eso se gestiona aparte, ej.
    via seed de datos o un panel administrativo separado)."""
    db_category = Category(
        user_id=current_user.id,
        name=category_data.name,
        type=category_data.type,
    )
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category


@router.get("/", response_model=List[CategoryRead])
def get_all_categories(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Devuelve las categorias globales + las privadas del usuario actual."""
    query = select(Category).where(
        Category.is_active == True,
        (Category.user_id == None) | (Category.user_id == current_user.id),
    )
    return session.exec(query).all()


@router.get("/{category_id}", response_model=CategoryRead)
def get_category_by_id(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_category = session.get(Category, category_id)

    if not db_category or not db_category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")

    if db_category.user_id is not None and db_category.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this category")

    return db_category


@router.patch("/{category_id}", response_model=CategoryRead)
@log_action(action=LogAction.UPDATE, table="categories")
def update_category(
    category_id: UUID,
    category_in: CategoryUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    category = session.get(Category, category_id)
    if not category or not category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")

    if not _check_category_ownership(category, current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = category_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)

    category.updated_at = datetime.now()
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/{category_id}", status_code=200)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="categories")
def deactivate_category(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    category = session.get(Category, category_id)
    if not category or not category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")

    if not _check_category_ownership(category, current_user):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    category.is_active = False
    category.updated_at = datetime.now()
    session.add(category)
    session.commit()
    return {"message": "Category deactivated successfully"}
