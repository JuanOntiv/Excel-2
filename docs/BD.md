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



## Pendientes 
- Combinación de reglas con AND (ej. categoría X **y** monto > Y) en `Wallet_Rules`.
- Permitir al usuario definir frecuencias personalizadas en `Recurring_Transactions` (ej. "cada N días") en vez de solo el ENUM fijo.
- Posibilidad de ocultar categorías globales por usuario (`User_Hidden_Categories`).
- Validación de `Category.Type` vs `Transaction.Type` a nivel de BD (trigger), si se detectan múltiples puntos de inserción a futuro.
