from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship, Session, create_engine
from sqlalchemy import String
from typing import Optional

class UserCreate(SQLModel):
    name: str
    mail: str
    password_hash: str


class UserUpdate(SQLModel):
    name: Optional[str] = None
    mail: Optional[str] = None
    password_hash: Optional[str] = None
    role_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserRead(SQLModel):
    id: UUID
    name: str
    mail: str
    role_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    name: str = Field(
        sa_column=Column(String(150),
        nullable=False)
    )

    mail: str = Field(
        sa_column=Column(String(150),
        nullable=False,
        unique=True)
    )

    password_hash: str = Field(nullable=False)

    is_active: bool = Field(
        default=True,
        nullable=False
    )

    created_at: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    updated_at: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    # Relaciones
    #
