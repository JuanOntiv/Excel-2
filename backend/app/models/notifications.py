from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String

if TYPE_CHECKING:
    from app.models.users import User


class NotificationType(str, Enum):
    # Recurrentes
    RECURRING_EXECUTED = "RECURRING_EXECUTED"   # se auto-ejecuto sin intervencion del usuario
    RECURRING_PENDING = "RECURRING_PENDING"     # vencio una con auto_execute=False, espera confirmacion
    # Metas
    GOAL_ACHIEVED = "GOAL_ACHIEVED"             # meta de ingreso/ahorro alcanzada, o presupuesto respetado al cerrar
    GOAL_EXCEEDED = "GOAL_EXCEEDED"             # limite de gasto rebasado
    GOAL_FAILED = "GOAL_FAILED"                # termino el periodo sin cumplir (ingreso/ahorro)


class NotificationCreate(SQLModel):
    """Uso interno del servicio emisor; no hay POST publico."""
    user_id: UUID
    type: NotificationType
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None


class NotificationRead(SQLModel):
    id: UUID
    type: NotificationType
    title: str
    message: str
    is_read: bool
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    created_at: datetime
    read_at: Optional[datetime] = None


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="users.id", nullable=False, index=True
    )

    type: NotificationType = Field(
        nullable=False
    )

    title: str = Field(
        sa_column=Column(String(150), nullable=False)
    )

    message: str = Field(
        sa_column=Column(String(500), nullable=False)
    )

    is_read: bool = Field(
        default=False,
        nullable=False
    )

    # Referencia polimorfica al objeto de dominio (para navegar desde la campana).
    # entity_type = "recurring_transaction" | "goal" | ...; el frontend arma la ruta.
    entity_type: Optional[str] = Field(
        default=None,
        sa_column=Column(String(50), nullable=True)
    )

    entity_id: Optional[UUID] = Field(
        default=None,
        nullable=True
    )

    created_at: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    read_at: Optional[datetime] = Field(
        default=None,
        nullable=True
    )

    # Relationships
    user: Optional["User"] = Relationship(back_populates="notifications")
