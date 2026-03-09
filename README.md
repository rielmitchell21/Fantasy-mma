# Fantasy UFC League Platform

A full-stack fantasy UFC website where users can sign up, join leagues, draft fighters, and track scoring over a one-year season.

## Features implemented

- User sign up / login / logout
- League creation and join via invite code
- League constraints:
  - 5-10 users per league
  - 15-20 fighters per user roster
- Draft start control (commissioner only)
- Season window:
  - Starts when draft is started
  - Ends exactly one year later
  - No fights before draft start are counted
- Fighter pool:
  - UFC-contracted fighters only (`has_ufc_contract = 1`)
  - Seeded with an initial UFC list, and commissioner can add more
- Fight recording (commissioner only)
- Automatic standings/scoring per your rules

## Scoring rules (max 6 points on a win)

For each **winning fighter**:

- 1 point for win
- +1 for finish
- +1 for 5-round fight
- +1 for championship fight
- +1 for fighting a ranked fighter
- +1 for vacating a title in another weight class to move divisions and fight for a championship

If a fighter loses: **0 points**.

## Tech stack

- Node.js + Express
- SQLite (`better-sqlite3`)
- EJS templates
- Session auth (`express-session` + `connect-sqlite3`)

## Run locally

```bash
npm install
npm start
```

Then open: `http://localhost:3000`

Optional:

```bash
cp .env.example .env
```

## Notes

- Database file is created at `data/fantasy-ufc.db`.
- Session storage is created at `data/sessions.sqlite`.
