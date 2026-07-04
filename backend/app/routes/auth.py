from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel

from app.db.db import get_session
from app.models.users import User
from app.utils.password import verify_password
from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    get_valid_refresh_token,
    revoke_refresh_token,
)
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action
from app.models.logs import LogAction, LogLevel

router = APIRouter(prefix="/auth", tags=["Auth"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    """
    Login con username (mail) y password. Usa el formulario estandar de
    OAuth2 (form-data, no JSON) para ser compatible con el boton
    "Authorize" de Swagger /docs.
    """
    user = session.exec(select(User).where(User.mail == form_data.username)).first()

    if not user or not user.is_active or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, session)

    log_entry_action = LogAction.LOGIN
    from app.models.logs import Log
    session.add(Log(user_id=user.id, action=log_entry_action, level=LogLevel.INFO, table="users"))
    session.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(
    body: RefreshRequest,
    session: Session = Depends(get_session),
):
    """
    Recibe un refresh token valido y entrega un access token nuevo
    (y un refresh token nuevo, rotando el anterior por seguridad).
    """
    db_token = get_valid_refresh_token(body.refresh_token, session)
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Rotacion: el refresh token usado se revoca y se emite uno nuevo.
    # Esto limita el dano si un refresh token es interceptado.
    db_token.revoked = True
    session.add(db_token)
    session.commit()

    new_access_token = create_access_token(db_token.user_id)
    new_refresh_token = create_refresh_token(db_token.user_id, session)

    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    body: LogoutRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Revoca el refresh token entregado (cierra esa sesion especifica)."""
    revoke_refresh_token(body.refresh_token, session)

    from app.models.logs import Log
    session.add(Log(user_id=current_user.id, action=LogAction.LOGOUT, level=LogLevel.INFO, table="users"))
    session.commit()

    return {"message": "Logged out successfully"}
