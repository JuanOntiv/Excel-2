from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship, Session, create_engine
from sqlalchemy import String
from typing import Optional

class LogCreate(SQLModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    level: str = "INFO"
    table: Optional[str] = None
    details: Optional[str] = None


class LogRead(SQLModel):
    id: UUID
    user_id: UUID o str
    action: str
    level: str
    table: str
    detail: str
    created_at: datetime


class Log(SQLModel, table=True):
    __tablename__ = "logs"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: Optional[UUID] = Field(
        default_factory=None, nullable=True
    )

    action: str = Field(
        sa_column=Column(String(150),
        nullable=False
    ) # CREATE | READ | UPDATE | DELETE | LOGIN | LOGOUT

    level: str = Field(
    	default="INFO",
        sa_column=Column(String(20))
    ) # INFO | WARNING | ERROR | SECURITY

	table: Optional[str] = Field(
		default=None,
		sa_column=Column(String(20))
    )

    detail: Optional[str] = Field(
    	default=None
    )

    created_at: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )
