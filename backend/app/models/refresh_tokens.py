from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.users import User


class RefreshTokenRead(SQLModel):
    id: UUID
    user_id: UUID
    expires_at: datetime
    revoked: bool
    created_at: datetime


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )

    user_id: UUID = Field(
        foreign_key="users.id", nullable=False
    )

    # Nunca se guarda el token en texto plano, solo su hash (sha256).
    # Esto evita que, si la BD se filtra, alguien pueda usar los tokens
    # directamente.
    token_hash: str = Field(
        nullable=False, index=True, unique=True
    )

    expires_at: datetime = Field(
        nullable=False
    )

    revoked: bool = Field(
        default=False,
        nullable=False
    )

    created_at: datetime = Field(
        default_factory=datetime.now,
        nullable=False
    )

    # Relationships
    user: "User" = Relationship(back_populates="refresh_tokens")
