from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
from sqlmodel import SQLModel, Field, Column, Relationship, Session, create_engine
from sqlalchemy import String, Enum
from typing import Optional

# To use with ENUM
class CategoryType(str, Enum):
    INGRESS = "ingress"
    EGRESS = "egress"
    BOTH = "both"


class CategoryCreate(SQLModel):
    name: str
    type: CategoryType
    # user_id: UUID #pero no se si va o no


class CategoryUpdate(SQLModel):
    name: Optional[str] = None
    type: Optional[CategoryType] = None
    is_active: Optional[bool] = None
    # user_id: Optional[UUID] = None


class CategoryRead(SQLModel):
    user_id: UUID
    id: UUID
    name: str
    type: CategoryType
    wallet_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Category(SQLModel, table=True):
    __tablename__ = "categories"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="user.id", nullable=True
    )
    users: "Users" = Relationship(back_populates="categorys")

    type: CategoryType = Field(
        nullable=False
    )

    wallet_id: UUID = Field(
        foreign_key="wallet.id", nullable=True
    )
    wallets: "Wallets" = Relationship(back_populates="categorys")

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
    users: list["Users"] = Relationship(back_populates="categorys")
    incomes: list["Incomes"] = Relationship(back_populates="categorys")
    egress: list["Egress"] = Relationship(back_populates="categorys")
    transactions: list["Transactions"] = Relationship(back_populates="categorys")
