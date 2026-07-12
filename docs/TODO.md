# TODO

Status snapshot as of the last working session. Update this as items get resolved so it stays trustworthy.

## Backend

- [ ] Decide the final shape of `Wallet.is_default` — right now it's half-implemented (doesn't actually surface a default wallet in the Wallets view). Either:
  - Remove it entirely (the "default" wallet is implicit — all transactions with no wallet filter — and doesn't need a stored flag), or
  - Rename it to something like `is_pinned`/`is_favorite` and treat it purely as a UI convenience, unrelated to the implicit default.
- [ ] Add password-strength validation server-side (currently only enforced client-side with `minLength`, which anyone can bypass by hitting the API directly).
- [ ] Consider requiring the current password before allowing a password change on `PATCH /users/me` (right now, any valid access token can change the password with no re-confirmation).
- [ ] Add rate limiting / a max failed-login-attempt lockout to `POST /auth/login` to reduce brute-force risk.
- [ ] Email verification on registration (currently any email is accepted at face value, with no confirmation step).
- [ ] Confirm the `user_category_preferences` migration ran cleanly and the unique constraint on `(user_id, category_id)` is actually in place.

## Frontend

- [ ] Migrate any remaining old components (built before the current color palette existed — early Login/Register/Sidebar work) to use the semantic color tokens (`bg-surface-elevated-light`, etc.) instead of raw Tailwind gray/white/black classes.
- [ ] Replace scattered `alert()` calls and inconsistent inline error `<p>` tags with a single toast/notification system for **app-level** feedback (action succeeded/failed, network errors, etc.) — see also the separate "system notifications" item below, which is a different concept.
- [ ] Add a 404 page for unmatched routes inside the authenticated app shell.
- [ ] Add a color picker in the Categories page UI, wired to the existing `color` field on `UserCategoryPreference` (backend already supports it; `CategoryPieChart` still uses a fixed palette instead of each category's chosen color).
- [ ] Handle expired-session UX more gracefully — right now a 401 refresh failure just redirects to `/login` with no explanation to the user.
- [ ] Double check the language/i18n toggle button has actually been removed from the Sidebar and BottomNav (was being considered for removal since it has no functionality behind it yet).
- [ ] General visual/design polish pass across the whole app — the current palette and layout are functional but there's an open-ended desire to keep improving the overall look and feel.
- [ ] Design or commission an app logo/branding mark, and apply it consistently (landing page, sidebar, browser tab favicon).

## Notifications (new area — not yet started)

- [ ] **App-level notifications**: toast-style feedback for general success/failure of actions (this overlaps with the toast system item above — build them together).
- [ ] **System/domain notifications**: a distinct, more persistent notification concept tied to specific domain events — e.g. "a recurring transaction was auto-executed", "a wallet rule matched N new transactions", "a recurring transaction is waiting for your confirmation." This is different from a transient toast: it likely needs its own backend model (a `Notification` table) and a way to mark items as read, probably surfaced via a bell icon with a badge count somewhere in the AppShell header/sidebar. Needs its own design pass before implementation — start by deciding the backend model shape.

## Categories

- [x] Per-user category visibility (`is_hidden`) — done, via `UserCategoryPreference`.
- [ ] Color picker UI for `UserCategoryPreference.color` (see Frontend section above — backend support already exists).

## Transactions

- [ ] Add the ability to switch the time range shown in the Income/Expenses charts (`MonthlyChart`, `CategoryPieChart`), defaulting to the current month instead of the current hardcoded last-12-months window.
- [x] ~~Dashboard time range switcher~~ — **not needed**: confirmed the Dashboard should always show only the current month, with no range-switching UI. (A separate range switcher belongs on the Income/Expenses pages instead, per the item above — don't conflate the two.)

## Wallets

- [ ] Surface the implicit default wallet as a visible entry in the Wallets page (currently only custom wallets show up; the "everything, unfiltered" default wallet has no visible representation in the UI). Depends on resolving the `is_default` ambiguity in the Backend section first.
- [ ] Support setting limits/goals on wallets (e.g. "don't exceed $X this month in this wallet") — new feature, not yet modeled on the backend at all. Will need a new field (or table) and UI to show progress against the goal.

## Dashboard

- [x] ~~Add a way to change the Dashboard's time period~~ — reversed per clarified requirement: Dashboard intentionally stays fixed to the current month only, no range picker.
- [ ] Migrate the dashboard's income/expense/balance calculation to use the `GET /transactions/summary` endpoint (already exists) instead of computing totals client-side from a full transaction list.
- [ ] Add charts to the Dashboard for the current month (monthly trend and/or category breakdown, in addition to the existing summary cards).

## AI features

- [ ] Open-ended: "add AI" to the app. No specific feature defined yet — needs scoping before this can move forward. Some directions worth considering when this gets picked up: spending insights/summaries, anomaly detection on transactions, natural-language transaction entry, or a chat-based query interface over the user's own data. Needs a decision on scope before any implementation work starts.

## Testing

- [ ] Frontend has no automated tests yet. Backend has a 21-scenario suite (FastAPI `TestClient` + SQLite in-memory) — frontend should get at least a small Vitest + React Testing Library suite covering the critical path (login, create transaction, edit transaction) for consistency.

## Deployment & polish (biggest portfolio-value items, per project notes)

- [ ] Deploy to a cloud provider.
- [ ] Set up environment-specific config so the frontend's API URL isn't hardcoded to `localhost` in production builds.
- [ ] Add a CI pipeline (e.g. GitHub Actions) running the backend test suite on every push.
- [x] `README.md` and AI/context files (`CLAUDE_CONTEXT.md`, `PROJECT_GUIDE.md`) — done.
- [ ] Expand `README.md` with screenshots and an architecture diagram once the app is closer to final.

## Explicitly deferred (not bugs, just "later")

- Language/i18n support beyond the removed placeholder button.
- Editing type/frequency/start_date on an existing recurring transaction (currently disabled in the form — needs a decision on how `next_execution` should recalculate if this is ever allowed).
- Changing `rule_type` on an existing wallet rule (currently requires deleting and recreating instead).
- Exploring blockchain — deliberately ruled out for this project; if pursued, it belongs in a separate project where it addresses a real architectural need.
