from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship, Session, create_engine
from sqlalchemy import String, DECIMAL
from typing import Optional

class EgressCreate(SQLModel):
    user_id: UUID
    name: str
    description: str
    amount: float
    date: datetime
    categoty_id: UUID
    wallet_id: UUID


class EgressUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[datetime] = None
    category_id: Optional[UUID] = None
    wallet_id: Optional[UUID] = None


class UserRead(SQLModel):
    user_id: UUID
    id: UUID
    name: str
    description: str
    amount: float
    date: datetime
    category_id: UUID
    wallet_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Egress(SQLModel, table=True):
    __tablename__ = "egress"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="user.id", nullable=False
    )

    name: str = Field(
        sa_column=Column(String(150),
        nullable=False)
    )

    description: str = Field(
        sa_column=Column(String(150),
        nullable=False)
    )

    amount: float = Field(
        sa_column=Column(DECIMAL(10, 2)), default=0.00
    )

    date: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )


    category_id: UUID = Field(
        foreign_key="category.id", nullable=False
    )

    wallet_id: UUID = Field(
        foreign_key="wallet.id", nullable=True
    )

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
