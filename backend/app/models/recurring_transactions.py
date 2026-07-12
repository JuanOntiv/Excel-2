from datetime import datetime, date as date_type
from uuid import UUID, uuid4
from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, DECIMAL, Date

if TYPE_CHECKING:
    from app.models.users import User
    from app.models.categories import Category


class RecurringTransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class RecurringTransactionFrequency(str, Enum):
    DAILY = "Daily"
    WEEKLY = "Weekly"
    BIWEEKLY = "Biweekly"
    MONTHLY = "Monthly"
    YEARLY = "Yearly"


class RecurringTransactionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class RecurringTransactionCreate(SQLModel):
    # user_id: UUID
    name: str
    description: Optional[str] = None
    amount: float
    type: RecurringTransactionType
    frequency: RecurringTransactionFrequency
    start_date: date_type
    auto_execute: bool = True
    category_id: UUID
    wallet_id: Optional[UUID] = None


class RecurringTransactionUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[RecurringTransactionType] = None
    frequency: Optional[RecurringTransactionFrequency] = None
    next_execution: Optional[date_type] = None
    status: Optional[RecurringTransactionStatus] = None
    auto_execute: Optional[bool] = None
    category_id: Optional[UUID] = None
    wallet_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class RecurringTransactionRead(SQLModel):
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str] = None
    amount: float
    type: RecurringTransactionType
    frequency: RecurringTransactionFrequency
    start_date: date_type
    next_execution: date_type
    last_executed: Optional[date_type] = None
    status: RecurringTransactionStatus
    auto_execute: bool
    category_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RecurringTransaction(SQLModel, table=True):
    __tablename__ = "recurring_transactions"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="users.id", nullable=False
    )

    name: str = Field(
        sa_column=Column(String(150), nullable=False)
    )

    description: Optional[str] = Field(
        default=None,
        sa_column=Column(String(150), nullable=True)
    )

    amount: float = Field(
        sa_column=Column(DECIMAL(10, 2)), default=0.00
    )

    type: RecurringTransactionType = Field(
        nullable=False
    )

    frequency: RecurringTransactionFrequency = Field(
        nullable=False
    )

    start_date: date_type = Field(
        sa_column=Column(Date, nullable=False)
    )

    next_execution: date_type = Field(
        sa_column=Column(Date, nullable=False)
    )

    # Nullable: aun no se ha ejecutado nunca al crearse
    last_executed: Optional[date_type] = Field(
        default=None, sa_column=Column(Date, nullable=True)
    )

    status: RecurringTransactionStatus = Field(
        default=RecurringTransactionStatus.ACTIVE,
        nullable=False
    )

    auto_execute: bool = Field(
        default=True,
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
    user: "User" = Relationship(back_populates="recurring_transactions")
    category: "Category" = Relationship(back_populates="recurring_transactions")
