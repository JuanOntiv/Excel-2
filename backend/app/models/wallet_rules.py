from datetime import date as date_type, datetime
from uuid import UUID, uuid4
from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, DECIMAL, Date

if TYPE_CHECKING:
    from users import User
    from wallets import Wallet
    from categories import Category
    from transactions_wallets import TransactionWallet


class WalletRuleType(str, Enum):
	CATEGORY = "Category"
	TRANSACTION_TYPE = "TransactionType"
	KEYWORD = "Keyword"
	DATE_RANGE = "DateRange"
	AMOUNT_RANGE = "AmountRange"


class WalletRuleTransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


# Todos los campos de criterio son opcionales porque cada regla
# solo usa el set de campos correspondiente a su rule_type:
class WalletRuleCreate(SQLModel):
    wallet_id: UUID
    rule_type: WalletRuleType
    category_id: Optional[UUID] = None
    transaction_type: Optional[WalletRuleTransactionType] = None
    keyword: Optional[str] = None
    date_from: Optional[date_type] = None
    date_to: Optional[date_type] = None
    amount_from: Optional[float] = None
    amount_to: Optional[float] = None



class WalletRuleUpdate(SQLModel):
    wallet_id: Optional[UUID] = None
    rule_type: Optional[WalletRuleType] = None
    category_id: Optional[UUID] = None
    transaction_type: Optional[WalletRuleTransactionType] = None
    keyword: Optional[str] = None
    date_from: Optional[date_type] = None
    date_to: Optional[date_type] = None
    amount_from: Optional[float] = None
    amount_to: Optional[float] = None
    is_active: Optional[bool] = None


class WalletRuleRead(SQLModel):
    id: UUID
    user_id: UUID
    wallet_id: UUID
    rule_type: WalletRuleType
    category_id: Optional[UUID] = None
    transaction_type: Optional[WalletRuleTransactionType] = None
    keyword: Optional[str] = None
    date_from: Optional[date_type] = None
    date_to: Optional[date_type] = None
    amount_from: Optional[float] = None
    amount_to: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class WalletRule(SQLModel, table=True):
    __tablename__ = "wallet_rules"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="users.id", nullable=False
    )

    wallet_id: UUID = Field(
        foreign_key="wallets.id", nullable=False
    )

    rule_type: WalletRuleType = Field(
        nullable=False
    )

    category_id: UUID = Field(
    	default=None,
        foreign_key="categories.id",
        nullable=True
    )

    transaction_type: Optional[WalletRuleTransactionType] = Field(
        default=None, nullable=True
    )

    keyword: Optional[str] = Field(
        default=None,
        sa_column=Column(String(150), nullable=True)
    )

    date_from: Optional[date_type] = Field(
    	default=None, sa_column=Column(Date, nullable=True)
    )
    date_to: Optional[date_type] = Field(
        default=None, sa_column=Column(Date, nullable=True)
    )

    amount_from: Optional[float] = Field(
        default=None, sa_column=Column(DECIMAL(10, 2), nullable=True)
    )
    amount_to: Optional[float] = Field(
        default=None, sa_column=Column(DECIMAL(10, 2), nullable=True)
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
    user: "User" = Relationship(back_populates="wallet_rules")
    wallet: "Wallet" = Relationship(back_populates="wallet_rules")
    category: Optional["Category"] = Relationship(back_populates="wallet_rules")
    transaction_wallets: list["TransactionWallet"] = Relationship(back_populates="rule")
