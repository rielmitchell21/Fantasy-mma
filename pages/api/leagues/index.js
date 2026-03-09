const { query, getClient } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { generateInviteCode } = require("../../../lib/league-utils");

async function listLeagues(userId) {
  const { rows } = await query(
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
    [userId]
  );
  return rows;
}

module.exports = async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    try {
      const leagues = await listLeagues(user.id);
      return res.status(200).json({ leagues });
    } catch (error) {
      return res.status(500).json({ error: "Failed to load leagues." });
    }
  }

  if (req.method === "POST") {
    const { name, maxUsers, rosterSize } = req.body || {};
    const cleanName = (name || "").trim();
    const safeMaxUsers = Number(maxUsers);
    const safeRosterSize = Number(rosterSize);

    if (!cleanName) {
      return res.status(400).json({ error: "League name is required." });
    }
    if (safeMaxUsers < 5 || safeMaxUsers > 10) {
      return res.status(400).json({ error: "League size must be between 5 and 10 users." });
    }
    if (safeRosterSize < 15 || safeRosterSize > 20) {
      return res.status(400).json({ error: "Roster size must be between 15 and 20." });
    }

    try {
      let inviteCode = generateInviteCode();
      for (let i = 0; i < 8; i += 1) {
        const existing = await query("SELECT id FROM leagues WHERE invite_code = $1 LIMIT 1", [
          inviteCode
        ]);
        if (!existing.rows[0]) break;
        inviteCode = generateInviteCode();
      }

      const client = await getClient();
      try {
        await client.query("BEGIN");
        const created = await client.query(
          `
          INSERT INTO leagues (name, invite_code, commissioner_user_id, min_users, max_users, roster_size)
          VALUES ($1, $2, $3, 5, $4, $5)
          RETURNING id
        `,
          [cleanName, inviteCode, user.id, safeMaxUsers, safeRosterSize]
        );
        const leagueId = created.rows[0].id;
        await client.query(
          `
          INSERT INTO league_members (league_id, user_id)
          VALUES ($1, $2)
        `,
          [leagueId, user.id]
        );
        await client.query("COMMIT");
        return res.status(201).json({ leagueId, inviteCode });
      } catch (txnError) {
        await client.query("ROLLBACK");
        throw txnError;
      } finally {
        client.release();
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to create league." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
