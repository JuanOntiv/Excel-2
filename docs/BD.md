Todas las tablas incluyen `is_active` (Bool, borrado lógico), `created_at` (Timestamp) y `updated_at` (Timestamp).

# Users
- **ID - UUID - PK**
- Name
- Mail
- Password


# Transactions
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Description
- Amount
- Date
- Type - ENUM (Income, Expense)
- *category_id -  FK*


# Categories
- **ID - UUID - PK**
- Name
- Type - ENUM (Income, Expense, Both)
- *user_id - FK - Nullable (NULL para todos, con ID es privada)*
** una `Transaction` solo puede usar una `Category` si `Category.Type == Transaction.Type` o `Category.Type == 'Both'`. Se valida en la capa de aplicación (no a nivel de BD por ahora).


# User_Category_Preferences
- **ID - UUID - PK**
- *user_UUID - FK*
- *category_UUID - FK*
- Is_Hidden - Bool - Default false
- Color - String(7) - Nullable (ej. "#0f766e")
- UNIQUE(user_id, category_id)
** existe para no pisar visibilidad/color entre usuarios en categorías globales (`Category.user_id IS NULL`): poner `is_hidden`/`color` directamente en `Category` las afectaría para todos los usuarios a la vez.


# Recurring Transactions
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Description
- Amount
- Type (Income, Expense)
- Frecuency ENUM (Daily, Weekly, Biweekly, Monthly, Yearly)
- Start_date
- Next_Execution
- Last_Executed - Nullable
- Status - ENUM (Active, Paused, Cancelled)
- Auto_Execute - Bool - Default true. Si false, requiere confirmación manual del usuario antes de generar la transacción real
- *category_id -  FK*


# Wallets
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Description
- Is_Default - Bool (Solo un True por user)
 

# Wallets_Rules
- **ID - UUID - PK**
- *user_UUID - FK*
- *wallet_UUID - FK*
- Rule_type - ENUM (Category, TransactionType, Keyword, DateRange, AmountRange)
- *category_id - FK - Nullable*
- *transaction_type - ENUM (Income, Expense) - Nullable*
- keyword - Text - Nullable
- *category_id - FK - Nullable*
- date_from - Nullable
- date_to - Nullable
- amount_from - Nullable
- amount_to - Nullable
`is_active` permite desactivar una regla sin borrarla (deja de generar nuevas asignaciones y borra las existentes generadas por ella


# Transaction_Wallets
- **ID - UUID - PK**
- *transaction_UUID - FK*
- *wallet_UUID - FK*
- Assignment_type - ENUM (Manual, Rule)
- *rule_id - FK - Nullable*
- created_at - Timestamp


# Refresh_Tokens
- **ID - UUID - PK**
- *user_UUID - FK*
- Token_Hash - String - Unique (solo se guarda el hash SHA-256, nunca el token en texto plano)
- Expires_At - Timestamp
- Revoked - Bool - Default false
- created_at - Timestamp
** sin `updated_at`/`is_active` propios: un refresh token no se edita, se rota (se revoca y se crea uno nuevo).


# Logs
- **ID - UUID - PK**
- *user_UUID - FK - Nullable (acciones no autenticadas, ej. login fallido)*
- Action - ENUM (Create, Read, Update, Delete, Login, Logout)
- Level - ENUM (Info, Warning, Error, Security) - Default Info
- Table - String(50) - Nullable
- Detail - String(500) - Nullable
- created_at - Timestamp
** sin `updated_at`/`is_active`: los logs son append-only.


# Goals
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Description - Nullable
- Goal_Type - ENUM (Income, Expense_Limit, Savings)
- Target_Amount
- Start_Date
- End_Date
- *wallet_id - FK - Nullable (NULL = todas las transacciones, wallet default implícita)*
- *category_id - FK - Nullable (NULL = todas las categorías)*
- Status - ENUM (Active, Achieved, Failed, Cancelled)
** el progreso (`current_amount`, `percentage`, etc.) se calcula al vuelo a partir de las transacciones del rango/wallet/categoría — no se persiste.

