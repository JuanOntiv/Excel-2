# Claude Context File — Finanzas Project

This file exists so that a future Claude session (or this one, resumed later) can get up to speed quickly without re-deriving decisions already made. It's written for an AI assistant picking up development work, not for a human contributor (see `PROJECT_GUIDE.md` for that).

## What this project is

A full-stack personal finance manager. Success criteria: a deployed, production-quality app. Backend was built first and is functionally complete; frontend was built section-by-section afterward, **never guess field names or endpoint shapes; ask for the actual model/route file first.** This was violated once early on (assumed `email` instead of `mail`, assumed `/auth/me` instead of `/users/me`) and cost a wasted round-trip. Don't repeat that.

## Stack

- **Backend**: FastAPI, SQLModel, PostgreSQL, Alembic, Docker Compose, bcrypt (direct, not via `passlib` — compatibility issues with modern bcrypt), JWT (access + refresh, refresh tokens stored as SHA-256 hashes, rotated on use)
- **Frontend**: React + TypeScript + Vite, Tailwind CSS **v4** (not v3 — this matters, see below), Zustand (transaction/filter state), Context API (auth, theme only), Recharts, React Router, Axios
- **Docker-first**: everything runs via `docker compose`; migrations run via `docker compose exec backend alembic ...` from the host.

## Critical gotchas (things that will bite you if forgotten)

1. **Tailwind v4, not v3.** No `tailwind.config.js` content array, no `postcss.config.js`. Setup is `@tailwindcss/vite` plugin in `vite.config.ts` + `@import "tailwindcss";` in `index.css`. Dark mode requires the explicit line `@custom-variant dark (&:where(.dark, .dark *));` in `index.css` — without it, Tailwind follows OS `prefers-color-scheme` instead of the `.dark` class the app's `ThemeContext` toggles. This already caused a real bug (everything went black because dark mode was OS-driven, not app-driven).

2. **Login is form-encoded, not JSON.** `POST /auth/login` uses `OAuth2PasswordRequestForm` (FastAPI/Swagger convention), so the frontend must send `application/x-www-form-urlencoded` with fields `username` (holds the email) and `password`. See `src/api/auth.ts`.

3. **User id is a UUID (string), not a number.** All entity IDs across the app are UUIDs.

4. **The user's email field is `mail`, not `email`.** Ties into `User`, `TokenResponse`, login body, etc.

5. **User profile endpoint is `GET /users/me`, not `/auth/me`.** Registration is `POST /users/register`, not `/auth/register`.

6. **The wallet "default" concept is split into two unrelated things:**
   - The *implicit* default wallet = all of a user's transactions, with no row in the `wallets` table at all. It's just "no wallet filter applied."
   - The `is_default: bool` column on `Wallet` = a marker the user can put on one of their **custom** wallets — originally ambiguous with the concept above, being resolved (per Juan, "at half" as of last check-in — confirm current state before touching wallet code). Do not conflate these two concepts in any future wallet feature.

7. **Category visibility (`is_hidden`) is NOT a column on `Category`.** It lives in a separate `UserCategoryPreference` table (`user_category_preferences`), keyed by `(user_id, category_id)`, because `Category` rows can be **global** (`user_id = null`, shared across all users) — putting `is_hidden` directly on `Category` would hide it for every user at once. This was caught and fixed before it shipped; don't reintroduce it. Same table also holds `color` (per-user custom color for a category, including global ones).

8. **Visibility (`is_hidden`) vs. deletion (`is_active`) are different concerns, and only apply to different scopes:**
   - `is_active` on `Category`/`Transaction`/`Wallet`/etc. = real soft-delete, only possible on rows the user *owns* (not global categories).
   - `is_hidden` (via `UserCategoryPreference`) = per-user visibility toggle, possible on **any** visible category including global ones, because it doesn't touch the category itself.

9. **Recurring transactions have their own domain vocabulary**, distinct from regular transactions — don't reuse `TransactionsView` patterns for them:
   - `status`: active / paused / cancelled (cancel = soft business state, distinct from `is_active` hard soft-delete)
   - `auto_execute`: if true, `POST /recurring-transactions/execute-pending` (called automatically on login, see `AuthContext.login`) creates the actual `Transaction` once `next_execution` is due. If false, it sits in "pending confirmation" (`GET /recurring-transactions/pending-confirmation/list`) until the user manually confirms via `POST /{id}/execute`.
   - Editing type/frequency/start_date on an existing recurring transaction is currently **disabled** in the frontend form — changing those mid-flight raises unresolved questions about how `next_execution` should be recalculated. If asked to enable this, get an explicit decision on that recalculation behavior first.

10. **Wallet rules (`WalletRule`) are polymorphic by `rule_type`.** Only the fields relevant to the chosen `rule_type` (`Category`, `TransactionType`, `Keyword`, `DateRange`, `AmountRange`) are populated; the rest stay null. The frontend form switches visible fields based on `rule_type` and disables changing `rule_type` on an existing rule (same reasoning as #9 — mixing stale fields from a different rule_type is a footgun). The backend validates this server-side in `_validate_rule_fields`.

11. **Currency formatting is centralized** in `src/utils/date.ts` (`formatCurrency`), currently hardcoded to `MXN`. If this needs to change or become configurable, this is the only place to touch.

## Known backend bugs found & fixed during frontend integration

- `TransactionCreate.categoty_id` (typo) vs. route using `trx_in.category_id` → fixed to `category_id` in the model.
- CORS was completely unconfigured → added `CORSMiddleware` in `main.py`.
- Docker Compose mapped port 3000 but Vite defaults to 5173 → resolved by pinning Vite's `server.port` to 3000 to match the existing compose file, rather than changing the compose file.
- `update_my_profile` set `current_user.password_hash` but the model's real column is `password` → fixed (per Juan, already applied).
- No endpoint existed to compute income/expense totals → added `GET /transactions/summary`.
- No way to filter transactions by `type` → added `type` query param to `GET /transactions`.

## Color system

Defined via Tailwind v4 `@theme` block in `src/index.css`, using semantic token names rather than raw Tailwind palette colors (deliberately avoiding pure white/black and cold grays per Juan's preference):
- `surface-light` / `surface-dark` — page background
- `surface-elevated-light` / `surface-elevated-dark` — cards, sidebar, modals
- `ink-light` / `ink-dark` — primary text
- `ink-muted-light` / `ink-muted-dark` — secondary text
- `line-light` / `line-dark` — borders
- `accent` / `accent-soft` / `accent-dark` — primary brand color (teal-based, not the generic terracotta/blue defaults)
- `positive` / `negative` — semantic states (income/expense, success/error)

When adding new UI, use these tokens (`bg-surface-elevated-light dark:bg-surface-elevated-dark`, etc.), not raw `gray-*`/`white`/`black`. Older components (built before this palette existed — Login, Register, initial Sidebar/AppShell version) may still have unmigrated raw Tailwind gray classes; check before assuming consistency.

## Frontend architecture map — where to look for what

```
src/
├── api/                  # One file per backend resource. Axios calls only, no business logic.
│   ├── client.ts          # Axios instance + JWT interceptor (attach token, auto-refresh on 401)
│   ├── auth.ts            # login (form-encoded!), refresh, logout, register
│   ├── users.ts           # profile update, account deactivation
│   ├── categories.ts       # CRUD + /preferences endpoint (hide/color)
│   ├── transactions.ts     # CRUD, filtered by type/category/wallet/date
│   ├── recurring.ts        # CRUD + pause/resume/execute/execute-pending
│   ├── wallets.ts          # CRUD
│   └── walletRules.ts      # CRUD, polymorphic payload by rule_type
├── context/
│   ├── AuthContext.tsx     # user, login, logout, refreshUser — also fires executePending() on login
│   └── ThemeContext.tsx    # light/dark toggle, persisted to localStorage + <html class="dark">
├── hooks/
│   └── useTransactionsByType.ts   # shared data-fetching hook behind TransactionsView
├── components/
│   ├── layout/             # Sidebar (desktop), BottomNav + MobileHeader (mobile), AppShell (wraps both)
│   ├── transactions/       # TransactionsView (generic, parametrized by type) + its subcomponents
│   │                         (MonthlyChart, CategoryPieChart, HighlightCards, TransactionTable, TransactionFormModal)
│   ├── recurring/          # StatusBadge, PendingConfirmationBanner, RecurringFormModal, RecurringTable
│   ├── categories/         # CategoryFormModal
│   ├── wallets/            # WalletFormModal, WalletRuleFormModal, WalletRulesPanel
│   └── dashboard/          # SummaryCard (reused by both Dashboard and TransactionsView's HighlightCards)
├── pages/                  # One per route; most are thin wrappers around the components above
├── routes/
│   └── ProtectedRoute.tsx  # Redirects to /login if not authenticated
├── types/index.ts          # All shared TS interfaces/types — check here first before assuming a field name
└── utils/date.ts           # Date range helpers + formatCurrency (MXN, centralized)
```

**Key reusability decision**: `TransactionsView` is generic over `type: "income" | "expense"` and used by both `Income.tsx` and `Expenses.tsx` — do not duplicate this component. Recurring and Wallets intentionally do **not** share this component; they have different domain concerns (see gotchas #9–10).

## Things that are known-incomplete or intentionally deferred

See `TODO.md` for the full, current list — don't assume anything below is still accurate without checking that file first, since it will be updated over time and this context file may not be.
