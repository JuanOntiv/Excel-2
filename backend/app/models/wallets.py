from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.users import User
    from app.models.wallet_rules import WalletRule
    from app.models.transactions_wallets import TransactionWallet


class WalletCreate(SQLModel):
    name: str
    description: Optional[str] = None


class WalletUpdate(SQLModel):
    # is_default no es asignable: la wallet default es unica y se crea
    # automaticamente al registrar al usuario (ver services/wallets.py).
    # is_active se maneja via el endpoint dedicado de borrado.
    name: Optional[str] = None
    description: Optional[str] = None


class WalletRead(SQLModel):
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str] = None
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Wallet(SQLModel, table=True):
    __tablename__ = "wallets"

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

    is_default: bool = Field(
        default=False,
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
    user: "User" = Relationship(back_populates="wallets")
    wallet_rules: list["WalletRule"] = Relationship(back_populates="wallet")
    transaction_wallets: list["TransactionWallet"] = Relationship(back_populates="wallet")
