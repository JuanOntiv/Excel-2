"""Punto central de importacion de modelos.

SQLModel/SQLAlchemy resuelve las relaciones (Relationship(back_populates=...))
por nombre string contra un registro global de mappers. Ese registro solo se
completa a medida que se importan los modulos de modelos. Si un script o proceso
importa solo una tabla (ej. Category) sin importar las demas a las que apunta
(ej. User), la configuracion de los mappers falla.

Importar este paquete (import app.models) garantiza que TODOS los modelos queden
registrados. Usarlo desde scripts (seed_*), migraciones (env.py) y cualquier
lugar que instancie modelos de forma aislada.
"""

from app.models.users import User, UserCreate, UserUpdate, UserRead
from app.models.categories import (
    Category,
    CategoryType,
    CategoryCreate,
    CategoryUpdate,
    CategoryRead,
)
from app.models.wallets import (
    Wallet,
    WalletCreate,
    WalletUpdate,
    WalletRead,
)
from app.models.wallet_rules import (
    WalletRule,
    WalletRuleType,
    WalletRuleTransactionType,
    WalletRuleCreate,
    WalletRuleUpdate,
    WalletRuleRead,
)
from app.models.transactions import (
    Transaction,
    TransactionType,
    TransactionCreate,
    TransactionUpdate,
    TransactionRead,
)
from app.models.transactions_wallets import (
    TransactionWallet,
    AssignmentType,
    TransactionWalletCreate,
    TransactionWalletUpdate,
    TransactionWalletRead,
)
from app.models.recurring_transactions import (
    RecurringTransaction,
    RecurringTransactionType,
    RecurringTransactionFrequency,
    RecurringTransactionStatus,
    RecurringTransactionCreate,
    RecurringTransactionUpdate,
    RecurringTransactionRead,
)
from app.models.user_category_preferences import (
    UserCategoryPreference,
    UserCategoryPreferenceUpdate,
    UserCategoryPreferenceRead,
)
from app.models.goals import (
    Goal,
    GoalType,
    GoalStatus,
    GoalCreate,
    GoalUpdate,
    GoalRead,
    GoalProgressRead,
)
from app.models.logs import (
    Log,
    LogAction,
    LogLevel,
    LogCreate,
    LogRead,
)
from app.models.refresh_tokens import RefreshToken, RefreshTokenRead
from app.models.notifications import (
    Notification,
    NotificationType,
    NotificationCreate,
    NotificationRead,
)


__all__ = [
    "User", "UserCreate", "UserUpdate", "UserRead",
    "Category", "CategoryType", "CategoryCreate", "CategoryUpdate", "CategoryRead",
    "Wallet", "WalletCreate", "WalletUpdate", "WalletRead",
    "WalletRule", "WalletRuleType", "WalletRuleTransactionType",
    "WalletRuleCreate", "WalletRuleUpdate", "WalletRuleRead",
    "Transaction", "TransactionType", "TransactionCreate", "TransactionUpdate", "TransactionRead",
    "TransactionWallet", "AssignmentType",
    "TransactionWalletCreate", "TransactionWalletUpdate", "TransactionWalletRead",
    "RecurringTransaction", "RecurringTransactionType", "RecurringTransactionFrequency",
    "RecurringTransactionStatus", "RecurringTransactionCreate",
    "RecurringTransactionUpdate", "RecurringTransactionRead",
    "UserCategoryPreference", "UserCategoryPreferenceUpdate", "UserCategoryPreferenceRead",
    "Goal", "GoalType", "GoalStatus",
    "GoalCreate", "GoalUpdate", "GoalRead", "GoalProgressRead",
    "Log", "LogAction", "LogLevel", "LogCreate", "LogRead",
    "RefreshToken", "RefreshTokenRead",
    "Notification", "NotificationType", "NotificationCreate", "NotificationRead",
]
