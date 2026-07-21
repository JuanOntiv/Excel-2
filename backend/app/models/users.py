from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship, Session, create_engine
from sqlalchemy import String
from typing import Optional, TYPE_CHECKING


if TYPE_CHECKING:
    from app.models.categories import Category
    from app.models.transactions import Transaction
    from app.models.wallets import Wallet
    from app.models.wallet_rules import WalletRule
    from app.models.recurring_transactions import RecurringTransaction
    from app.models.logs import Log
    from app.models.refresh_tokens import RefreshToken
    from app.models.goals import Goal
    from app.models.notifications import Notification


class UserCreate(SQLModel):
    name: str
    mail: str
    password: str


class UserUpdate(SQLModel):
    name: Optional[str] = None
    mail: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserRead(SQLModel):
    id: UUID
    name: str
    mail: str
    is_active: bool
    is_admin: bool
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

    password: str = Field(nullable=False)

    is_active: bool = Field(
        default=True,
        nullable=False
    )

    is_admin: bool = Field(
        default=False,
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
    categories: list["Category"] = Relationship(back_populates="user")
    transactions: list["Transaction"] = Relationship(back_populates="user")
    wallets: list["Wallet"] = Relationship(back_populates="user")
    wallet_rules: list["WalletRule"] = Relationship(back_populates="user")
    recurring_transactions: list["RecurringTransaction"] = Relationship(back_populates="user")
    logs: list["Log"] = Relationship(back_populates="user")
    refresh_tokens: list["RefreshToken"] = Relationship(back_populates="user")
    goals: list["Goal"] = Relationship(back_populates="user")
    notifications: list["Notification"] = Relationship(back_populates="user")
