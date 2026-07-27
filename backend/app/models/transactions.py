from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, DECIMAL, Date
from typing import Optional, TYPE_CHECKING
from enum import Enum

# Import en runtime (no TYPE_CHECKING) porque la property wallet_id lo evalua.
# No hay ciclo: transactions_wallets solo importa este modulo bajo TYPE_CHECKING.
from app.models.transactions_wallets import AssignmentType

if TYPE_CHECKING:
    from app.models.users import User
    from app.models.categories import Category
    from app.models.transactions_wallets import TransactionWallet


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionCreate(SQLModel):
    name: str
    description: Optional[str] = None
    amount: float
    date: datetime
    type: TransactionType
    category_id: UUID
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
	wallet_id: Optional[UUID] = None  # cartera asignada manualmente (ver property en Transaction)
	is_active: bool
	created_at: datetime
	updated_at: datetime


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="users.id", nullable=False
    )

    name: str = Field(
        sa_column=Column(
        	String(150),
         	nullable=False
        )
    )

    description: Optional[str] = Field(
    	default=None,
        sa_column=Column(
        	String(250),
         	nullable=True
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

    @property
    def wallet_id(self) -> Optional[UUID]:
        """Cartera asignada MANUALMENTE, o None si no tiene.

        Las asignaciones por regla quedan fuera a proposito: son derivadas,
        puede haber varias, y no son lo que el usuario eligio en el formulario.
        Sirve para pre-llenar el form de edicion en el frontend.

        Ojo: quien liste transacciones debe usar selectinload(transaction_wallets)
        o esto provoca un N+1 (ver list_transactions).
        """
        for assignment in self.transaction_wallets:
            if assignment.assignment_type == AssignmentType.MANUAL:
                return assignment.wallet_id
        return None
