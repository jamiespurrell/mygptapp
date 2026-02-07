# Daily Voice Notes & Task Planner

A voice/text note + task planner web app.

## Current frontend

- Record and save voice notes
- Save text notes and create tasks from notes
- Task priority, archive/delete/restore, pagination, date-range filtering
- Theme toggle (dark/light)

## Run frontend locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Next step added: login + external database backend scaffold

This repo now includes a backend starter in `backend/` with:

- Email/password register + login (`JWT`)
- Protected `/api/notes` and `/api/tasks` endpoints
- PostgreSQL schema for `users`, `notes`, `tasks`

### Backend setup

1. Create a PostgreSQL database (local or hosted).
2. Copy env file:

```bash
cd backend
cp .env.example .env
```

3. Set values in `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN` (frontend origin)

4. Run schema:

```bash
psql "$DATABASE_URL" -f schema.sql
```

5. Install and start backend:

```bash
npm install
npm run dev
```

Backend runs on `http://localhost:4000` by default.

## Backend endpoints (starter)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/notes`, `POST /api/notes`
- `GET /api/tasks`, `POST /api/tasks`

## Browser APIs used in frontend

- `MediaRecorder`
- `getUserMedia`
