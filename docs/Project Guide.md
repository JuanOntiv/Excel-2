# Project Guide

This document is for a person (not an AI assistant) who is new to this codebase and wants to understand how it's organized, why it's organized that way, and where to make changes. If you're looking for setup instructions, see `README.md`. If you're an AI assistant picking up this project, see `CLAUDE_CONTEXT.md` instead — it's denser and assumes a different kind of reader.


## The big picture

This is a personal finance tracker: users log in, record income and expenses, set up recurring transactions (like rent or a subscription), organize transactions into "wallets" (think: sub-accounts or budgets), and manage the categories used to classify everything.

The project is split into two independent codebases that only talk to each other over HTTP:

```
backend/    → FastAPI + PostgreSQL. Owns all data and business rules.
frontend/   → React + TypeScript. A client that consumes the backend's API.
docker/      → Glues both together for local development.
```

This separation means you can, in principle, throw away the frontend and build a completely different client (mobile app, CLI, another web framework) against the same backend without touching a single backend file. That's the whole point of an API-first design.


## Backend: `backend/app/`

The backend follows a fairly standard layered structure:

- **`models/`** — one file per entity (e.g. `transactions.py`, `wallets.py`, `categories.py`). Each file defines:
  - The **table model** (e.g. `Transaction`) — this is the actual database table.
  - **Read/Create/Update schemas** (e.g. `TransactionRead`, `TransactionCreate`, `TransactionUpdate`) — these are what the API actually accepts and returns. They exist separately from the table model so that, for example, a `Create` schema doesn't require an `id` (the database generates it) and a `Read` schema can include computed fields that don't exist as real columns (see the note on `Category.is_hidden` below).

  **If you want to change what fields an entity has, start here.**

- **`routes/`** — one file per entity, defining the actual HTTP endpoints (`GET`, `POST`, `PATCH`, `DELETE`) and the business rules around them: who's allowed to do what, and in what order things happen. For example, `routes/transactions.py` validates that a transaction's category matches its type (income/expense) before allowing it to be created.

  **If you want to change what happens when an action is performed (a new validation rule, a new side effect), this is where to look.**

- **`auth/`** — JWT creation/validation and the `get_current_user`/`get_current_admin` dependencies that routes use to figure out who's making the request.

- **`services/`** — logic that's too involved to live directly in a route, and might be reused across routes. Currently this is where wallet-rule matching lives (`wallet_assignment.py`): when a transaction is created or edited, this service figures out which wallets it should belong to, based on the active rules.

- **`scripts/`** — one-off maintenance scripts, run manually via `docker compose exec backend python -m app.scripts.<name>`. Not part of the live API. Example: `seed_categories.py`, which populates the shared/global categories every new user starts with.

### Why some categories are "global" and don't belong to any user

A `Category` can have `user_id = null`. These are categories every user sees by default (e.g. "Groceries", "Salary") and nobody can edit or delete them — they're maintained centrally via the seed script. Users can still create their own private categories on top of these.

### Why hiding a category isn't the same as deleting it

If a user wants to stop seeing a category (maybe they never use "Pet Supplies"), we don't want to delete it — especially not if it's a *global* category shared by everyone else. Deleting it would break it for other users, and even for the same user, deleting removes past transaction history's ability to display a category name cleanly.

So instead, hiding is tracked in a separate table, `UserCategoryPreference`, which says "this specific user has this specific preference about this specific category" (hidden, or a custom display color). This keeps the shared `Category` table untouched no matter what any individual user does to their own view of it.


## Frontend: `frontend/src/`

- **`api/`** — every function that talks to the backend lives here, one file per resource, mirroring the backend's `routes/` structure. This is a deliberate boundary: components should never call `axios` directly, they should call a function from `api/`. That way, if an endpoint's shape changes, there's exactly one place to fix it.

- **`context/`** — global app state that changes rarely: who's logged in (`AuthContext`) and light/dark theme (`ThemeContext`). Kept in React Context because the whole app needs it, but it doesn't change often enough to need a heavier state library.

- **`components/`** — organized by feature area, not by component "type". So all the pieces related to displaying and editing transactions live in `components/transactions/`, all the pieces for wallets live in `components/wallets/`, etc. If you're working on a feature, everything for it should be in one folder.

  A notable pattern here: **`TransactionsView`** is one component used for both the Income and Expenses pages — it's told which type it's displaying and behaves accordingly, instead of having two nearly-identical copies of the same page. If you're adding a feature to how income/expenses are displayed, you almost certainly want to edit `TransactionsView.tsx` and its subcomponents, not `pages/Income.tsx` or `pages/Expenses.tsx` directly (those files are intentionally tiny).

  Recurring transactions and Wallets are **not** built with `TransactionsView` — they have their own components, because they represent fundamentally different kinds of things (a recurring transaction is a *rule* that generates future transactions, not a transaction itself; a wallet is a grouping mechanism, not something with its own income/expense history).

- **`pages/`** — one file per route, generally thin. Most of the actual UI logic lives in `components/`; a page mostly just wires components + data together.

- **`hooks/`** — reusable pieces of stateful logic that don't belong to any one component. Currently just the hook that fetches and filters transactions by type.

- **`types/index.ts`** — every TypeScript type used across the app lives in this single file. If you're not sure what fields an entity has on the frontend, this is the fastest place to check (and it should always match what the backend's `*Read` schema actually returns).


## Why Docker

Everything (database, backend, frontend) runs in containers defined by `docker/docker-compose.yml`. This means you don't need PostgreSQL or a specific Python/Node version installed on your machine — you just need Docker. It also means the project runs the same way on any machine, which matters both for collaboration and for eventual deployment.

## If you want to add a new feature end-to-end

A reasonable order to work in, based on how this project was actually built:

1. Design the data model (`backend/app/models/<thing>.py`) and generate a migration.
2. Build the routes (`backend/app/routes/<thing>.py`) and manually test them via `/docs` (FastAPI's built-in Swagger UI) before touching the frontend.
3. Add the types to `frontend/src/types/index.ts`.
4. Add the API functions to `frontend/src/api/<thing>.ts`.
5. Build the components in `frontend/src/components/<thing>/`.
6. Wire it into a page in `frontend/src/pages/`, and register the route in `App.tsx`.

Building backend-first and verifying it manually before writing any frontend code avoids the most common source of bugs in this project so far: the frontend assuming a field name or endpoint shape that doesn't match what the backend actually does.
