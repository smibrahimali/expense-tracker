# ExpenseFlow — Personal Expense Tracker

Internship project for tracking personal spending with salary budgeting, category insights, and an AI chat assistant that can log, edit, and delete expenses from natural language (with optional voice input).

Monorepo: **Next.js** frontend + **NestJS** API + **Supabase** (Auth, Postgres, RLS).

---

## Features

- Email/password auth via Supabase (login, signup, password update, session proxy)
- Dashboard with monthly/all-time spend, salary remaining, savings, and 6-month trend chart
- Expense CRUD with payment method, notes, and large-expense warning (>30% of salary)
- Category management synced with expense category names
- AI Quick Logger (Groq) with multi-turn drafts, edit/delete flows, and voice-to-text
- NestJS REST API for expenses + monthly reports (JWT-protected)

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts |
| Auth & DB | Supabase Auth + Postgres + RLS |
| AI | Vercel AI SDK + Groq |
| API | NestJS 12 |
| Tests | Vitest |

---

## Project Structure

```text
expense-tracker/
├── apps/
│   ├── web/                 # Next.js UI + /api/chat-logger
│   └── api/                 # NestJS /api/v1 expenses + reports
├── supabase/migrations/     # Schema, RLS, seeds, upgrades
└── README.md
```

---

## Database

Core tables: `profiles`, `monthly_salaries`, `categories`, `expenses`, `expense_drafts`.

Important design note: `expenses.category_id` stores the **category name** (text), not a UUID. The `categories` table holds per-user category metadata; renaming a category also updates matching expense rows.

Apply migrations in order:

1. `001_schema.sql`
2. `002_rls_and_seeds.sql`
3. `003_align_existing_schema.sql` (for databases created from older UUID-based schema)

---

## Getting Started

### Prerequisites

- Node.js 22+ (API) / 24.x recommended for web
- Supabase project
- Groq API key (for AI logger)

### Install

```bash
cd apps/web && npm install
cd ../api && npm install
```

### Environment

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For Nest (`apps/api`), set:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
```

### Run

```bash
# Web
cd apps/web
npm run dev
# http://localhost:3000

# API
cd apps/api
npm run start:dev
# http://localhost:3001/api/v1
```

---

## API

### Next.js

- `POST /api/chat-logger` — authenticated conversational expense create/edit/delete

### NestJS (`/api/v1`)

Requires `Authorization: Bearer <supabase_access_token>`.

- `POST /expenses`
- `GET /expenses`
- `GET /expenses/:id`
- `PATCH /expenses/:id`
- `DELETE /expenses/:id`
- `GET /reports/monthly?month=YYYY-MM`

---

## Security notes

- Chat logger derives the user from the Supabase session cookie (does not trust client `userId`)
- Nest expenses/reports endpoints verify the Bearer JWT via Supabase Auth
- RLS policies isolate user data for direct Supabase client access

---

## Internship highlights

- End-to-end personal finance product with auth, budgeting, and analytics
- Money stored in minor units to avoid floating-point errors
- AI-assisted logging with draft sessions and voice input
- Schema/RLS design plus a JWT-protected Nest API layer
