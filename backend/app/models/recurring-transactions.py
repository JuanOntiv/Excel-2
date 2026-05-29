from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4
from enum import Enum
from sqlmodel import SQLModel, Field, Column, Relationship, Session, create_engine
from sqlalchemy import String, DECIMAL, INT
from typing import Optional


class TransactionType(str, Enum):
    INCOME = "income"
    EGRESS = "egress"


class TransactionCreate(SQLModel):
    user_id: UUID
    name: str
    description: str
    amount: float
    type: TransactionType
    frecuency: int
    start_date: datetime
    next_execution: datetime
    categoty_id: UUID
    wallet_id: UUID


class TransactionUpdate(SQLModel):
    user_id: Optional[UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[TransactionType] = None
    frecuency: Optional[int] = None
    start_date: Optional[datetime] = None
    next_execution: Optional[datetime] = None
    category_id: Optional[UUID] = None
    wallet_id: Optional[UUID] = None


class TransactionRead(SQLModel):
    id: UUID
    user_id: UUID
    name: str
    description: str
    amount: float
    frecuency: int
    start_date: datetime
    next_execution: datetime
    category_id: UUID
    wallet_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Transaction(SQLModel, table=True):
    __tablename__ = "transaction"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="user.id", nullable=False
    )
    users: "Users" = Relationship(back_populates="transactions")

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

    type: TransactionType = Field(
        nullable=False
    )

    frecuency: int = Field(
        sa_column=Column(INT), default=0
    )

    # el usuario dedice el dia
    start_date: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    # se calcula con frecuencia
    next_execution: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    category_id: UUID = Field(
        foreign_key="category.id", nullable=False
    )
    categorys: "Categorys" = Relationship(back_populates="transactions")

    wallet_id: UUID = Field(
        foreign_key="wallet.id", nullable=True
    )
    wallets: "Wallets" = Relationship(back_populates="transactions")

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
