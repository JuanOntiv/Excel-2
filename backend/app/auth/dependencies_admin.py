from fastapi import Depends, HTTPException, status

from app.models.users import User
from app.auth.dependencies import get_current_user


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependencia para rutas exclusivas de administradores. Reutiliza
    get_current_user (token valido + cuenta activa) y ademas exige
    is_admin=True. No existe ningun endpoint que permita setear
    is_admin via la API: se gestiona solo por script de seed."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
