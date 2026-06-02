# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

The project has two independent packages. Run each from its subdirectory.

**Backend** (`cd backend`):
```bash
npm run dev          # nodemon index.js (hot-reload)
npm start            # node index.js (production)
npm run db:migrate   # prisma migrate dev (uses pinned prisma@5.15.0)
npm run db:studio    # opens Prisma Studio GUI
node seed.js         # seed admin user and initial area
```

**Frontend** (`cd frontend`):
```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # production build to dist/
npm run lint         # ESLint
npm run preview      # serve production build locally
```

There are no test suites configured in this project.

## Architecture

### Monorepo Layout
Two independent Node packages — `backend/` and `frontend/` — each with their own `package.json` and `node_modules`. No workspace setup.

### Backend (Express + Prisma)
- **Entry point**: `backend/index.js` — sets up Express, mounts all routes under `/api`, serves uploads under `/api/uploads` (the `/api/` prefix is required for IIS compatibility in production), and starts cron jobs.
- **All routes**: defined in a single file `backend/routes/api.js`. The JWT `verifyToken` middleware is defined and applied inline in that file — not a separate module. Routes below `router.use(verifyToken)` are protected.
- **Controllers**: `backend/controllers/` — one file per resource (`taskController.js`, `userController.js`, etc.). `index.js` re-exports all of them.
- **Notifications**: `backend/controllers/notificationService.js` — dual-channel: saves a DB record via Prisma and sends HTML email via Office365 SMTP (Nodemailer). Triggered by cron jobs and task events.
- **Cron jobs**: `backend/cronJobs.js` (the root-level one, used by `index.js`). Runs every minute. Checks for overdue tasks (CRITICAL alert) and tasks due within 2 days (WARNING alert), with per-task daily deduplication in the notifications table. There is also an unused `backend/controllers/cronJobs.js` — it is not wired up.
- **Prisma schema**: `backend/prisma/schema.prisma`. Run all `prisma` commands from inside `backend/`.
- **File uploads**: Multer stores files in `backend/uploads/`. Served statically at `/api/uploads/:filename`.

### Frontend (React SPA)
- **Routing**: `App.jsx` — two routes only: `/login` → `Login.jsx`, `/dashboard` → `Dashboard.tsx`. All other paths redirect to `/login`.
- **The monolith**: `frontend/src/components/Dashboard.tsx` is the entire application UI — all views, state, modals, tables, charts, and forms live in this one file (1000+ lines). When adding UI features, this is where the work goes.
- **Auth injection**: `Dashboard.tsx` overrides `window.fetch` at module level to auto-inject the JWT `Authorization: Bearer` header for any request to `/api`. There is also `src/api.js` (Axios instance) that does the same for Axios calls. These two mechanisms coexist.
- **No types file**: `Dashboard.tsx` imports `{ Task, Priority, Status, Area, User }` from `'./types'`, but `types.ts` does not exist. Types are effectively `any` at runtime; add type definitions inline or create the file if needed.
- **Dev proxy**: Vite proxies `/api` → `http://localhost:3000` so the frontend calls `/api/...` relative URLs in development.

### Database
PostgreSQL on `SV-BOG022-TDBA:5432`, database `taskflow_db`. Connection string in `.env` at the project root as `DATABASE_URL`.

Backend also requires these env vars (not in the committed `.env`): `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, `PORT`.

### Key Data Conventions
- **Priority values** are stored with a sort-order prefix: `"0|Muy Alta"`, `"1|Alta"`, `"2|Media"`, `"3|Baja"`, `"4|Muy Baja"`. Use `getPriorityLabel()` in the frontend to extract the display label. Always store with the pipe prefix.
- **Dates** are anchored to `12:00:00` local time (noon) on creation to prevent timezone-induced day shifts. The `procesarFechaSegura()` function in `taskController.js` handles all incoming date normalization including Excel serial numbers, ISO strings, and DD/MM/YYYY formats. Frontend strips the `T...` suffix before display with `endDateStr.split('T')[0]`.
- **Task progress** (`porcentaje_avance`) is auto-calculated from subtask completion via `actualizarPorcentajeTarea()` in `taskController.js` whenever a subtask is toggled.
- **Responsibles** (`task.responsable`) is a comma-separated string of full names (`"Nombre Apellido, Nombre2 Apellido2"`). The cron job matches these against `user.nombre + user.apellido` with diacritic normalization.

### Stale Backup Files
Several files with `- copia` in their names exist throughout `backend/controllers/` and `frontend/src/components/` (e.g., `Dashboard - copia.tsx`, `authController - copia.js`). These are manual backups and are not imported anywhere — ignore them.

### Production Deployment
Hosted on IIS at `taskprojit.atlanticqi.com`. The `/api/uploads` path prefix exists specifically because IIS intercepts bare `/uploads` paths. The email template links back to this production URL.
