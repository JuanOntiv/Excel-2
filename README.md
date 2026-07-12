# Finanzas — Personal Finance Manager

A full-stack personal finance management application. Track income, expenses, recurring transactions, and organize your money into custom wallets with automatic rule-based assignment.


## Features
 
- **Authentication** — JWT-based auth with access + refresh tokens, secure password hashing
- **Dashboard** — Monthly overview of income, expenses, and balance at a glance
- **Income & Expenses** — Full CRUD with monthly trend charts, category breakdown (pie chart), paginated history, and highest/lowest transaction highlights
- **Categories** — Global (shared) and personal categories, with per-user preferences to hide categories or assign custom colors without affecting other users
- **Recurring Transactions** — Automate regular income/expenses (daily, weekly, biweekly, monthly, yearly) with optional auto-execution or manual confirmation
- **Wallets** — Organize transactions into custom groupings, either manually or automatically via rules (by category, transaction type, keyword, date range, or amount range)
- **Dark mode** — Full light/dark theme support
- **Responsive design** — Collapsible sidebar on desktop, bottom navigation on mobile

# Tech Stack
 
**Backend**
- FastAPI + SQLModel + PostgreSQL
- Alembic for migrations
- Docker Compose for local development
- JWT authentication (access + refresh, with refresh token rotation and SHA-256 hashing)
- bcrypt for password hashing
**Frontend**
- React + TypeScript + Vite
- Tailwind CSS v4
- Zustand (transaction state) + Context API (auth, theme)
- Recharts for data visualization
- React Router + Axios (with automatic token refresh)


## Getting Started
 
### Prerequisites
- Docker and Docker Compose
### Setup
 
1. Clone the repository:
```bash
   git clone <repo-url>
   cd <repo-name>
```
 
2. Create your `.env` file at the project root (see `.env.example` for required variables: database credentials, JWT secret, token expiration settings).
3. Start all services:
```bash
   docker compose -f docker/docker-compose.yml up --build
```
 
4. Seed the global categories (recommended, so new accounts have categories to work with right away):
```bash
   docker compose exec backend python -m app.scripts.seed_categories
```
 
5. Open the app:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
## Project Structure
 
```
├── backend/          # FastAPI application (models, routes, services, migrations)
├── frontend/          # React + TypeScript application
└── docker/            # Docker Compose and Dockerfiles
```
 
## Running Tests

 
## License
