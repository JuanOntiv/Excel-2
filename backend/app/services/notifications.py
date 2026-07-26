"""Servicio emisor de notificaciones de dominio.

Distinto del audit log (models/logs.py): las notificaciones son para el usuario
final (titulo/mensaje legible, estado leido/no-leido, campana con badge), no un
registro tecnico. Se generan cuando el sistema hace algo sin que el usuario este
mirando (recurrente auto-ejecutada, meta cumplida, etc.).
"""
from uuid import UUID
from typing import Optional

from sqlmodel import Session, select

from app.models.notifications import Notification, NotificationType


def create_notification(
    session: Session,
    user_id: UUID,
    type: NotificationType,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    dedupe: bool = False,
    commit: bool = True,
) -> Optional[Notification]:
    """Crea una notificacion para un usuario.

    dedupe=True evita duplicados: si ya existe una notificacion NO LEIDA del
    mismo (type, entity_id) para ese usuario, no crea otra y devuelve None.
    Se usa para eventos que pueden re-dispararse (p. ej. RECURRING_PENDING, que
    se re-evalua en cada login).

    commit=False deja el add sin confirmar para que el caller agrupe el commit
    con el resto de su transaccion.
    """
    if dedupe:
        existing = session.exec(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.type == type,
                Notification.entity_id == entity_id,
                Notification.is_read == False,
            )
        ).first()
        if existing:
            return None

    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    session.add(notification)
    if commit:
        session.commit()
        session.refresh(notification)
    return notification
