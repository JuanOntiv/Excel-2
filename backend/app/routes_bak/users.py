import logging
from datetime import datetime
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from passlib.context import CryptContext

from app.db import get_session
from app.models.users import User, UserCreate, UserUpdate, UserRead

from app.utils.password import hash_password, verify_password
from app.auth import get_current_user
from app.utils.logs_decorator import log_action


router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/register", response_model=UserCreate, status_code=status.HTTP_201_CREATED)
# @log_action(action="CREATE", entity="User", level="INFO")
def register_user(
    user_data: UserCreate,
    session: Session = Depends(get_session)
):
    # Verificar si el mail ya existe
    existing_user = session.exec(select(User).where(User.mail == user_data.mail)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Crear el usuario con contraseña hasheada
    user_dict = user_data.model_dump()
    user_dict["password_hash"] = hash_password(user_dict["password_hash"])

    db_user = User.model_validate(user_dict)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

# Posiblemente es inutil
@router.get("/", response_model=List[UserRead])
def get_all_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)  # requiere login
):
    users = session.exec(select(User).where(User.is_active == True)).all()
    return users


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Permiso: solo el mismo usuario puede ver su perfil
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.patch("/{user_id}", response_model=UserRead)
# @log_action(action="UPDATE", entity="User", level="INFO")
def update_user_by_id(
    user_id: UUID,
    user_data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Permiso: solo el mismo usuario puede actualizarse
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    db_user = session.get(User, user_id)
    if not db_user or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    update_data = user_data.model_dump(exclude_unset=True)

    # Si se actualiza la contraseña, hashearla
    if "password_hash" in update_data and update_data["password_hash"]:
        update_data["password_hash"] = hash_password(update_data["password_hash"])

    for key, value in update_data.items():
        setattr(db_user, key, value)

    db_user.updated_at = datetime.now()
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
# @log_action(action="DELETE", entity="User", level="WARNING")
def deactivate_user(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    db_user = session.get(User, user_id)
    if not db_user or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Soft delete
    db_user.is_active = False
    db_user.updated_at = datetime.now()
    session.add(db_user)
    session.commit()

    return {"message": "User deactivated successfully", "user_id": str(user_id)}



# HARD DELETE (opcional, solo admin)
@router.delete("/{user_id}/hard", status_code=status.HTTP_200_OK)
# @log_action(action="HARD_DELETE", entity="User", level="ERROR", user_field="current_user")
def hard_delete_user(
    user_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Solo administradores pueden borrar físicamente (peligroso)
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    session.delete(db_user)
    session.commit()
    return {"message": "User permanently deleted", "user_id": str(user_id)}
