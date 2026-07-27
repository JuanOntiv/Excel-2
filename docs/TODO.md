# TODO

Status snapshot as of the last working session. Update this as items get resolved so it stays trustworthy.

## Backend

- [ ] Email verification on registration (currently any email is accepted at face value, with no confirmation step).
- [ ] `execute_pending`'s `except` block (`routes/recurring_transactions.py`, around line 331) does `str(trx.id)` after a failed flush without calling `session.rollback()` first → `PendingRollbackError` (500 instead of the graceful per-item `errors` list). Needs a `session.rollback()` in that except block.

## Frontend

- [ ] General visual/design polish pass across the whole app — the current palette and layout are functional but there's an open-ended desire to keep improving the overall look and feel.
- [ ] Design or commission an app logo/branding mark, and apply it consistently (landing page, sidebar, browser tab favicon).
- [ ] Mobile header overflow: at narrow viewports (~375px) the "Nuevo ingreso"/"Nuevo egreso" button in `TransactionsView.tsx`'s title row gets clipped/pushed off-screen instead of wrapping. Found 2026-07-26 while verifying the wallet selector feature; not caused by that change, still unfixed.

## AI features

- [ ] Open-ended: "add AI" to the app. No specific feature defined yet — needs scoping before this can move forward. Some directions worth considering when this gets picked up: spending insights/summaries, anomaly detection on transactions, natural-language transaction entry, or a chat-based query interface over the user's own data. Needs a decision on scope before any implementation work starts.

## Testing

- [ ] Frontend has no automated tests yet (no Vitest/RTL setup, no `*.test.*` files). Backend now has a 45-scenario `pytest` suite across `ci/` (auth, users, admin, password, rate limiting, goals — run against a real Postgres via `ci/conftest.py`, not SQLite in-memory) — frontend should get at least a small Vitest + React Testing Library suite covering the critical path (login, create transaction, edit transaction) for consistency.

## Deployment & polish (biggest portfolio-value items, per project notes)

- [ ] Deploy to a cloud provider. Still not done — no `fly.toml`/`render.yaml`/CD workflow found; `.github/workflows/ci.yml` only runs tests/build, it doesn't deploy anywhere.
- [ ] Expand `README.md` with screenshots and an architecture diagram once the app is closer to final. Still not done — no images in the repo yet, and `README.md` references a `.env.example` for setup that doesn't actually exist (only a real, populated `.env`) — worth adding one so the documented setup steps actually work for a fresh clone.

## Explicitly deferred (not bugs, just "later")

- Language/i18n support beyond the removed placeholder button.
- Editing type/frequency/start_date on an existing recurring transaction (currently disabled in the form — needs a decision on how `next_execution` should recalculate if this is ever allowed).
- Changing `rule_type` on an existing wallet rule (currently requires deleting and recreating instead).
- Wallet-rule-match notifications (`RULE_MATCHED`) — deliberately deferred when the notifications system was built; noisy signal, needs an aggregation decision before implementing.
- Exploring blockchain — deliberately ruled out for this project; if pursued, it belongs in a separate project where it addresses a real architectural need.
