const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const dayjs = require("dayjs");
const SQLiteStoreFactory = require("connect-sqlite3");

const { db, initDatabase, seedFighters, generateInviteCode } = require("./db");
const { getLeagueStandings } = require("./scoring");

initDatabase();
seedFighters();

const SQLiteStore = SQLiteStoreFactory(session);
const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: path.join(__dirname, "..", "data")
    }),
    secret: process.env.SESSION_SECRET || "fantasy-ufc-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 14 }
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    setFlash(req, "error", "Please log in first.");
    return res.redirect("/login");
  }
  return next();
}

function parseIntOrDefault(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseCheckbox(value) {
  return value === "on" || value === "1" || value === 1 || value === true;
}

function isMember(leagueId, userId) {
  const row = db
    .prepare("SELECT 1 FROM league_members WHERE league_id = ? AND user_id = ?")
    .get(leagueId, userId);
  return Boolean(row);
}

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  return res.render("home", { title: "Fantasy UFC" });
});

app.get("/signup", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  return res.render("signup", { title: "Sign Up" });
});

app.post("/signup", async (req, res) => {
  const username = (req.body.username || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (username.length < 3 || password.length < 8 || !email.includes("@")) {
    setFlash(
      req,
      "error",
      "Username must be 3+ chars, password 8+ chars, and email must be valid."
    );
    return res.redirect("/signup");
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ? OR email = ?")
    .get(username, email);
  if (existing) {
    setFlash(req, "error", "Username or email already exists.");
    return res.redirect("/signup");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const insert = db.prepare(`
    INSERT INTO users (username, email, password_hash)
    VALUES (?, ?, ?)
  `);
  const result = insert.run(username, email, passwordHash);
  const userId = result.lastInsertRowid;

  req.session.user = { id: Number(userId), username, email };
  setFlash(req, "success", "Account created. Welcome to Fantasy UFC.");
  return res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  return res.render("login", { title: "Log In" });
});

app.post("/login", async (req, res) => {
  const identifier = (req.body.identifier || "").trim();
  const password = req.body.password || "";

  const user = db
    .prepare(
      `
      SELECT id, username, email, password_hash
      FROM users
      WHERE username = ? OR email = ?
    `
    )
    .get(identifier, identifier.toLowerCase());

  if (!user) {
    setFlash(req, "error", "Invalid login credentials.");
    return res.redirect("/login");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    setFlash(req, "error", "Invalid login credentials.");
    return res.redirect("/login");
  }

  req.session.user = { id: user.id, username: user.username, email: user.email };
  setFlash(req, "success", "Logged in successfully.");
  return res.redirect("/dashboard");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/dashboard", requireAuth, (req, res) => {
  const leagues = db
    .prepare(
      `
      SELECT
        l.*,
        (SELECT COUNT(*) FROM league_members lm2 WHERE lm2.league_id = l.id) AS member_count
      FROM league_members lm
      JOIN leagues l ON l.id = lm.league_id
      WHERE lm.user_id = ?
      ORDER BY l.created_at DESC
    `
    )
    .all(req.session.user.id);

  return res.render("dashboard", { title: "Dashboard", leagues });
});

app.post("/leagues/create", requireAuth, (req, res) => {
  const name = (req.body.name || "").trim();
  const maxUsers = parseIntOrDefault(req.body.maxUsers, 10);
  const rosterSize = parseIntOrDefault(req.body.rosterSize, 15);

  if (!name) {
    setFlash(req, "error", "League name is required.");
    return res.redirect("/dashboard");
  }
  if (maxUsers < 5 || maxUsers > 10) {
    setFlash(req, "error", "Leagues must allow 5-10 users.");
    return res.redirect("/dashboard");
  }
  if (rosterSize < 15 || rosterSize > 20) {
    setFlash(req, "error", "Roster size must be 15-20 fighters.");
    return res.redirect("/dashboard");
  }

  let inviteCode = generateInviteCode();
  while (db.prepare("SELECT id FROM leagues WHERE invite_code = ?").get(inviteCode)) {
    inviteCode = generateInviteCode();
  }

  const createLeague = db.prepare(`
    INSERT INTO leagues (
      name,
      invite_code,
      commissioner_user_id,
      min_users,
      max_users,
      roster_size
    )
    VALUES (?, ?, ?, 5, ?, ?)
  `);
  const leagueResult = createLeague.run(
    name,
    inviteCode,
    req.session.user.id,
    maxUsers,
    rosterSize
  );
  const leagueId = Number(leagueResult.lastInsertRowid);

  db.prepare(
    `
    INSERT INTO league_members (league_id, user_id)
    VALUES (?, ?)
  `
  ).run(leagueId, req.session.user.id);

  setFlash(req, "success", `League created. Invite code: ${inviteCode}`);
  return res.redirect(`/leagues/${leagueId}`);
});

app.post("/leagues/join", requireAuth, (req, res) => {
  const inviteCode = (req.body.inviteCode || "").trim().toUpperCase();
  const league = db
    .prepare("SELECT * FROM leagues WHERE invite_code = ?")
    .get(inviteCode);

  if (!league) {
    setFlash(req, "error", "Invite code not found.");
    return res.redirect("/dashboard");
  }

  const alreadyMember = isMember(league.id, req.session.user.id);
  if (alreadyMember) {
    return res.redirect(`/leagues/${league.id}`);
  }

  const memberCount = db
    .prepare("SELECT COUNT(*) AS count FROM league_members WHERE league_id = ?")
    .get(league.id).count;
  if (memberCount >= league.max_users) {
    setFlash(req, "error", "This league is already full.");
    return res.redirect("/dashboard");
  }

  db.prepare(
    `
    INSERT INTO league_members (league_id, user_id)
    VALUES (?, ?)
  `
  ).run(league.id, req.session.user.id);

  setFlash(req, "success", "You joined the league.");
  return res.redirect(`/leagues/${league.id}`);
});

app.post("/leagues/:leagueId/start-draft", requireAuth, (req, res) => {
  const leagueId = Number(req.params.leagueId);
  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(leagueId);
  if (!league) {
    setFlash(req, "error", "League not found.");
    return res.redirect("/dashboard");
  }
  if (!isMember(leagueId, req.session.user.id)) {
    setFlash(req, "error", "You are not a member of that league.");
    return res.redirect("/dashboard");
  }
  if (league.commissioner_user_id !== req.session.user.id) {
    setFlash(req, "error", "Only the commissioner can start the draft.");
    return res.redirect(`/leagues/${leagueId}`);
  }
  if (league.draft_started_at) {
    setFlash(req, "error", "Draft has already started.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  const memberCount = db
    .prepare("SELECT COUNT(*) AS count FROM league_members WHERE league_id = ?")
    .get(leagueId).count;
  if (memberCount < league.min_users) {
    setFlash(req, "error", `Need at least ${league.min_users} members to start.`);
    return res.redirect(`/leagues/${leagueId}`);
  }

  const draftStartedAt = dayjs().format("YYYY-MM-DD");
  const seasonEndsAt = dayjs().add(1, "year").format("YYYY-MM-DD");

  db.prepare(
    `
    UPDATE leagues
    SET draft_started_at = ?, season_ends_at = ?
    WHERE id = ?
  `
  ).run(draftStartedAt, seasonEndsAt, leagueId);

  setFlash(
    req,
    "success",
    `Draft started. Only fights between ${draftStartedAt} and ${seasonEndsAt} count.`
  );
  return res.redirect(`/leagues/${leagueId}`);
});

app.post("/leagues/:leagueId/draft", requireAuth, (req, res) => {
  const leagueId = Number(req.params.leagueId);
  const fighterId = Number(req.body.fighterId);
  const userId = req.session.user.id;

  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(leagueId);
  if (!league) {
    setFlash(req, "error", "League not found.");
    return res.redirect("/dashboard");
  }
  if (!isMember(leagueId, userId)) {
    setFlash(req, "error", "You are not a member of that league.");
    return res.redirect("/dashboard");
  }
  if (!league.draft_started_at) {
    setFlash(req, "error", "Draft has not started yet.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  const rosterCount = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM roster_slots
      WHERE league_id = ? AND user_id = ?
    `
    )
    .get(leagueId, userId).count;
  if (rosterCount >= league.roster_size) {
    setFlash(
      req,
      "error",
      `Roster is full. This league allows ${league.roster_size} fighters per user.`
    );
    return res.redirect(`/leagues/${leagueId}`);
  }

  const fighter = db
    .prepare(
      `
      SELECT id, name, has_ufc_contract
      FROM fighters
      WHERE id = ?
    `
    )
    .get(fighterId);
  if (!fighter || Number(fighter.has_ufc_contract) !== 1) {
    setFlash(req, "error", "Fighter not available for draft.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  const alreadyDrafted = db
    .prepare(
      `
      SELECT 1
      FROM roster_slots
      WHERE league_id = ? AND fighter_id = ?
    `
    )
    .get(leagueId, fighterId);
  if (alreadyDrafted) {
    setFlash(req, "error", "That fighter has already been drafted in this league.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  db.prepare(
    `
    INSERT INTO roster_slots (league_id, user_id, fighter_id)
    VALUES (?, ?, ?)
  `
  ).run(leagueId, userId, fighterId);

  setFlash(req, "success", `${fighter.name} added to your roster.`);
  return res.redirect(`/leagues/${leagueId}`);
});

app.post("/leagues/:leagueId/fighters/add", requireAuth, (req, res) => {
  const leagueId = Number(req.params.leagueId);
  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(leagueId);
  if (!league || !isMember(leagueId, req.session.user.id)) {
    setFlash(req, "error", "League not found.");
    return res.redirect("/dashboard");
  }
  if (league.commissioner_user_id !== req.session.user.id) {
    setFlash(req, "error", "Only commissioner can add fighters.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  const name = (req.body.name || "").trim();
  const weightClass = (req.body.weightClass || "").trim();
  const isRanked = parseCheckbox(req.body.isRanked) ? 1 : 0;

  if (!name) {
    setFlash(req, "error", "Fighter name is required.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  const exists = db.prepare("SELECT id FROM fighters WHERE name = ?").get(name);
  if (exists) {
    setFlash(req, "error", "Fighter already exists in the pool.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  db.prepare(
    `
    INSERT INTO fighters (name, weight_class, is_ranked, has_ufc_contract)
    VALUES (?, ?, ?, 1)
  `
  ).run(name, weightClass || null, isRanked);

  setFlash(req, "success", "Fighter added to the UFC fighter pool.");
  return res.redirect(`/leagues/${leagueId}`);
});

app.post("/leagues/:leagueId/fights/add", requireAuth, (req, res) => {
  const leagueId = Number(req.params.leagueId);
  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(leagueId);
  if (!league || !isMember(leagueId, req.session.user.id)) {
    setFlash(req, "error", "League not found.");
    return res.redirect("/dashboard");
  }
  if (league.commissioner_user_id !== req.session.user.id) {
    setFlash(req, "error", "Only commissioner can record fights.");
    return res.redirect(`/leagues/${leagueId}`);
  }
  if (!league.draft_started_at || !league.season_ends_at) {
    setFlash(req, "error", "Start the draft first.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  const fightDate = (req.body.fightDate || "").trim();
  const winnerFighterId = Number(req.body.winnerFighterId);
  const loserFighterId = Number(req.body.loserFighterId);
  const method = (req.body.method || "").trim();
  const notes = (req.body.notes || "").trim();

  const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(fightDate);
  if (!isDateLike || !dayjs(fightDate).isValid()) {
    setFlash(req, "error", "Fight date must be a valid date.");
    return res.redirect(`/leagues/${leagueId}`);
  }
  if (!winnerFighterId || !loserFighterId || winnerFighterId === loserFighterId) {
    setFlash(req, "error", "Choose different winner and loser fighters.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  if (fightDate < league.draft_started_at || fightDate > league.season_ends_at) {
    setFlash(
      req,
      "error",
      `Fight must be between ${league.draft_started_at} and ${league.season_ends_at}.`
    );
    return res.redirect(`/leagues/${leagueId}`);
  }

  const winner = db
    .prepare("SELECT id FROM fighters WHERE id = ? AND has_ufc_contract = 1")
    .get(winnerFighterId);
  const loser = db
    .prepare("SELECT id FROM fighters WHERE id = ? AND has_ufc_contract = 1")
    .get(loserFighterId);
  if (!winner || !loser) {
    setFlash(req, "error", "Only UFC-contracted fighters are allowed.");
    return res.redirect(`/leagues/${leagueId}`);
  }

  db.prepare(
    `
    INSERT INTO fights (
      league_id,
      fight_date,
      winner_fighter_id,
      loser_fighter_id,
      method,
      was_finish,
      was_five_round_fight,
      was_championship_fight,
      faced_ranked_fighter,
      vacated_title_for_new_division_title_fight,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    leagueId,
    fightDate,
    winnerFighterId,
    loserFighterId,
    method || null,
    parseCheckbox(req.body.wasFinish) ? 1 : 0,
    parseCheckbox(req.body.wasFiveRoundFight) ? 1 : 0,
    parseCheckbox(req.body.wasChampionshipFight) ? 1 : 0,
    parseCheckbox(req.body.facedRankedFighter) ? 1 : 0,
    parseCheckbox(req.body.vacatedTitleForNewDivisionTitleFight) ? 1 : 0,
    notes || null
  );

  setFlash(req, "success", "Fight recorded. Standings updated.");
  return res.redirect(`/leagues/${leagueId}`);
});

app.get("/leagues/:leagueId", requireAuth, (req, res) => {
  const leagueId = Number(req.params.leagueId);
  const userId = req.session.user.id;

  const league = db
    .prepare(
      `
      SELECT
        l.*,
        commissioner.username AS commissioner_username,
        (SELECT COUNT(*) FROM league_members lm2 WHERE lm2.league_id = l.id) AS member_count
      FROM leagues l
      JOIN users commissioner ON commissioner.id = l.commissioner_user_id
      WHERE l.id = ?
    `
    )
    .get(leagueId);
  if (!league) {
    setFlash(req, "error", "League not found.");
    return res.redirect("/dashboard");
  }

  if (!isMember(leagueId, userId)) {
    setFlash(req, "error", "You are not a member of that league.");
    return res.redirect("/dashboard");
  }

  const members = db
    .prepare(
      `
      SELECT
        u.id,
        u.username,
        (SELECT COUNT(*) FROM roster_slots rs WHERE rs.league_id = ? AND rs.user_id = u.id) AS roster_count
      FROM league_members lm
      JOIN users u ON u.id = lm.user_id
      WHERE lm.league_id = ?
      ORDER BY u.username ASC
    `
    )
    .all(leagueId, leagueId);

  const myRoster = db
    .prepare(
      `
      SELECT f.id, f.name, f.weight_class
      FROM roster_slots rs
      JOIN fighters f ON f.id = rs.fighter_id
      WHERE rs.league_id = ? AND rs.user_id = ?
      ORDER BY f.name ASC
    `
    )
    .all(leagueId, userId);

  const availableFighters = db
    .prepare(
      `
      SELECT f.id, f.name, f.weight_class, f.is_ranked
      FROM fighters f
      WHERE f.has_ufc_contract = 1
        AND NOT EXISTS (
          SELECT 1
          FROM roster_slots rs
          WHERE rs.league_id = ? AND rs.fighter_id = f.id
        )
      ORDER BY f.name ASC
    `
    )
    .all(leagueId);

  const allUfcFighters = db
    .prepare(
      `
      SELECT f.id, f.name
      FROM fighters f
      WHERE f.has_ufc_contract = 1
      ORDER BY f.name ASC
    `
    )
    .all();

  const { standings, fights } = getLeagueStandings(db, leagueId);

  return res.render("league", {
    title: league.name,
    league,
    members,
    myRoster,
    availableFighters,
    allUfcFighters,
    standings,
    fights,
    isCommissioner: league.commissioner_user_id === userId,
    today: dayjs().format("YYYY-MM-DD")
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  setFlash(req, "error", "Something went wrong. Please try again.");
  return res.redirect(req.session.user ? "/dashboard" : "/");
});

app.listen(PORT, () => {
  console.log(`Fantasy UFC app running on http://localhost:${PORT}`);
});
