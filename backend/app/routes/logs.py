from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.logs import Log, LogRead, LogAction, LogLevel
from app.models.users import User
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/logs", tags=["Logs"])


# No hay POST publico: los logs se generan automaticamente via el
# decorador @log_action en el resto de las rutas. Un usuario solo
# puede consultar SU propio historial de acciones.


@router.get("/", response_model=List[LogRead])
def get_my_logs(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    action: Optional[LogAction] = None,
    level: Optional[LogLevel] = None,
):
    query = select(Log).where(Log.user_id == current_user.id)
    if action:
        query = query.where(Log.action == action)
    if level:
        query = query.where(Log.level == level)

    query = query.order_by(Log.created_at.desc())
    return session.exec(query.offset(skip).limit(limit)).all()
