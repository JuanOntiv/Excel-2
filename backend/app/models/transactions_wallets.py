from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.transactions import Transaction
    from app.models.wallets import Wallet
    from app.models.wallet_rules import WalletRule


class AssignmentType(str, Enum):
    MANUAL = "Manual"
    RULE = "Rule"


class TransactionWalletCreate(SQLModel):
    transaction_id: UUID
    wallet_id: UUID
    assignment_type: AssignmentType
    rule_id: Optional[UUID] = None


class TransactionWalletUpdate(SQLModel):
    wallet_id: Optional[UUID] = None
    assignment_type: Optional[AssignmentType] = None
    rule_id: Optional[UUID] = None


class TransactionWalletRead(SQLModel):
    id: UUID
    transaction_id: UUID
    wallet_id: UUID
    assignment_type: AssignmentType
    rule_id: Optional[UUID] = None
    created_at: datetime


class TransactionWallet(SQLModel, table=True):
    __tablename__ = "transaction_wallets"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    transaction_id: UUID = Field(
        foreign_key="transactions.id", nullable=False
    )

    wallet_id: UUID = Field(
        foreign_key="wallets.id", nullable=False
    )

    assignment_type: AssignmentType = Field(
        nullable=False
    )

    # Nullable: solo aplica si assignment_type == RULE
    rule_id: Optional[UUID] = Field(
        default=None, foreign_key="wallet_rules.id", nullable=True
    )

    created_at: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    # Relationships
    transaction: "Transaction" = Relationship(back_populates="transaction_wallets")
    wallet: "Wallet" = Relationship(back_populates="transaction_wallets")
    rule: Optional["WalletRule"] = Relationship(back_populates="transaction_wallets")

    # NOTA: la restriccion "solo una asignacion Manual por transaccion" se
    # implementa con un indice unico parcial en la migracion de Postgres,
    # no se puede expresar como constraint de SQLModel/columna:
    # CREATE UNIQUE INDEX one_manual_per_transaction
    # ON transaction_wallets (transaction_id) WHERE assignment_type = 'Manual';
