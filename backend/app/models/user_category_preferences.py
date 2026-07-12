from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, UniqueConstraint
from sqlalchemy import String

if TYPE_CHECKING:
    from app.models.users import User
    from app.models.categories import Category


class UserCategoryPreferenceUpdate(SQLModel):
    is_hidden: Optional[bool] = None
    color: Optional[str] = None


class UserCategoryPreferenceRead(SQLModel):
    id: UUID
    user_id: UUID
    category_id: UUID
    is_hidden: bool
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserCategoryPreference(SQLModel, table=True):
    __tablename__ = "user_category_preferences"
    __table_args__ = (
            UniqueConstraint("user_id", "category_id", name="uq_user_category_preference"),
        )

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)

    user_id: UUID = Field(foreign_key="users.id", nullable=False)
    category_id: UUID = Field(foreign_key="categories.id", nullable=False)

    is_hidden: bool = Field(default=False, nullable=False)
    color: Optional[str] = Field(default=None, sa_column_kwargs={}, max_length=7)  # ej. "#0f766e"

    created_at: datetime = Field(default_factory=datetime.now, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.now, nullable=False)

    # Relationships
    user: "User" = Relationship()
    category: "Category" = Relationship(back_populates="user_preferences")
