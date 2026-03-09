# Fantasy UFC MVP (Next.js + Node.js API + PostgreSQL)

This repo contains a complete fantasy UFC MVP:

- **Frontend:** Next.js
- **Backend:** Node.js API routes (inside Next.js)
- **Database:** PostgreSQL
- **Auth:** signup/login/logout with server-side sessions
- **Leagues:** 5-10 users
- **Draft:** 15-20 fighters per user, UFC-contracted fighters only
- **Scoring:** winner-only scoring, max 6 points per fight

## Scoring Rules

Winning fighter gets:

- 1 point for win
- +1 for finish
- +1 for 5-round fight
- +1 for championship fight
- +1 for fighting ranked opponent
- +1 for title move fight

Losing fighter gets **0** points.

## Local Setup

1) Start PostgreSQL:

```bash
docker compose up -d
```

2) Configure env:

```bash
cp .env.example .env
```

3) Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

`npm run dev` automatically runs DB initialization (`scripts/init-db.js`) before starting Next.js.

## Main API Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/leagues`
- `POST /api/leagues`
- `POST /api/leagues/join`
- `GET /api/leagues/:id`
- `POST /api/leagues/:id/start-draft`
- `POST /api/leagues/:id/draft`
- `POST /api/leagues/:id/fighters`
- `POST /api/leagues/:id/fights`
