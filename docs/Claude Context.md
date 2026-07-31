# Claude Context File — Finanzas Project

This file exists so that a future Claude session (or this one, resumed later) can get up to speed quickly without re-deriving decisions already made. It's written for an AI assistant picking up development work, not for a human contributor (see `PROJECT_GUIDE.md` for that).

## What this project is

A full-stack personal finance manager. Success criteria: a deployed, production-quality app. Backend was built first and is functionally complete; frontend was built section-by-section afterward, **never guess field names or endpoint shapes; ask for the actual model/route file first.** This was violated once early on (assumed `email` instead of `mail`, assumed `/auth/me` instead of `/users/me`) and cost a wasted round-trip. Don't repeat that.

## Stack

- **Backend**: FastAPI, SQLModel, PostgreSQL, Alembic, Docker Compose, bcrypt (direct, not via `passlib` — compatibility issues with modern bcrypt), JWT (access + refresh, refresh tokens stored as SHA-256 hashes, rotated on use), `openpyxl` (server-side XLSX generation for the transactions export)
- **Frontend**: React + TypeScript + Vite, Tailwind CSS **v4** (not v3 — this matters, see below), Zustand (in-memory store layer for all entity data — see gotcha #13), Context API (auth, theme, toast, confirm, notifications), Recharts, React Router, Axios
- **Docker-first**: everything runs via `docker compose`; migrations run via `docker compose exec backend alembic ...` from the host.

## Critical gotchas (things that will bite you if forgotten)

1. **Tailwind v4, not v3.** No `tailwind.config.js` content array, no `postcss.config.js`. Setup is `@tailwindcss/vite` plugin in `vite.config.ts` + `@import "tailwindcss";` in `index.css`. Dark mode requires the explicit line `@custom-variant dark (&:where(.dark, .dark *));` in `index.css` — without it, Tailwind follows OS `prefers-color-scheme` instead of the `.dark` class the app's `ThemeContext` toggles. This already caused a real bug (everything went black because dark mode was OS-driven, not app-driven).

2. **Login is form-encoded, not JSON.** `POST /auth/login` uses `OAuth2PasswordRequestForm` (FastAPI/Swagger convention), so the frontend must send `application/x-www-form-urlencoded` with fields `username` (holds the email) and `password`. See `src/api/auth.tsx`.

3. **User id is a UUID (string), not a number.** All entity IDs across the app are UUIDs.

4. **The user's email field is `mail`, not `email`.** Ties into `User`, `TokenResponse`, login body, etc.

5. **User profile endpoint is `GET /users/me`, not `/auth/me`.** Registration is `POST /users/register`, not `/auth/register`.

6. **The wallet "default" concept is resolved — it's a real row, not purely implicit.** `create_default_wallet()` (`app/services/wallets.py`) runs once at registration and materializes an actual `Wallet` row (name "General", `is_default=True`). `GET /wallets` returns it alongside custom wallets; `Wallets.tsx` renders it with a star icon, no delete button, and no rules panel (rules don't apply to it — it's not rule-assignable, it's just "everything"). Its balance is still computed on the fly from transactions, never cached on the row. Only one `is_default=True` row should ever exist per user — don't add a second path that creates one.

7. **Category visibility (`is_hidden`) is NOT a column on `Category`.** It lives in a separate `UserCategoryPreference` table (`user_category_preferences`), keyed by `(user_id, category_id)`, because `Category` rows can be **global** (`user_id = null`, shared across all users) — putting `is_hidden` directly on `Category` would hide it for every user at once. This was caught and fixed before it shipped; don't reintroduce it. Same table also holds `color` (per-user custom color for a category, including global ones).

8. **Visibility (`is_hidden`) vs. deletion (`is_active`) are different concerns, and only apply to different scopes:**
   - `is_active` on `Category`/`Transaction`/`Wallet`/etc. = real soft-delete, only possible on rows the user *owns* (not global categories).
   - `is_hidden` (via `UserCategoryPreference`) = per-user visibility toggle, possible on **any** visible category including global ones, because it doesn't touch the category itself.

9. **Recurring transactions have their own domain vocabulary**, distinct from regular transactions — don't reuse `TransactionsView` patterns for them:
   - `status`: active / paused / cancelled (cancel = soft business state, distinct from `is_active` hard soft-delete)
   - `auto_execute`: if true, `POST /recurring-transactions/execute-pending` (called automatically on login, see `AuthContext.login`) creates the actual `Transaction` once `next_execution` is due. If false, it sits in "pending confirmation" (`GET /recurring-transactions/pending-confirmation/list`) until the user manually confirms via `POST /{id}/execute`.
   - Editing type/frequency/start_date on an existing recurring transaction is currently **disabled** in the frontend form — changing those mid-flight raises unresolved questions about how `next_execution` should be recalculated. If asked to enable this, get an explicit decision on that recalculation behavior first.

10. **Wallet rules (`WalletRule`) are polymorphic by `rule_type`.** Only the fields relevant to the chosen `rule_type` (`Category`, `TransactionType`, `Keyword`, `DateRange`, `AmountRange`) are populated; the rest stay null. The frontend form switches visible fields based on `rule_type` and disables changing `rule_type` on an existing rule (same reasoning as #9 — mixing stale fields from a different rule_type is a footgun). The backend validates this server-side in `_validate_rule_fields`.

11. **Currency formatting is centralized** in `src/utils/date.tsx` (`formatCurrency`), currently hardcoded to `MXN`. If this needs to change or become configurable, this is the only place to touch.

12. **In FastAPI/Starlette, a static path and a dynamic `{param}` path at the same segment depth are matched in registration order, not by specificity.** `router.get("/{transaction_id}")` will happily swallow a request to `/summary` or `/export` if it's registered first — Starlette doesn't backtrack to try a later, better-matching route. `GET /transactions/summary` was already registered after `GET /transactions/{transaction_id}` before this was noticed; when the export endpoint was added (`GET /transactions/export`), it was deliberately placed *before* `/{transaction_id}` to avoid the same trap. Any new static sub-route under an existing resource router must go above the `{id}` routes, not below.

13. **All entity data flows through an in-memory Zustand store layer (`src/store/`). Do not add a direct API call in a component.** Added 2026-07-30 to stop the same data being refetched by every view (entering Income used to cost 3 requests, switching period 2 more, switching to Expenses 3 more — all identical data).
    - Four stores: `transactionsStore`, `categoriesStore`, `walletsStore`, `goalsStore`. Each exposes `bootstrap()` (idempotent — safe to call on every mount), `refresh()`, `reset()`, and CRUD methods that mutate the in-memory copy instead of refetching.
    - `AppShell` calls all four `bootstrap()`s on mount; `AuthContext.logout` calls all four `reset()`s. **Adding a fifth store means touching both places** — miss the reset and the next user in the same browser session sees the previous user's data.
    - **In memory only.** No `localStorage`/`sessionStorage`/HTTP cache — a page reload refetches everything. This was a deliberate call by Juan (simplicity over persistence); don't add persistence without asking.
    - `transactionsStore` loads in batches of 500 and exposes `status: "partial"` while later batches are still arriving. **Anything that computes a total must wait for `"ready"`**, not `"partial"` — a total over a partial set looks exactly like a correct total. `Dashboard` gates on this; copy that pattern.
    - Read via the hooks (`useCategories`, `useWallets`, `useTransactionsByType`, `useAllTransactionsByType`, `useWalletTransactions`) and the pure selectors in `store/selectors.ts`, not by subscribing to raw store state in every component.

14. **The in-memory cache goes stale on server-side cascades, and it fails silently. Two known cascades — look for more before adding a mutation.**
    - **Wallet rules → transaction assignments.** Creating/editing a rule runs `recalculate_assignments_for_rule`, which rewrites `transaction_wallets` for **every** transaction the user owns; deleting runs `remove_assignments_for_rule`. None of that touches the transaction rows themselves, so nothing signals the frontend. `WalletRulesPanel` therefore calls `useTransactionsStore.getState().refresh()` after every rule mutation. This was a real shipped bug: WalletDetail showed the wrong movements until a page reload.
    - **Transactions → goal progress/status.** Writing a transaction changes every goal's computed progress, and `evaluate_goal_completions` can flip a goal to `ACHIEVED`/`FAILED` on the spot. `transactionsStore`'s create/update/remove call `useGoalsStore.getState().revalidate()` (a silent refetch that doesn't flash a loading state).
    - The general rule: if a backend write has effects **beyond the row being written**, the store holding those other rows must be invalidated explicitly. Grep the service layer for what a route calls before assuming a mutation is local.

15. **Goal progress is computed server-side and must stay there.** `GET /goals/` returns it inline (`GoalProgressRead`, a superset of `GoalRead`) — previously the frontend chained a `GET /goals/{id}/progress` per goal, an N+1 of round-trips. It is tempting to recompute progress in the browser from the transactions store (all the inputs are now available, including `wallet_ids`), and this was explicitly considered and rejected: the semantics in `services/goals.py` (`is_on_track` per `goal_type`, the wallet/category scoping) also drive status transitions and notifications, so a client-side copy would drift and report wrong numbers without ever erroring. Keep one source of truth.

16. **`TransactionRead` has two wallet fields and they mean different things.** `wallet_id` = the **manual** assignment only (pre-fills the edit form). `wallet_ids` = **every** associated wallet, manual + rule-derived — this is what `GET /transactions?wallet_id=` actually matches on server-side, so it's the one client-side wallet filtering must use (`byWallet` in `store/selectors.ts`). Filtering the cache by `wallet_id` would silently drop every rule-assigned transaction.

## Known backend bugs found & fixed during frontend integration

- `TransactionCreate.categoty_id` (typo) vs. route using `trx_in.category_id` → fixed to `category_id` in the model.
- CORS was completely unconfigured → added `CORSMiddleware` in `main.py`.
- Docker Compose mapped port 3000 but Vite defaults to 5173 → resolved by pinning Vite's `server.port` to 3000 to match the existing compose file, rather than changing the compose file.
- `update_my_profile` set `current_user.password_hash` but the model's real column is `password` → fixed (per Juan, already applied).
- No endpoint existed to compute income/expense totals → added `GET /transactions/summary`.
- No way to filter transactions by `type` → added `type` query param to `GET /transactions`.
- `GET /transactions/summary` was itself a victim of gotcha #12 above: it got registered *below* `GET /transactions/{transaction_id}`, so every call 422'd (FastAPI tried to parse `"summary"` as a UUID) until the Dashboard was wired to actually call it (2026-07-20) and the bug surfaced. Fixed by moving `/summary` above `/{transaction_id}` in `routes/transactions.py`. Lesson: a static route existing "in the codebase" isn't proof it's reachable — verify with a real request, since it can be added in the wrong position and sit unused/untested for a while before something finally calls it.
- `GET /transactions` had **no `ORDER BY`** at all, so `skip`/`limit` paged over an arbitrary Postgres ordering: "the 500 most recent" was not expressible, and paging could repeat or skip rows. Surfaced when the store layer needed batched loading (2026-07-30). Fixed with `.order_by(Transaction.date.desc(), Transaction.id.desc())` — the tiebreaker on `id` is what makes paging stable, not just the date.
- `GET /goals/` returned bare `GoalRead`, forcing a `GET /goals/{id}/progress` per goal. Changed to return `GoalProgressRead` inline (2026-07-30). See gotcha #15.

## Endpoints that exist but the frontend no longer calls

Deliberately kept as valid API surface, not dead code to delete — but don't assume a change to them is exercised by the UI:
- `GET /transactions/summary` — superseded by `summarize()` in `store/selectors.ts`, which computes the same four numbers from the in-memory store. The equivalence is exact, not approximate (both scope to `user_id + is_active` with no type/wallet filter); it was verified across 10 users × 3 date ranges with zero discrepancies before the switch.
- `GET /goals/{id}/progress` — superseded by the inline progress on `GET /goals/`.

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
├── api/                  # One file per backend resource (all .tsx, not .ts). Axios calls only, no business logic.
│   ├── client.tsx          # Axios instance + JWT interceptor (attach token, auto-refresh on 401)
│   ├── auth.tsx            # login (form-encoded!), refresh, logout, register
│   ├── users.tsx           # profile update, account deactivation
│   ├── admin.tsx           # is_admin-only: list/deactivate/reactivate users, reset a user's password
│   ├── categories.tsx       # CRUD + /preferences endpoint (hide/color)
│   ├── transactions.tsx     # CRUD, filtered by type/category/wallet/date; exportTransactions() downloads CSV/XLSX blobs from GET /transactions/export
│   ├── recurring.tsx        # CRUD + pause/resume/execute/execute-pending
│   ├── wallets.tsx          # CRUD
│   ├── walletRules.tsx      # CRUD, polymorphic payload by rule_type
│   └── goals.tsx            # CRUD; listGoals() returns progress inline (current_amount/percentage/is_on_track), computed server-side
├── store/                # Zustand, in-memory only. THE data layer — components read from here, not from api/. See gotchas #13–15.
│   ├── transactionsStore.ts  # batched load (500/page), status idle|loading|partial|ready|error; CRUD mutates in place + invalidates goals
│   ├── categoriesStore.ts    # always holds the superset (include_hidden=true); consumers filter !is_hidden client-side
│   ├── walletsStore.ts       # plain list; WalletDetail resolves a single wallet out of it instead of GET /wallets/{id}
│   ├── goalsStore.ts         # goals WITH server-computed progress; revalidate() = silent refetch for cross-store invalidation
│   └── selectors.ts          # pure filters over the arrays: byType, byWallet (uses wallet_ids!), byPeriod, summarize
├── context/                # UI concerns only — no entity data lives here (that's store/)
│   ├── AuthContext.tsx     # user, login, logout, refreshUser — fires executePending() on login, reset()s every store on logout
│   ├── ThemeContext.tsx    # light/dark toggle, persisted to localStorage + <html class="dark">
│   └── ToastContext / ConfirmContext / NotificationContext
├── hooks/                  # Thin read-only views over store/ — none of these fetch anymore
│   ├── useTransactionsByType.tsx   # period-scoped slice + previous-period comparison, behind TransactionsView
│   ├── useAllTransactionsByType.tsx # unscoped slice by type, behind the history table
│   ├── useWalletTransactions.tsx   # wallet-scoped slice, behind WalletDetail
│   ├── useCategories.tsx / useWallets.tsx  # store reads; useCategories(includeHidden) filters client-side
│   └── useSelectedWallet.tsx       # localStorage-backed UI preference, not data
├── components/
│   ├── layout/             # Sidebar (desktop), BottomNav + MobileHeader (mobile), AppShell (wraps both)
│   ├── transactions/       # TransactionsView (generic, parametrized by type) + TransactionTable, TransactionFilters,
│   │                         TransactionFormModal, CategoryFormModal. Also still has MonthlyChart/CategoryPieChart,
│   │                         but those are now only used by WalletDetail.tsx, NOT TransactionsView.
│   ├── charts/             # TimeBarChart, CategoryDonut, ChartTooltip — the newer chart components TransactionsView
│   │                         actually uses (period-driven, see gotcha below); a naming split from components/transactions/ worth knowing about.
│   ├── recurring/          # StatusBadge, PendingConfirmationBanner, RecurringFormModal, RecurringTable
│   ├── categories/         # CategoryFormModal
│   ├── wallets/            # WalletFormModal, WalletRuleFormModal, WalletRulesPanel
│   ├── goals/              # GoalFormModal
│   ├── admin/              # ResetPasswordModal
│   └── dashboard/          # SummaryCard, MonthlyTrendChart, ExpenseDonut, panels.tsx (GoalsPreview, WalletsPreview, RecentTransactionsPreview)
├── pages/                  # One per route; most are thin wrappers around the components above. Includes
│                             Admin.tsx (behind AdminRoute), Goals.tsx, NotFound.tsx (catch-all "*" route).
├── routes/
│   ├── ProtectedRoute.tsx  # Redirects to /login if not authenticated
│   ├── PublicOnlyRoute.tsx # Redirects away from /login,/register if already authenticated
│   └── AdminRoute.tsx      # Redirects/blocks unless current_user.is_admin
├── types/index.ts          # All shared TS interfaces/types — check here first before assuming a field name
└── utils/date.tsx          # Date range helpers + formatCurrency (MXN, centralized)
```

**Key reusability decision**: `TransactionsView` is generic over `type: "income" | "expense"` and used by both `Income.tsx` and `Expenses.tsx` — do not duplicate this component. Recurring and Wallets intentionally do **not** share this component; they have different domain concerns (see gotchas #9–10).

**Layering rule**: `components/` and `pages/` → `hooks/` + `store/` → `api/`.

The store layer covers **four** resources: transactions, categories, wallets, goals. For those, a component importing from `api/` directly is a bug — it bypasses the cache and reintroduces the duplicate-fetching the stores exist to kill. Everything else still calls `api/` directly and that's correct, because it has no store: `walletRules`, `recurring`, `logs`, `admin`, `users`, `auth`. One deliberate exception inside the covered four: `exportTransactions`, which streams a file to disk rather than holding state, so it stays a direct call from `TransactionsView` and `WalletDetail`.

## Things that are known-incomplete or intentionally deferred

See `TODO.md` for the full, current list — don't assume anything below is still accurate without checking that file first, since it will be updated over time and this context file may not be.
