# TODO

Status snapshot as of the last working session. Update this as items get resolved so it stays trustworthy.

## Backend

- [X] Decide the final shape of `Wallet.is_default` — resolved as **Option A**: the default wallet is no longer purely implicit. `create_default_wallet()` (`app/services/wallets.py`) materializes a real `Wallet` row (name "General", `is_default=True`) once at registration; `GET /wallets` returns it alongside custom wallets, and it's the stable id/name the Dashboard and `GET /transactions/summary` reference. Balance is still computed on the fly from transactions, not cached on the row.
- [X] Add password-strength validation server-side (currently only enforced client-side with `minLength`, which anyone can bypass by hitting the API directly).
- [X] Consider requiring the current password before allowing a password change on `PATCH /users/me` (right now, any valid access token can change the password with no re-confirmation).
- [X] Add rate limiting / a max failed-login-attempt lockout to `POST /auth/login` to reduce brute-force risk.
- [ ] Email verification on registration (currently any email is accepted at face value, with no confirmation step).
- [X] Fixed latent bug: `Transaction.description` was a NOT NULL column while `TransactionCreate.description` is optional, so any transaction created without a description 500'd (`NotNullViolation`) — hit plain `POST /transactions` and the recurring execute path. Made the column `nullable=True` + Alembic migration `dbb947dc5f41`. **Still open:** `execute_pending`'s `except` block does `str(trx.id)` after a failed flush → `PendingRollbackError` (500 instead of the graceful per-item `errors` list); needs a `session.rollback()` there.
- [X] Confirm the `user_category_preferences` migration ran cleanly and the unique constraint on `(user_id, category_id)` is actually in place.

## Frontend

- [X] Migrate any remaining old components (built before the current color palette existed — early Login/Register/Sidebar work) to use the semantic color tokens (`bg-surface-elevated-light`, etc.) instead of raw Tailwind gray/white/black classes — verified 2026-07-20: no `text-gray-*`/`bg-gray-*`/`border-gray-*` remain anywhere in `frontend/src`. Remaining `bg-black`/`text-white` hits are intentional (modal backdrops `bg-black/40`, white text on `bg-accent` buttons), not leftover raw grays.
- [X] Replace scattered `alert()` calls and inconsistent inline error `<p>` tags with a single toast/notification system for **app-level** feedback — done. `context/ToastContext.tsx` (`useToast().toast.success/error/info`, auto-dismiss + manual dismiss) + `components/ui/Toaster.tsx` (top-right stack, semantic tokens, dark-mode), mounted once in `App.tsx`. Migrated all 4 `alert()` calls (Admin ×2, TransactionsView export, Settings) and added success/error toasts across create/edit/delete flows in Admin, Settings, TransactionsView, Categories, Wallets, WalletDetail, Goals, Recurring, WalletRulesPanel. Deliberate rule: action/network errors + successes → toast; **form validation stays inline** (e.g. "passwords don't match", required fields). No global Axios auto-toast (chosen "Option A pure" to keep contextual Spanish messages and avoid duplicates).
- [X] Add a 404 page for unmatched routes inside the authenticated app shell — done, `pages/NotFound.tsx` via the catch-all `path="*"` route in `App.tsx`.
- [X] Add a color picker in the Categories page UI, wired to the existing `color` field on `UserCategoryPreference` (backend already supports it).
- [X] Handle expired-session UX more gracefully — done. `api/client.tsx`'s 401 handler redirects to `/login?session=expired`, and `Login.tsx` reads that param to show "Tu sesión expiró por inactividad. Vuelve a iniciar sesión."
- [X] Double check the language/i18n toggle button has actually been removed from the Sidebar and BottomNav — confirmed removed, no trace left in either component.
- [ ] General visual/design polish pass across the whole app — the current palette and layout are functional but there's an open-ended desire to keep improving the overall look and feel.
- [ ] Design or commission an app logo/branding mark, and apply it consistently (landing page, sidebar, browser tab favicon).

## Notifications

- [X] **App-level notifications**: toast-style feedback for success/failure — done together with the toast system item in the Frontend section above.
- [X] **System/domain notifications**: done. Backend `Notification` table (`models/notifications.py`) with `NotificationType` enum, `is_read`/`read_at`, and a normalized `entity_type`/`entity_id` link (frontend maps to a route). Emitter service `services/notifications.py` (`create_notification`, with `dedupe`). Endpoints in `routes/notifications.py`: list, `unread-count`, `{id}/read`, `read-all`, delete. Frontend: `context/NotificationContext.tsx` (poll 45s + focus refetch, optimistic updates), `components/notifications/NotificationBell.tsx` (bell + badge + dropdown, per-type icon/color, mark-read + navigate + dismiss), mounted in Sidebar (desktop) and MobileHeader (mobile).
  - **Events wired (v1):** `RECURRING_EXECUTED` (auto-executed on login via `execute-pending`), `RECURRING_PENDING` (deduped, awaiting confirmation), and goal events. `RULE_MATCHED` (wallet-rule matches) was **deliberately deferred** — noisy, needs an aggregation decision.
  - **Goal events required building the dormant achieved/failed lifecycle** (goal `status` was only ever set to `cancelled`; achieved/failed existed in the enum but nothing set them). Now: `GOAL_ACHIEVED`/`GOAL_EXCEEDED` are detected **in real time** on transaction create/update (`services/goals.py::evaluate_goal_completions`, dedupe via persisted `status`); `GOAL_FAILED` (period ended unmet) is time-based so it's detected **on login** (`flag_expired_goals`, run inside `execute-pending`).

## Categories

- [x] Per-user category visibility (`is_hidden`) — done, via `UserCategoryPreference`.
- [X] Color picker UI for `UserCategoryPreference.color` (see Frontend section above — backend support already exists).

## Transactions

- [X] Add the ability to switch the time range shown in the Income/Expenses charts, defaulting to the current month — done, via the `period` selector (`PERIOD_OPTIONS`: week/month/quarter/half/year/all, default `"month"`) in `TransactionsView.tsx`, driving `TimeBarChart` and `CategoryDonut` (renamed from the old `MonthlyChart`/`CategoryPieChart`).
- [x] ~~Dashboard time range switcher~~ — **not needed**: confirmed the Dashboard should always show only the current month, with no range-switching UI. (A separate range switcher belongs on the Income/Expenses pages instead, per the item above — don't conflate the two.)
- [X] Export transactions to CSV/Excel — done. `GET /transactions/export?format=csv|xlsx` (backend-generated, reuses the same filters as `list_transactions`: type/category_id/wallet_id/date range), triggered from an "Exportar" button on the Income/Expenses view scoped to the active period + category filter. CSV via stdlib `csv`, XLSX via `openpyxl` (new backend dependency). Note: the frontend's client-only filters (name search, min/max amount) are NOT applied to the export, since the backend doesn't support them — only period/category/type are respected.


## Wallets

- [X] Surface the default wallet as a visible entry in the Wallets page — done. Now that `is_default` is a real, always-created row (see Backend section), `Wallets.tsx` renders it in the grid with a star icon, no delete button, and no rules panel (rules don't apply to it).
- [X] Support setting limits/goals (e.g. "don't exceed $X this month") — superseded by the new **Goals** feature (see below) rather than a wallet-specific field. A goal can optionally scope to a `wallet_id` and/or `category_id`, which covers the original ask plus more (income targets, savings targets).

## Goals (new area — implemented, not previously tracked here)

- [x] Backend: `Goal` model/table (`goal_type`: income / expense_limit / savings; optional `wallet_id`/`category_id` scope; `status`: active/achieved/failed/cancelled), `GET/POST/PATCH/DELETE /goals`, progress computed on the fly in `services/goals.py` (not persisted) and exposed via `GoalProgressRead` (`current_amount`, `percentage`, `is_on_track`). Covered by `ci/test_goals.py`.
- [x] Frontend: `pages/Goals.tsx`, `components/goals/GoalFormModal.tsx`, `api/goals.tsx`, plus a `GoalsPreview` panel on the Dashboard.
- [X] Decided/verified 2026-07-20: `evaluate_goal_completions` (`services/goals.py`) seals ACHIEVED/EXCEEDED in real time on transaction create/update; `flag_expired_goals` seals FAILED (end_date passed, unmet) on login via `execute-pending`. No separate periodic job — login is the time-based trigger. If a user doesn't log in for a while, an expired goal just stays ACTIVE until their next login; revisit only if that staleness window becomes a real complaint.

## Admin / user management (existing area — not previously tracked here)

- [x] `is_admin`-gated endpoints in `routes/users.py` (list all users, deactivate/reactivate, reset another user's password) plus `/admin` frontend page (`pages/Admin.tsx`, guarded by `AdminRoute`). Covered by `ci/test_admin.py`. No open items identified; flagging its existence so it isn't rediscovered from scratch.

## Dashboard

- [x] ~~Add a way to change the Dashboard's time period~~ — reversed per clarified requirement: Dashboard intentionally stays fixed to the current month only, no range picker.
- [X] Migrate the dashboard's income/expense/balance calculation to use the `GET /transactions/summary` endpoint instead of computing totals client-side — done 2026-07-20. `Dashboard.tsx` now calls `getTransactionsSummary` (current + previous month range) for the 4 KPI cards (income/expenses/balance/count). `listTransactions` calls for current/previous month are still kept — `MonthlyTrendChart`/`ExpenseDonut` need per-transaction data, and `RecentTransactionsPreview` still needs the combined current+previous list to pad "recent" when the current month is sparse. The old `sumByType` helper was removed.
- [X] Add charts to the Dashboard for the current month — done, `MonthlyTrendChart` + `ExpenseDonut`, alongside `GoalsPreview`/`WalletsPreview`/`RecentTransactionsPreview` panels.

## AI features

- [ ] Open-ended: "add AI" to the app. No specific feature defined yet — needs scoping before this can move forward. Some directions worth considering when this gets picked up: spending insights/summaries, anomaly detection on transactions, natural-language transaction entry, or a chat-based query interface over the user's own data. Needs a decision on scope before any implementation work starts.

## Testing

- [ ] Frontend has no automated tests yet (no Vitest/RTL setup, no `*.test.*` files). Backend now has a 45-scenario `pytest` suite across `ci/` (auth, users, admin, password, rate limiting, goals — run against a real Postgres via `ci/conftest.py`, not SQLite in-memory) — frontend should get at least a small Vitest + React Testing Library suite covering the critical path (login, create transaction, edit transaction) for consistency.

## Deployment & polish (biggest portfolio-value items, per project notes)

- [ ] Deploy to a cloud provider. Still not done — no `fly.toml`/`render.yaml`/CD workflow found; `.github/workflows/ci.yml` only runs tests/build, it doesn't deploy anywhere.
- [X] Set up environment-specific config so the frontend's API URL isn't hardcoded to `localhost` in production builds — done at the code level: `api/client.tsx` reads `VITE_API_URL` with a `localhost:8000` fallback, and it's the only `localhost` reference left in `frontend/src`. Whoever deploys just needs to set that env var at build time.
- [X] Add a CI pipeline (e.g. GitHub Actions) running the backend test suite on every push — done, `.github/workflows/ci.yml`: `backend-tests` (pytest against real Postgres), `migrations` (alembic upgrade/downgrade round-trip + `alembic check` for model/migration drift), `frontend` (build only, lint deliberately skipped per the workflow's own comment).
- [x] `README.md` and AI/context files (`CLAUDE_CONTEXT.md`, `PROJECT_GUIDE.md`) — done.
- [ ] Expand `README.md` with screenshots and an architecture diagram once the app is closer to final. Still not done — no images in the repo yet, and `README.md` references a `.env.example` for setup that doesn't actually exist (only a real, populated `.env`) — worth adding one so the documented setup steps actually work for a fresh clone.

## Explicitly deferred (not bugs, just "later")

- Language/i18n support beyond the removed placeholder button.
- Editing type/frequency/start_date on an existing recurring transaction (currently disabled in the form — needs a decision on how `next_execution` should recalculate if this is ever allowed).
- Changing `rule_type` on an existing wallet rule (currently requires deleting and recreating instead).
- Exploring blockchain — deliberately ruled out for this project; if pursued, it belongs in a separate project where it addresses a real architectural need.
