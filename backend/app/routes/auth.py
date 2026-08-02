from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel

from app.core.config import settings
from app.db.db import get_session
from app.models.users import User
from app.utils.password import verify_password
from app.utils.rate_limit import RateLimiter
from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    get_valid_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens,
)
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action
from app.models.logs import LogAction, LogLevel

router = APIRouter(prefix="/auth", tags=["Auth"])

# Limiter compartido para el login (estado en memoria del proceso). Se expone a
# nivel de modulo para poder inspeccionarlo/limpiarlo desde los tests.
login_rate_limiter = RateLimiter(
    max_attempts=settings.LOGIN_MAX_ATTEMPTS,
    lockout_ladder=settings.LOGIN_LOCKOUT_LADDER_SECONDS,
    strike_decay_seconds=settings.LOGIN_STRIKE_DECAY_SECONDS,
)


def _login_key(username: str) -> str:
    """Clave del rate limiter: la CUENTA, no la IP.

    Detras de un proxy `request.client.host` es la IP del proxy, identica para
    todos los usuarios, asi que limitar por IP bloqueaba el login de todo el
    mundo cuando una sola persona fallaba 5 veces.

    Se normaliza (trim + minusculas) para que variar mayusculas no sirva de
    evasion, y se prefija para que la clave sea inequivoca.
    """
    return f"user:{username.strip().lower()}"


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
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    """
    Login con username (mail) y password. Usa el formulario estandar de
    OAuth2 (form-data, no JSON) para ser compatible con el boton
    "Authorize" de Swagger /docs.

    Protegido con rate limiting POR CUENTA: tras varios fallos seguidos sobre
    el mismo correo se bloquean nuevos intentos con 429, con espera progresiva
    (ver `app/utils/rate_limit.py`). Otras cuentas no se ven afectadas.
    """
    client_key = request.client.host if request.client else "unknown"
    limiter_key = _login_key(form_data.username)

    retry_after = login_rate_limiter.retry_after(limiter_key)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            # +1 para redondear hacia arriba y no sugerir reintentar demasiado pronto.
            headers={"Retry-After": str(int(retry_after) + 1)},
        )

    user = session.exec(select(User).where(User.mail == form_data.username)).first()

    if not user or not user.is_active or not verify_password(form_data.password, user.password):
        # Cuenta el intento fallido (credenciales malas, cuenta inactiva y
        # tambien correos inexistentes: si estos no contaran, recibir 401 en
        # lugar de 429 revelaria que correos estan registrados).
        login_rate_limiter.register_failure(limiter_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Login correcto: limpia el historial de fallos de esa cuenta.
    login_rate_limiter.reset(limiter_key)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, session)

    log_entry_action = LogAction.LOGIN
    from app.models.logs import Log
    session.add(Log(
        user_id=user.id,
        action=log_entry_action,
        level=LogLevel.INFO,
        table="users",
        detail=f"Desde {client_key}",
    ))
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

    # Una cuenta desactivada no puede seguir renovando su sesion. Sin esto, el
    # refresh solo miraba la fila del token: un usuario dado de baja seguia
    # obteniendo access tokens validos hasta 30 dias, y como get_current_user
    # si rechaza a los inactivos, el frontend se quedaba en un limbo (401 en
    # todo, refresh OK, sin redirigir nunca a login).
    # Se revoca toda la familia para que no siga rotando en cada peticion, y se
    # devuelve el mismo detalle generico: distinguirlo filtraria que la cuenta
    # existe pero esta suspendida.
    user = session.get(User, db_token.user_id)
    if user is None or not user.is_active:
        revoke_all_user_tokens(db_token.user_id, session)
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
    session.add(Log(
        user_id=current_user.id,
        action=LogAction.LOGOUT,
        level=LogLevel.INFO,
        table="users",
        detail=current_user.mail,
    ))
    session.commit()

    return {"message": "Logged out successfully"}
