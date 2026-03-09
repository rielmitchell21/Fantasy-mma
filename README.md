# Fantasy UFC MVP (Monorepo)

Complete fantasy UFC MVP from scratch with:

- **Frontend:** Next.js (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Database:** PostgreSQL (`docker-compose.yml`)
- **Authentication:** user signup/login/logout with cookie sessions
- **Leagues:** enforced 5-10 users
- **Draft:** enforced 15-20 fighters per user from UFC roster
- **Scoring:** max 6 points per winning fight

## Folder Structure

```txt
.
├─ frontend/
├─ backend/
├─ docker-compose.yml
├─ package.json
├─ package-lock.json
└─ .env.example
```

## Scoring Rules (winner only)

- +1 Win
- +1 Finish
- +1 Five-round fight
- +1 Championship fight
- +1 Ranked opponent
- +1 Title move fight

Max = **6 points** per winning fighter.  
Loser gets **0 points**.

## Run locally

1. Start PostgreSQL:

```bash
docker compose up -d
```

2. (Optional) copy env templates:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

3. Install and run both apps:

```bash
npm install
npm run dev
```

4. Open:

`http://localhost:3000`

Backend runs on `http://localhost:4000` and frontend proxies `/api/*` to it.
