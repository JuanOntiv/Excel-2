from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String

if TYPE_CHECKING:
    from users import User


class LogAction(str, Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"


class LogLevel(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    SECURITY = "SECURITY"


class LogCreate(SQLModel):
    user_id: Optional[UUID] = None
    action: LogAction
    level: LogLevel = LogLevel.INFO
    table: Optional[str] = None
    detail: Optional[str] = None


class LogRead(SQLModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: LogAction
    level: LogLevel
    table: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime


class Log(SQLModel, table=True):
    __tablename__ = "logs"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: Optional[UUID] = Field(
        default=None, foreign_key="users.id", nullable=True
    )

    action: LogAction = Field(
        nullable=False
    )

    level: LogLevel = Field(
        default=LogLevel.INFO,
        nullable=False
    )

    table: Optional[str] = Field(
        default=None,
        sa_column=Column(String(50), nullable=True)
    )

    detail: Optional[str] = Field(
        default=None,
        sa_column=Column(String(500), nullable=True)
    )

    created_at: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    # Relationships
    user: Optional["User"] = Relationship(back_populates="logs")
