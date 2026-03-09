const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "fantasy-ufc.db"));
db.pragma("foreign_keys = ON");

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      commissioner_user_id INTEGER NOT NULL,
      min_users INTEGER NOT NULL DEFAULT 5,
      max_users INTEGER NOT NULL DEFAULT 10,
      roster_size INTEGER NOT NULL DEFAULT 15,
      draft_started_at TEXT,
      season_ends_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (commissioner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS league_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (league_id, user_id),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fighters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      weight_class TEXT,
      is_ranked INTEGER NOT NULL DEFAULT 0,
      has_ufc_contract INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roster_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      fighter_id INTEGER NOT NULL,
      drafted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (league_id, fighter_id),
      UNIQUE (league_id, user_id, fighter_id),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (fighter_id) REFERENCES fighters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      fight_date TEXT NOT NULL,
      winner_fighter_id INTEGER NOT NULL,
      loser_fighter_id INTEGER NOT NULL,
      method TEXT,
      was_finish INTEGER NOT NULL DEFAULT 0,
      was_five_round_fight INTEGER NOT NULL DEFAULT 0,
      was_championship_fight INTEGER NOT NULL DEFAULT 0,
      faced_ranked_fighter INTEGER NOT NULL DEFAULT 0,
      vacated_title_for_new_division_title_fight INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (winner_fighter_id) REFERENCES fighters(id),
      FOREIGN KEY (loser_fighter_id) REFERENCES fighters(id)
    );
  `);
}

function seedFighters() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM fighters").get().count;
  if (count > 0) {
    return;
  }

  const fighters = [
    ["Islam Makhachev", "Lightweight", 1],
    ["Ilia Topuria", "Featherweight", 1],
    ["Alex Pereira", "Light Heavyweight", 1],
    ["Dricus Du Plessis", "Middleweight", 1],
    ["Belal Muhammad", "Welterweight", 1],
    ["Sean O'Malley", "Bantamweight", 1],
    ["Alexandre Pantoja", "Flyweight", 1],
    ["Merab Dvalishvili", "Bantamweight", 1],
    ["Tom Aspinall", "Heavyweight", 1],
    ["Max Holloway", "Featherweight", 1],
    ["Leon Edwards", "Welterweight", 1],
    ["Jon Jones", "Heavyweight", 1],
    ["Zhang Weili", "Women's Strawweight", 1],
    ["Valentina Shevchenko", "Women's Flyweight", 1],
    ["Amanda Nunes", "Women's Bantamweight", 1],
    ["Manon Fiorot", "Women's Flyweight", 1],
    ["Arman Tsarukyan", "Lightweight", 1],
    ["Justin Gaethje", "Lightweight", 1],
    ["Charles Oliveira", "Lightweight", 1],
    ["Dustin Poirier", "Lightweight", 1],
    ["Khamzat Chimaev", "Middleweight", 1],
    ["Robert Whittaker", "Middleweight", 1],
    ["Israel Adesanya", "Middleweight", 1],
    ["Magomed Ankalaev", "Light Heavyweight", 1],
    ["Jiri Prochazka", "Light Heavyweight", 1]
  ];

  const insert = db.prepare(`
    INSERT INTO fighters (name, weight_class, is_ranked, has_ufc_contract)
    VALUES (?, ?, ?, 1)
  `);

  const insertMany = db.transaction((rows) => {
    rows.forEach((row) => insert.run(...row));
  });

  insertMany(fighters);
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = {
  db,
  initDatabase,
  seedFighters,
  generateInviteCode
};
