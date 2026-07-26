from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, DECIMAL, Date
from typing import Optional, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from app.models.users import User
    from app.models.wallets import Wallet
    from app.models.categories import Category


class GoalType(str, Enum):
    INCOME = "income"          # juntar al menos target_amount de ingresos
    EXPENSE_LIMIT = "expense_limit"  # gastar como maximo target_amount (presupuesto)
    SAVINGS = "savings"        # balance neto (ingreso - gasto) >= target_amount


class GoalStatus(str, Enum):
    ACTIVE = "active"
    ACHIEVED = "achieved"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GoalCreate(SQLModel):
    name: str
    description: Optional[str] = None
    goal_type: GoalType
    target_amount: float
    start_date: datetime
    end_date: datetime
    wallet_id: Optional[UUID] = None      # None = todas las transacciones (default implicito)
    category_id: Optional[UUID] = None    # None = todas las categorias


class GoalUpdate(SQLModel):
    # is_active se maneja via el endpoint de borrado; status via /cancel.
    name: Optional[str] = None
    description: Optional[str] = None
    goal_type: Optional[GoalType] = None
    target_amount: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    wallet_id: Optional[UUID] = None
    category_id: Optional[UUID] = None


class GoalRead(SQLModel):
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str] = None
    goal_type: GoalType
    target_amount: float
    start_date: datetime
    end_date: datetime
    wallet_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    status: GoalStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime


class GoalProgressRead(GoalRead):
    # Campos computados a partir de las transacciones del periodo; no persistidos.
    current_amount: float
    remaining: float
    percentage: float
    is_on_track: bool


class Goal(SQLModel, table=True):
    __tablename__ = "goals"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="users.id", nullable=False
    )

    name: str = Field(
        sa_column=Column(String(150),
        nullable=False)
    )

    description: Optional[str] = Field(
        default=None,
        sa_column=Column(String(150), nullable=True)
    )

    goal_type: GoalType = Field(
        nullable=False
    )

    target_amount: float = Field(
        sa_column=Column(DECIMAL(10, 2)), default=0.00
    )

    start_date: datetime = Field(
        sa_column=Column(Date, nullable=False)
    )

    end_date: datetime = Field(
        sa_column=Column(Date, nullable=False)
    )

    wallet_id: Optional[UUID] = Field(
        default=None, foreign_key="wallets.id", nullable=True
    )

    category_id: Optional[UUID] = Field(
        default=None, foreign_key="categories.id", nullable=True
    )

    status: GoalStatus = Field(
        default=GoalStatus.ACTIVE,
        nullable=False
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
    user: "User" = Relationship(back_populates="goals")
    wallet: Optional["Wallet"] = Relationship()
    category: Optional["Category"] = Relationship()
