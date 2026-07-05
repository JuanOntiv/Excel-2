from datetime import datetime
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.categories import Category, CategoryCreate, CategoryUpdate, CategoryRead
from app.models.users import User
from app.models.logs import LogAction, LogLevel
from app.models.user_category_preferences import UserCategoryPreference, UserCategoryPreferenceUpdate, UserCategoryPreferenceRead
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action

router = APIRouter(prefix="/categories", tags=["Categories"])


def _check_category_ownership(category: Category, current_user: User) -> bool:
    if category.user_id is None:
        return False
    return category.user_id == current_user.id


def _check_category_visibility(category: Category, current_user: User) -> bool:
    """True si el usuario puede VER esta categoria (propia o global),
    aunque no pueda editarla. Se usa para preferencias, que aplican a
    cualquier categoria visible."""
    return category.user_id is None or category.user_id == current_user.id



@router.post("/", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="categories")
def create_category(
    category_data: CategoryCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
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
    include_hidden: bool = False,
):
    query = select(Category).where(
        Category.is_active == True,
        (Category.user_id == None) | (Category.user_id == current_user.id),
    )
    categories = session.exec(query).all()

    prefs = {
        p.category_id: p
        for p in session.exec(
            select(UserCategoryPreference).where(UserCategoryPreference.user_id == current_user.id)
        ).all()
    }

    result = [
        CategoryRead(
            **c.model_dump(),
            is_hidden=prefs.get(c.id).is_hidden if c.id in prefs else False,
            color=prefs.get(c.id).color if c.id in prefs else None,
        )
        for c in categories
    ]

    if not include_hidden:
        result = [c for c in result if not c.is_hidden]

    return result


@router.get("/{category_id}", response_model=CategoryRead)
def get_category_by_id(
    category_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_category = session.get(Category, category_id)

    if not db_category or not db_category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")

    if not _check_category_visibility(db_category, current_user):
            raise HTTPException(status_code=403, detail="Not authorized to view this category")

    pref = session.exec(
		select(UserCategoryPreference).where(
            UserCategoryPreference.user_id == current_user.id,
            UserCategoryPreference.category_id == category_id,
        )
    ).first()

    return CategoryRead(
        **db_category.model_dump(),
        is_hidden=pref.is_hidden if pref else False,
        color=pref.color if pref else None,
    )


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

    pref = session.exec(
        select(UserCategoryPreference).where(
            UserCategoryPreference.user_id == current_user.id,
            UserCategoryPreference.category_id == category_id,
        )
    ).first()

    return CategoryRead(
        **category.model_dump(),
        is_hidden=pref.is_hidden if pref else False,
        color=pref.color if pref else None,
    )



@router.patch("/{category_id}/preferences", response_model=UserCategoryPreferenceRead)
def update_category_preference(
    category_id: UUID,
    pref_in: UserCategoryPreferenceUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Actualiza las preferencias del usuario actual sobre esta
    categoria (ocultar, color, etc). Aplica a CUALQUIER categoria
    visible para el usuario, propia o global, sin requerir ownership
    real sobre la categoria en si."""
    category = session.get(Category, category_id)
    if not category or not category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")

    if not _check_category_visibility(category, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view this category")

    pref = session.exec(
        select(UserCategoryPreference).where(
            UserCategoryPreference.user_id == current_user.id,
            UserCategoryPreference.category_id == category_id,
        )
    ).first()

    if not pref:
        pref = UserCategoryPreference(user_id=current_user.id, category_id=category_id)
        session.add(pref)
        session.commit()
        session.refresh(pref)

    update_data = pref_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)
    pref.updated_at = datetime.now()

    session.add(pref)
    session.commit()
    session.refresh(pref)
    return pref


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



# def _get_or_create_preference(user_id: UUID, category_id: UUID, session: Session) -> UserCategoryPreference:
#     pref = session.exec(
#         select(UserCategoryPreference).where(
#             UserCategoryPreference.user_id == user_id,
#             UserCategoryPreference.category_id == category_id,
#         )
#     ).first()
#     if not pref:
#         pref = UserCategoryPreference(user_id=user_id, category_id=category_id)
#         session.add(pref)
#         session.commit()
#         session.refresh(pref)
#     return pref


# @router.patch("/{category_id}/preferences", response_model=UserCategoryPreferenceRead)
# def update_category_preference(
#     category_id: UUID,
#     pref_in: UserCategoryPreferenceUpdate,
#     session: Session = Depends(get_session),
#     current_user: User = Depends(get_current_user),
# ):
#     category = session.get(Category, category_id)
#     if not category or not category.is_active:
#         raise HTTPException(404, "Category not found")
#     # Ojo: no valida ownership porque las preferencias son del usuario
#     # sobre CUALQUIER categoria visible para el (propia o global) —
#     # ocultar/personalizar una categoria ajena no modifica la categoria
#     # en si, solo tu propia vista de ella.
#     if category.user_id is not None and category.user_id != current_user.id:
#         raise HTTPException(403, "Not authorized to view this category")

#     pref = _get_or_create_preference(current_user.id, category_id, session)

#     update_data = pref_in.model_dump(exclude_unset=True)
#     for key, value in update_data.items():
#         setattr(pref, key, value)
#     pref.updated_at = datetime.now()

#     session.add(pref)
#     session.commit()
#     session.refresh(pref)
#     return pref
