require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const dayjs = require("dayjs");
const { query, getClient, initializeDatabase } = require("./db");
const { createUserSession, clearUserSession, getCurrentUser, requireAuth } = require("./auth");
const { calculateFightPoints } = require("./scoring");
const { generateInviteCode, toBoolean } = require("./utils");

const app = express();
const port = Number(process.env.BACKEND_PORT || 4000);

app.use(express.json());

app.use((req, res, next) => {
  const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");

  if (username.length < 3 || !email.includes("@") || password.length < 8) {
    return res.status(400).json({
      error: "Username must be 3+ chars, email must be valid, and password must be 8+ chars."
    });
  }

  try {
    const existing = await query(
      "SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
      [username, email]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: "Username or email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await query(
      `
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, username, email
      `,
      [username, email, passwordHash]
    );

    const user = inserted.rows[0];
    await createUserSession(res, user.id);
    return res.status(201).json({ user });
  } catch (error) {
    return res.status(500).json({ error: "Signup failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const identifier = String(req.body?.identifier || "").trim();
  const password = String(req.body?.password || "");

  if (!identifier || !password) {
    return res.status(400).json({ error: "Identifier and password are required." });
  }

  try {
    const found = await query(
      `
        SELECT id, username, email, password_hash
        FROM users
        WHERE username = $1 OR email = $2
        LIMIT 1
      `,
      [identifier, identifier.toLowerCase()]
    );
    const user = found.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    await createUserSession(res, user.id);
    return res.status(200).json({
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    await clearUserSession(req, res);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Logout failed." });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user." });
  }
});

app.get("/api/leagues", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          l.id,
          l.name,
          l.invite_code,
          l.max_users,
          l.roster_size,
          l.draft_started_at,
          l.season_ends_at,
          (
            SELECT COUNT(*)
            FROM league_members lm2
            WHERE lm2.league_id = l.id
          )::INT AS member_count
        FROM league_members lm
        JOIN leagues l ON l.id = lm.league_id
        WHERE lm.user_id = $1
        ORDER BY l.created_at DESC
      `,
      [req.user.id]
    );
    return res.status(200).json({ leagues: result.rows });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load leagues." });
  }
});

app.post("/api/leagues", requireAuth, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const maxUsers = Number(req.body?.maxUsers);
  const rosterSize = Number(req.body?.rosterSize);

  if (!name) {
    return res.status(400).json({ error: "League name is required." });
  }
  if (maxUsers < 5 || maxUsers > 10) {
    return res.status(400).json({ error: "Leagues must have 5-10 users." });
  }
  if (rosterSize < 15 || rosterSize > 20) {
    return res.status(400).json({ error: "Roster size must be 15-20." });
  }

  const client = await getClient();
  try {
    let inviteCode = generateInviteCode();
    for (let i = 0; i < 10; i += 1) {
      const existing = await client.query("SELECT id FROM leagues WHERE invite_code = $1", [
        inviteCode
      ]);
      if (!existing.rows[0]) break;
      inviteCode = generateInviteCode();
    }

    await client.query("BEGIN");
    const leagueInserted = await client.query(
      `
        INSERT INTO leagues (name, invite_code, commissioner_user_id, min_users, max_users, roster_size)
        VALUES ($1, $2, $3, 5, $4, $5)
        RETURNING id
      `,
      [name, inviteCode, req.user.id, maxUsers, rosterSize]
    );
    const leagueId = leagueInserted.rows[0].id;
    await client.query(
      `
        INSERT INTO league_members (league_id, user_id)
        VALUES ($1, $2)
      `,
      [leagueId, req.user.id]
    );
    await client.query("COMMIT");
    return res.status(201).json({ leagueId, inviteCode });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to create league." });
  } finally {
    client.release();
  }
});

app.post("/api/leagues/join", requireAuth, async (req, res) => {
  const inviteCode = String(req.body?.inviteCode || "")
    .trim()
    .toUpperCase();
  if (!inviteCode) {
    return res.status(400).json({ error: "Invite code is required." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE invite_code = $1 LIMIT 1", [
      inviteCode
    ]);
    const league = leagueResult.rows[0];
    if (!league) {
      return res.status(404).json({ error: "Invite code not found." });
    }

    const existing = await query(
      "SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 LIMIT 1",
      [league.id, req.user.id]
    );
    if (existing.rows[0]) {
      return res.status(200).json({ leagueId: league.id });
    }

    const countResult = await query(
      "SELECT COUNT(*)::INT AS count FROM league_members WHERE league_id = $1",
      [league.id]
    );
    if (countResult.rows[0].count >= league.max_users) {
      return res.status(400).json({ error: "League is full." });
    }

    await query(
      `
        INSERT INTO league_members (league_id, user_id)
        VALUES ($1, $2)
      `,
      [league.id, req.user.id]
    );

    return res.status(200).json({ leagueId: league.id });
  } catch (error) {
    return res.status(500).json({ error: "Failed to join league." });
  }
});

app.get("/api/leagues/:id", requireAuth, async (req, res) => {
  const leagueId = Number(req.params.id);
  if (!leagueId) {
    return res.status(400).json({ error: "Invalid league id." });
  }

  try {
    const leagueResult = await query(
      `
        SELECT
          l.*,
          u.username AS commissioner_username,
          (
            SELECT COUNT(*)
            FROM league_members lm2
            WHERE lm2.league_id = l.id
          )::INT AS member_count
        FROM leagues l
        JOIN users u ON u.id = l.commissioner_user_id
        WHERE l.id = $1
        LIMIT 1
      `,
      [leagueId]
    );
    const league = leagueResult.rows[0];
    if (!league) {
      return res.status(404).json({ error: "League not found." });
    }

    const membership = await query(
      "SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 LIMIT 1",
      [leagueId, req.user.id]
    );
    if (!membership.rows[0]) {
      return res.status(403).json({ error: "You are not in this league." });
    }

    const membersResult = await query(
      `
        SELECT
          u.id,
          u.username,
          (
            SELECT COUNT(*)
            FROM roster_slots rs
            WHERE rs.league_id = $1
              AND rs.user_id = u.id
          )::INT AS roster_count
        FROM league_members lm
        JOIN users u ON u.id = lm.user_id
        WHERE lm.league_id = $1
        ORDER BY u.username ASC
      `,
      [leagueId]
    );

    const myRosterResult = await query(
      `
        SELECT f.id, f.name, f.weight_class, f.is_ranked
        FROM roster_slots rs
        JOIN fighters f ON f.id = rs.fighter_id
        WHERE rs.league_id = $1 AND rs.user_id = $2
        ORDER BY f.name ASC
      `,
      [leagueId, req.user.id]
    );

    const availableResult = await query(
      `
        SELECT f.id, f.name, f.weight_class, f.is_ranked
        FROM fighters f
        WHERE f.has_ufc_contract = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM roster_slots rs
            WHERE rs.league_id = $1
              AND rs.fighter_id = f.id
          )
        ORDER BY f.name ASC
      `,
      [leagueId]
    );

    const allUfcResult = await query(
      `
        SELECT id, name
        FROM fighters
        WHERE has_ufc_contract = TRUE
        ORDER BY name ASC
      `
    );

    const standings = membersResult.rows.map((member) => ({
      userId: member.id,
      username: member.username,
      points: 0,
      scoringWins: 0
    }));
    const standingsMap = new Map();
    standings.forEach((item) => standingsMap.set(item.userId, item));

    let fights = [];
    if (league.draft_started_at && league.season_ends_at) {
      const fightsResult = await query(
        `
          SELECT
            f.*,
            winner.name AS winner_name,
            loser.name AS loser_name,
            rs.user_id AS winner_user_id
          FROM fights f
          JOIN fighters winner ON winner.id = f.winner_fighter_id
          JOIN fighters loser ON loser.id = f.loser_fighter_id
          LEFT JOIN roster_slots rs
            ON rs.league_id = f.league_id
           AND rs.fighter_id = f.winner_fighter_id
          WHERE f.league_id = $1
            AND f.fight_date >= $2
            AND f.fight_date <= $3
          ORDER BY f.fight_date DESC, f.id DESC
        `,
        [leagueId, league.draft_started_at, league.season_ends_at]
      );

      fights = fightsResult.rows.map((fight) => {
        const winnerOwner = standingsMap.get(fight.winner_user_id);
        const points = calculateFightPoints(fight);
        if (winnerOwner) {
          winnerOwner.points += points;
          winnerOwner.scoringWins += 1;
        }
        return {
          id: fight.id,
          fight_date: fight.fight_date,
          winner_name: fight.winner_name,
          loser_name: fight.loser_name,
          method: fight.method,
          pointsAwardedToWinner: winnerOwner ? points : 0,
          awardedToUser: winnerOwner ? winnerOwner.username : null
        };
      });
    }

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.scoringWins - a.scoringWins;
    });

    return res.status(200).json({
      league,
      members: membersResult.rows,
      myRoster: myRosterResult.rows,
      availableFighters: availableResult.rows,
      allUfcFighters: allUfcResult.rows,
      standings,
      fights,
      isCommissioner: league.commissioner_user_id === req.user.id
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load league details." });
  }
});

app.post("/api/leagues/:id/start-draft", requireAuth, async (req, res) => {
  const leagueId = Number(req.params.id);
  if (!leagueId) {
    return res.status(400).json({ error: "Invalid league id." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE id = $1 LIMIT 1", [leagueId]);
    const league = leagueResult.rows[0];
    if (!league) return res.status(404).json({ error: "League not found." });
    if (league.commissioner_user_id !== req.user.id) {
      return res.status(403).json({ error: "Only commissioner can start draft." });
    }
    if (league.draft_started_at) {
      return res.status(400).json({ error: "Draft already started." });
    }

    const countResult = await query(
      "SELECT COUNT(*)::INT AS count FROM league_members WHERE league_id = $1",
      [leagueId]
    );
    if (countResult.rows[0].count < league.min_users) {
      return res.status(400).json({ error: "Need at least 5 users to start draft." });
    }

    const draftStartedAt = dayjs().format("YYYY-MM-DD");
    const seasonEndsAt = dayjs().add(1, "year").format("YYYY-MM-DD");
    await query(
      `
        UPDATE leagues
        SET draft_started_at = $1, season_ends_at = $2
        WHERE id = $3
      `,
      [draftStartedAt, seasonEndsAt, leagueId]
    );

    return res.status(200).json({ draftStartedAt, seasonEndsAt });
  } catch (error) {
    return res.status(500).json({ error: "Failed to start draft." });
  }
});

app.post("/api/leagues/:id/draft", requireAuth, async (req, res) => {
  const leagueId = Number(req.params.id);
  const fighterId = Number(req.body?.fighterId);

  if (!leagueId || !fighterId) {
    return res.status(400).json({ error: "League and fighter are required." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE id = $1 LIMIT 1", [leagueId]);
    const league = leagueResult.rows[0];
    if (!league) return res.status(404).json({ error: "League not found." });
    if (!league.draft_started_at) {
      return res.status(400).json({ error: "Draft has not started yet." });
    }

    const member = await query(
      "SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 LIMIT 1",
      [leagueId, req.user.id]
    );
    if (!member.rows[0]) return res.status(403).json({ error: "Not a league member." });

    const rosterCount = await query(
      `
        SELECT COUNT(*)::INT AS count
        FROM roster_slots
        WHERE league_id = $1 AND user_id = $2
      `,
      [leagueId, req.user.id]
    );
    if (rosterCount.rows[0].count >= league.roster_size) {
      return res.status(400).json({ error: "Roster limit reached." });
    }

    const fighter = await query(
      "SELECT id, name FROM fighters WHERE id = $1 AND has_ufc_contract = TRUE LIMIT 1",
      [fighterId]
    );
    if (!fighter.rows[0]) return res.status(404).json({ error: "Fighter not found." });

    const taken = await query(
      "SELECT id FROM roster_slots WHERE league_id = $1 AND fighter_id = $2 LIMIT 1",
      [leagueId, fighterId]
    );
    if (taken.rows[0]) {
      return res.status(409).json({ error: "Fighter already drafted in this league." });
    }

    await query(
      `
        INSERT INTO roster_slots (league_id, user_id, fighter_id)
        VALUES ($1, $2, $3)
      `,
      [leagueId, req.user.id, fighterId]
    );

    return res.status(201).json({ message: `${fighter.rows[0].name} drafted.` });
  } catch (error) {
    return res.status(500).json({ error: "Draft pick failed." });
  }
});

app.post("/api/leagues/:id/fighters", requireAuth, async (req, res) => {
  const leagueId = Number(req.params.id);
  const name = String(req.body?.name || "").trim();
  const weightClass = String(req.body?.weightClass || "").trim();
  const isRanked = toBoolean(req.body?.isRanked);

  if (!leagueId || !name) {
    return res.status(400).json({ error: "League and fighter name are required." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE id = $1 LIMIT 1", [leagueId]);
    const league = leagueResult.rows[0];
    if (!league) return res.status(404).json({ error: "League not found." });
    if (league.commissioner_user_id !== req.user.id) {
      return res.status(403).json({ error: "Only commissioner can add fighters." });
    }

    const exists = await query("SELECT id FROM fighters WHERE name = $1 LIMIT 1", [name]);
    if (exists.rows[0]) {
      return res.status(409).json({ error: "Fighter already exists." });
    }

    await query(
      `
        INSERT INTO fighters (name, weight_class, is_ranked, has_ufc_contract)
        VALUES ($1, $2, $3, TRUE)
      `,
      [name, weightClass || null, isRanked]
    );
    return res.status(201).json({ message: "Fighter added." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to add fighter." });
  }
});

app.post("/api/leagues/:id/fights", requireAuth, async (req, res) => {
  const leagueId = Number(req.params.id);
  const fightDate = String(req.body?.fightDate || "").trim();
  const winnerFighterId = Number(req.body?.winnerFighterId);
  const loserFighterId = Number(req.body?.loserFighterId);

  if (!leagueId || !fightDate || !winnerFighterId || !loserFighterId) {
    return res.status(400).json({ error: "Missing required fight fields." });
  }
  if (winnerFighterId === loserFighterId) {
    return res.status(400).json({ error: "Winner and loser must be different." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fightDate) || !dayjs(fightDate).isValid()) {
    return res.status(400).json({ error: "Fight date must be YYYY-MM-DD." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE id = $1 LIMIT 1", [leagueId]);
    const league = leagueResult.rows[0];
    if (!league) return res.status(404).json({ error: "League not found." });
    if (league.commissioner_user_id !== req.user.id) {
      return res.status(403).json({ error: "Only commissioner can record fights." });
    }
    if (!league.draft_started_at || !league.season_ends_at) {
      return res.status(400).json({ error: "Draft must be started first." });
    }
    if (fightDate < String(league.draft_started_at) || fightDate > String(league.season_ends_at)) {
      return res.status(400).json({
        error: `Fight date must be between ${league.draft_started_at} and ${league.season_ends_at}.`
      });
    }

    const winner = await query(
      "SELECT id FROM fighters WHERE id = $1 AND has_ufc_contract = TRUE LIMIT 1",
      [winnerFighterId]
    );
    const loser = await query(
      "SELECT id FROM fighters WHERE id = $1 AND has_ufc_contract = TRUE LIMIT 1",
      [loserFighterId]
    );
    if (!winner.rows[0] || !loser.rows[0]) {
      return res.status(400).json({ error: "Fighters must be on UFC roster." });
    }

    await query(
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
          faced_ranked_opponent,
          was_title_move_fight,
          notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      `,
      [
        leagueId,
        fightDate,
        winnerFighterId,
        loserFighterId,
        String(req.body?.method || "").trim() || null,
        toBoolean(req.body?.wasFinish),
        toBoolean(req.body?.wasFiveRoundFight),
        toBoolean(req.body?.wasChampionshipFight),
        toBoolean(req.body?.facedRankedOpponent),
        toBoolean(req.body?.wasTitleMoveFight),
        String(req.body?.notes || "").trim() || null
      ]
    );

    return res.status(201).json({ message: "Fight recorded." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to record fight." });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(port, async () => {
  try {
    await initializeDatabase();
    // Session cleanup keeps auth table small during long-running local usage.
    await query("DELETE FROM sessions WHERE expires_at <= NOW()");
    console.log(`Backend running on http://localhost:${port}`);
  } catch (error) {
    console.warn("Backend running, but database init failed:", error.message);
    console.warn("Start PostgreSQL and run: npm run db:init --workspace backend");
    console.log(`Backend running on http://localhost:${port}`);
  }
});
