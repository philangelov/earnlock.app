# EarnLock

EarnLock turns screen time into a reward kids earn by learning: distracting apps stay
locked until the child answers AI-generated quiz questions built from their own study
material.

## Repository layout

- `frontend/` — Expo (SDK 57) mobile app: screens, UI components, theme, and local state
- `backend/` — Flask API server backed by Supabase (auth, profiles, quiz engine, rewards)
- `docs/` — architecture, API contract, auth, tech stack, and UI/UX documentation
- `.github/workflows/ci.yml` — CI: lint, format, and type checks plus backend tests

## Run locally

### 1. Frontend (Expo app)

```bash
cd frontend
bun install
bun start
```

The Expo dev server launches with options for iOS, Android, and web.

### 2. Backend (Flask API)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env             # fill in your Supabase credentials
python run.py
```

The API runs on `http://localhost:5000`. Database migrations live in
`backend/migrations/` and are applied to Supabase in numeric order (see
`backend/migrations/README.md`).

## Validate code quality

Frontend (Prettier, ESLint, TypeScript):

```bash
cd frontend
bun run validate
bunx tsc --noEmit
```

Backend (ruff + pytest):

```bash
cd backend
sh validate.sh
python -m pytest
```

## Branching policy

- Always branch off `main`.
- Use feature branches in the form `feature/your-task-name`.
- Open a Pull Request to merge changes back into `main`.
- Do not push directly to `main`.
