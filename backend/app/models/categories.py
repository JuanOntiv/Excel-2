from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String
from typing import Optional, TYPE_CHECKING


if TYPE_CHECKING:
    from users import User
    from transactions import Transaction
    from recurring_transactions import RecurringTransaction
    from wallet_rules import WalletRule


# To use with ENUM
class CategoryType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"
    BOTH = "both"


class CategoryCreate(SQLModel):
	user_id: UUID
	name: str
	type: CategoryType


class CategoryUpdate(SQLModel):
    name: Optional[str] = None
    type: Optional[CategoryType] = None
    is_active: Optional[bool] = None
    user_id: Optional[UUID] = None


class CategoryRead(SQLModel):
    id: UUID
    user_id: Optional[UUID] = None
    name: str
    type: CategoryType
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Category(SQLModel, table=True):
    __tablename__ = "categories"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
    	default=None,
        foreign_key="users.id",
        nullable=True
    )

    name: str = Field(
        sa_column=Column(String(150), nullable=False)
    )

    type: CategoryType = Field(
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
    user: Optional["User"] = Relationship(back_populates="categories")
    transactions: list["Transaction"] = Relationship(back_populates="category")
    recurring_transactions: list["RecurringTransaction"] = Relationship(back_populates="category")
    wallet_rules: list["WalletRule"] = Relationship(back_populates="category")
