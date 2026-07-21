from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.db.db import get_session
from app.models.notifications import Notification, NotificationRead
from app.models.users import User
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# No hay POST publico: las notificaciones las genera el backend via
# app/services/notifications.py cuando ocurre un evento de dominio.
# El usuario solo lee las suyas y las marca como leidas / las descarta.


# IMPORTANTE (gotcha #12): las rutas estaticas (/unread-count, /read-all) van
# ANTES de las dinamicas (/{notification_id}/...), o Starlette las tragaria.


@router.get("/unread-count")
def unread_count(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Conteo de no-leidas para el badge de la campana."""
    count = session.exec(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    ).one()
    return {"count": count}


@router.post("/read-all", status_code=200)
def mark_all_read(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()
    unread = session.exec(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    ).all()
    for n in unread:
        n.is_read = True
        n.read_at = now
        session.add(n)
    session.commit()
    return {"message": f"Marked {len(unread)} notifications as read"}


@router.get("/", response_model=List[NotificationRead])
def list_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    is_read: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
    query = query.order_by(Notification.created_at.desc())
    return session.exec(query.offset(skip).limit(limit)).all()


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(
    notification_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    notification = session.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(404, "Notification not found")
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now()
        session.add(notification)
        session.commit()
        session.refresh(notification)
    return notification


@router.delete("/{notification_id}", status_code=200)
def delete_notification(
    notification_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Borrado real: las notificaciones no son registros de auditoria
    (para eso esta la tabla logs), asi que descartar = eliminar la fila."""
    notification = session.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(404, "Notification not found")
    session.delete(notification)
    session.commit()
    return {"message": "Notification deleted"}
