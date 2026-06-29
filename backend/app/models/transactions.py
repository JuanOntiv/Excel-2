from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, DECIMAL, Date
from typing import Optional, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from users import User
    from categories import Category
    from transactions_wallets import TransactionWallet


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionCreate(SQLModel):
    name: str
    description: Optional[str] = None
    amount: float
    date: datetime
    type: TransactionType
    categoty_id: UUID
    wallet_id: Optional[UUID] = None  # asignacion manual opcional a un wallet custom


class TransactionUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[TransactionType] = None
    date: Optional[datetime] = None
    category_id: Optional[UUID] = None
    wallet_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class TransactionRead(SQLModel):
	id: UUID
	user_id: UUID
	name: str
	description: Optional[str] = None
	amount: float
	type: TransactionType
	date: datetime
	category_id: UUID
	is_active: bool
	created_at: datetime
	updated_at: datetime


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="user.id", nullable=False
    )

    name: str = Field(
        sa_column=Column(
        	String(150),
         	nullable=False
        )
    )

    description: str = Field(
    	default=None,
        sa_column=Column(
        	String(250),
         	nullable=False
        )
    )

    amount: float = Field(
        sa_column=Column(DECIMAL(10, 2)), default=0.00
    )

    date: datetime = Field(
        sa_column=Column(Date, nullable=False)
    )

    type: TransactionType = Field(
        nullable=False
    )

    category_id: UUID = Field(
        foreign_key="categories.id", nullable=False
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


	# Relationships
    user: "User" = Relationship(back_populates="transactions")
    category: "Category" = Relationship(back_populates="transactions")
    transaction_wallets: list["TransactionWallet"] = Relationship(back_populates="transaction")
