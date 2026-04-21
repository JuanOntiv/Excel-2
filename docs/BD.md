# Users
- **ID - UUID - Primary key**
- Name
- Mail
- Password
- Is_Active - Bool


# Income
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Description
- Amount
- Date
- *category_id -  FK*
- *wallet_id - FK - Nullable (Null para wallet default, con ID para wallet default y wallet creada) *


# Egress
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Amount
- Date
- Description
- *category_id -  FK*
- *wallet_id - FK - Nullable (Null para wallet default, con ID para wallet default y wallet creada) *


# Categories
- **ID - UUID - PK**
- Name
- Type - ENUM (Ingresos, egresos o ambos)
- *user_id - FK - Nullable (NULL para todos, con ID es privada)*


# Recurring Transactions
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Description
- Amount
- Type (Income, Expense)
- Frecuency
- Start_date
- Next_Execution **
- *category_id -  FK*
- *wallet_id - FK - Nullable (Null para wallet default, con ID para wallet default y wallet creada) *
- Is_Active - Bool


# Wallets
- **ID - UUID - PK**
- *user_UUID - FK*
- Name
- Description
- Is_Default - Bool (Solo un True por user, para todos los ingresos y egresos)
 