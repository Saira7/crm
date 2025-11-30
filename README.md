# CRM Application

This repository contains a full-stack CRM application with an Express/Prisma backend and a React + Vite frontend. The app covers lead management, team/role administration, sticky notes, file attachments, and admin analytics with IP-aware access controls.

## Project structure

- `backend/` – Express API, Prisma ORM models/migrations, authentication/IP restriction middleware, and seed data.
- `frontend/` – React SPA built with Vite and Tailwind, providing dashboards, lead views, team management, sticky notes, file uploads, and admin reporting.

## Backend

### Technology
- Express 5 with JSON APIs and CORS enabled.
- Prisma (PostgreSQL) data models for roles, teams, users, leads, sticky notes, and file attachments.
- JWT authentication middleware plus IP allowlisting/role-based restrictions for protected routes.

### Key routes
- `POST /api/auth/login` – issues JWT tokens after verifying credentials and IP rules.
- `GET/POST /api/leads` – CRUD-style lead endpoints with access scoped by role/team; team leads can view all leads for their teams, admins see all.
- `GET /api/users`, `/api/teams`, `/api/roles` – team/role/user management (protected by auth + IP checks).
- `GET /api/admin/overview` – admin analytics used by the frontend dashboard.
- `POST /api/files` – attachment uploads served from `/uploads`.

### Environment
Create `backend/.env` with at least:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:
JWT_SECRET=change-me
PORT=4000
```

`DATABASE_URL` should point to your Postgres instance (the provided `docker-compose.yml` maps Postgres to port 5435).

### Database setup
1. Install dependencies: `npm install` (from `backend/`).
2. Start Postgres: `docker compose up -d` (from `backend/`).
3. Apply migrations: `npx prisma migrate deploy` (or `npx prisma migrate dev` in development). The Prisma schema defines all CRM entities and indexes.
4. Seed sample data: `node prisma/seed.js` to create teams, roles, and demo users (password `Password123!`).

### Running the API
Start the server with `node server.js` (or `nodemon server.js` during development). The API listens on `PORT` (default `4000`).

## Frontend

### Technology
- React 19 with React Router for routing and context-based auth state.
- Vite build tooling and Tailwind styles.
- Feature pages: login, dashboard, leads table + detail modal, team management, team-lead overview, sticky notes, file attachments, and admin dashboard (role-gated to `admin`).
### Environment
Create `frontend/.env` with the API base URL:

```
VITE_API_BASE=http://localhost:4000/api
```

The Vite dev server proxies `/api` to the backend by default; override `VITE_API_BASE` for production deployments.

### Running the client
From `frontend/`:

1. Install dependencies: `npm install`.
2. Start development server: `npm run dev` (defaults to `http://localhost:5173`).
3. Build for production: `npm run build`; preview with `npm run preview`.

## Development workflow
1. Start Postgres via Docker, run migrations/seed.
2. Launch backend with `node server.js`.
3. Launch frontend with `npm run dev` and log in using a seeded account (e.g., `sharoon@example.com` / `Password123!`).
4. Admin users gain access to `/admin-dashboard`; team leads/agents are routed to `/dashboard` automatically.

## Notes on IP restrictions
- The backend enforces IP allowlists per user and per role; default private networks are permitted. Requests to many routes include `checkIPRestriction` after JWT verification.
- During development, ensure you connect from an allowed IP or adjust the allowlists in `middleware/ipRestriction.js` and database records.

## Repository layout
- `backend/routes/` – API route handlers (`auth`, `leads`, `users`, `teams`, `roles`, `notes`, `files`, `admin`).
- `backend/middleware/` – JWT auth and IP restriction utilities.
- `backend/prisma/` – schema, migrations, and seed script.
- `frontend/src/components/` – UI screens/components referenced by the router.
- `frontend/src/api.js` – helper for authenticated API fetch calls.
