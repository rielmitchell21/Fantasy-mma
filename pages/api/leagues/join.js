const { query } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const inviteCode = (req.body?.inviteCode || "").trim().toUpperCase();
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

    const existingMember = await query(
      "SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 LIMIT 1",
      [league.id, user.id]
    );
    if (existingMember.rows[0]) {
      return res.status(200).json({ leagueId: league.id });
    }

    const memberCount = await query(
      "SELECT COUNT(*)::INT AS count FROM league_members WHERE league_id = $1",
      [league.id]
    );
    if (memberCount.rows[0].count >= league.max_users) {
      return res.status(400).json({ error: "League is full." });
    }

    await query("INSERT INTO league_members (league_id, user_id) VALUES ($1, $2)", [
      league.id,
      user.id
    ]);

    return res.status(200).json({ leagueId: league.id });
  } catch (error) {
    return res.status(500).json({ error: "Failed to join league." });
  }
};
