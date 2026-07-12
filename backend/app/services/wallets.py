"""Helpers para la wallet default del usuario.

La wallet default representa "todos los movimientos del usuario sin filtrar".
A diferencia de las wallets custom, se materializa como una fila real al
registrar el usuario (is_default=True), de modo que el dashboard pueda
referenciarla directamente (id/nombre estables) en vez de tratarla como una
entidad implicita.

Enfoque (Opcion A): el balance NO se almacena; se sigue calculando sumando las
transacciones del usuario. Esto evita el problema de una cache de balance que se
desincroniza. La wallet default solo aporta identidad/metadata estable.
"""
from uuid import UUID
from typing import Optional

from sqlmodel import Session, select

from app.models.wallets import Wallet

DEFAULT_WALLET_NAME = "General"
DEFAULT_WALLET_DESCRIPTION = "Wallet principal con todos tus movimientos"


def create_default_wallet(user_id: UUID, session: Session, commit: bool = True) -> Wallet:
    """Crea la wallet default de un usuario. Se llama una vez al registrarlo."""
    wallet = Wallet(
        user_id=user_id,
        name=DEFAULT_WALLET_NAME,
        description=DEFAULT_WALLET_DESCRIPTION,
        is_default=True,
    )
    session.add(wallet)
    if commit:
        session.commit()
        session.refresh(wallet)
    return wallet


def get_default_wallet(user_id: UUID, session: Session) -> Optional[Wallet]:
    """Devuelve la wallet default activa del usuario, o None si no tiene."""
    return session.exec(
        select(Wallet).where(
            Wallet.user_id == user_id,
            Wallet.is_default == True,
            Wallet.is_active == True,
        )
    ).first()
