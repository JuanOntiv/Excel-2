import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional

from jose import jwt, JWTError
from sqlmodel import Session, select

from app.core.config import settings
from app.models.refresh_tokens import RefreshToken


# =========================================================
# ACCESS TOKEN (JWT corto, se manda en cada request)
# =========================================================

def create_access_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[UUID]:
    """Devuelve el user_id si el token es valido, o None si no lo es
    (expirado, firma invalida, o no es de tipo access)."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None

    if payload.get("type") != "access":
        return None

    sub = payload.get("sub")
    if sub is None:
        return None

    try:
        return UUID(sub)
    except ValueError:
        return None


# =========================================================
# REFRESH TOKEN (vida larga, se guarda hasheado en BD para
# poder revocarlo; el valor real solo lo tiene el cliente)
# =========================================================

def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_refresh_token(user_id: UUID, session: Session) -> str:
    """Genera un refresh token random, guarda su hash en BD, y devuelve
    el valor en texto plano para entregarselo al cliente (solo esta vez)."""
    raw_token = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw_token)
    # Se guarda naive (sin tzinfo) porque la columna en BD es naive;
    # comparar aware vs naive lanza TypeError. Se trata todo como UTC
    # implicito de forma consistente en todo este modulo.
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        revoked=False,
    )
    session.add(db_token)
    session.commit()

    return raw_token


def get_valid_refresh_token(raw_token: str, session: Session) -> Optional[RefreshToken]:
    """Busca el refresh token por su hash y valida que no este revocado
    ni expirado. Devuelve el registro de BD si es valido, None si no."""
    token_hash = _hash_token(raw_token)
    db_token = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).first()

    if not db_token:
        return None
    if db_token.revoked:
        return None
    if db_token.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        return None

    return db_token


def revoke_refresh_token(raw_token: str, session: Session) -> bool:
    """Revoca un refresh token (logout). Devuelve True si lo encontro
    y revoco, False si no existia."""
    token_hash = _hash_token(raw_token)
    db_token = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).first()

    if not db_token:
        return False

    db_token.revoked = True
    session.add(db_token)
    session.commit()
    return True


def revoke_all_user_tokens(user_id: UUID, session: Session) -> None:
    """Revoca todos los refresh tokens activos de un usuario (logout de
    todos los dispositivos)."""
    tokens = session.exec(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,
        )
    ).all()
    for t in tokens:
        t.revoked = True
        session.add(t)
    session.commit()
