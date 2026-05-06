from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
from sqlmodel import SQLModel, Field, Column, Relationship, Session, create_engine
from sqlalchemy import String, BOOLEAN
from typing import Optional


class WalletCreate(SQLModel):
    name: str
    description: str
    is_default: bool


class WalletUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None


class WalletRead(SQLModel):
    id: UUID
    user_id: UUID
    name: str
    description: str
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
        foreign_key="user.id", nullable=False
    )
    users: "Users" = Relationship(back_populates="wallets")

    name: str = Field(
        sa_column=Column(String(150),
        nullable=False)
    )

    description: str = Field(
        sa_column=Column(String(150),
        nullable=False)
    )

    is_default: bool = Field(
        default=True,
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
    users: list["Users"] = Relationship(back_populates="wallets")
    incomes: list["Incomes"] = Relationship(back_populates="wallets")
    egress: list["Egress"] = Relationship(back_populates="wallets")
    transactions: list["Transactions"] = Relationship(back_populates="wallets")
