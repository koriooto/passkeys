# Passkeys Manager

Browser extension + backend for managing accounts and notes with client‑side encryption.

## Stack
- Frontend: React 19 + Vite + Tailwind + TanStack Query
- Backend: Go + Postgres
- Extension: Chrome/Chromium Manifest V3

## Features
- Accounts CRUD with AES‑GCM encryption (client‑side).
- Notes CRUD with AES‑GCM encryption (client‑side).
- Autofill + tooltip on input fields.
- Password generator.
- Master‑password change flow (re‑encrypts data).

## Repo Structure
- `frontend/` — extension UI + content script
- `backend/` — Go API
- `db/migrations/` — Postgres migrations

---

## Backend

### Environment
```
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=disable
JWT_SECRET=super-secret
PORT=8080
```

### Run locally
```
cd backend
go mod tidy
go run ./cmd/api
```

### Docker Compose
```
docker compose up --build
```

Apply migrations (inside compose):
```
docker compose exec db psql -U passkeys -d passkeys -f /migrations/001_init.sql
docker compose exec db psql -U passkeys -d passkeys -f /migrations/002_rename_domain_to_url.sql
docker compose exec db psql -U passkeys -d passkeys -f /migrations/003_notes.sql
```

---

## Frontend (extension)

### Install + build
```
cd frontend
npm install
npm run build
```

### Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `frontend/dist`

### API base URL
Default: `http://localhost:8080`  
Override: set `VITE_API_BASE_URL` in env when building.

---

## Notes on security
- Master password is never sent to the server.
- Server stores only ciphertext + nonces.
- Key derivation: PBKDF2‑SHA256 (100k), AES‑GCM 256‑bit.

---

## Troubleshooting
- Notes `db error`: run migration `003_notes.sql`.
- Autofill uses latest cached credentials per origin.
