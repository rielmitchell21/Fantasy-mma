const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/fantasy_ufc";

const pool = new Pool({ connectionString });

const seededFighters = [
  ["Islam Makhachev", "Lightweight", true],
  ["Ilia Topuria", "Featherweight", true],
  ["Alexander Volkanovski", "Featherweight", true],
  ["Max Holloway", "Featherweight", true],
  ["Alex Pereira", "Light Heavyweight", true],
  ["Magomed Ankalaev", "Light Heavyweight", true],
  ["Jiri Prochazka", "Light Heavyweight", true],
  ["Jamahal Hill", "Light Heavyweight", true],
  ["Dricus Du Plessis", "Middleweight", true],
  ["Israel Adesanya", "Middleweight", true],
  ["Robert Whittaker", "Middleweight", true],
  ["Khamzat Chimaev", "Middleweight", true],
  ["Belal Muhammad", "Welterweight", true],
  ["Leon Edwards", "Welterweight", true],
  ["Shavkat Rakhmonov", "Welterweight", true],
  ["Sean Brady", "Welterweight", true],
  ["Merab Dvalishvili", "Bantamweight", true],
  ["Sean O'Malley", "Bantamweight", true],
  ["Umar Nurmagomedov", "Bantamweight", true],
  ["Petr Yan", "Bantamweight", true],
  ["Alexandre Pantoja", "Flyweight", true],
  ["Brandon Moreno", "Flyweight", true],
  ["Brandon Royval", "Flyweight", true],
  ["Kai Kara-France", "Flyweight", true],
  ["Tom Aspinall", "Heavyweight", true],
  ["Jon Jones", "Heavyweight", true],
  ["Ciryl Gane", "Heavyweight", true],
  ["Sergei Pavlovich", "Heavyweight", true],
  ["Manon Fiorot", "Women's Flyweight", true],
  ["Valentina Shevchenko", "Women's Flyweight", true],
  ["Alexa Grasso", "Women's Flyweight", true],
  ["Erin Blanchfield", "Women's Flyweight", true],
  ["Zhang Weili", "Women's Strawweight", true],
  ["Tatiana Suarez", "Women's Strawweight", true],
  ["Yan Xiaonan", "Women's Strawweight", true],
  ["Amanda Lemos", "Women's Strawweight", true],
  ["Raquel Pennington", "Women's Bantamweight", true],
  ["Julianna Pena", "Women's Bantamweight", true],
  ["Kayla Harrison", "Women's Bantamweight", true],
  ["Ketlen Vieira", "Women's Bantamweight", true]
];

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function initializeDatabase() {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leagues (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        commissioner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        min_users INTEGER NOT NULL DEFAULT 5,
        max_users INTEGER NOT NULL DEFAULT 10,
        roster_size INTEGER NOT NULL DEFAULT 15,
        draft_started_at DATE,
        season_ends_at DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (min_users >= 5),
        CHECK (max_users <= 10),
        CHECK (max_users >= min_users),
        CHECK (roster_size >= 15 AND roster_size <= 20)
      );

      CREATE TABLE IF NOT EXISTS league_members (
        id SERIAL PRIMARY KEY,
        league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (league_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS fighters (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        weight_class TEXT,
        is_ranked BOOLEAN NOT NULL DEFAULT FALSE,
        has_ufc_contract BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS roster_slots (
        id SERIAL PRIMARY KEY,
        league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fighter_id INTEGER NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
        drafted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (league_id, fighter_id),
        UNIQUE (league_id, user_id, fighter_id)
      );

      CREATE TABLE IF NOT EXISTS fights (
        id SERIAL PRIMARY KEY,
        league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        fight_date DATE NOT NULL,
        winner_fighter_id INTEGER NOT NULL REFERENCES fighters(id),
        loser_fighter_id INTEGER NOT NULL REFERENCES fighters(id),
        method TEXT,
        was_finish BOOLEAN NOT NULL DEFAULT FALSE,
        was_five_round_fight BOOLEAN NOT NULL DEFAULT FALSE,
        was_championship_fight BOOLEAN NOT NULL DEFAULT FALSE,
        faced_ranked_opponent BOOLEAN NOT NULL DEFAULT FALSE,
        was_title_move_fight BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (winner_fighter_id <> loser_fighter_id)
      );
    `);

    for (const fighter of seededFighters) {
      await client.query(
        `
          INSERT INTO fighters (name, weight_class, is_ranked, has_ufc_contract)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (name) DO NOTHING
        `,
        fighter
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  getClient,
  initializeDatabase
};
