const { query } = require("../../../../lib/db");
const { requireAuth } = require("../../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const leagueId = Number(req.query.id);
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

    const membership = await query(
      "SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 LIMIT 1",
      [leagueId, user.id]
    );
    if (!membership.rows[0]) return res.status(403).json({ error: "Not a league member." });

    const rosterCountResult = await query(
      "SELECT COUNT(*)::INT AS count FROM roster_slots WHERE league_id = $1 AND user_id = $2",
      [leagueId, user.id]
    );
    if (rosterCountResult.rows[0].count >= league.roster_size) {
      return res.status(400).json({ error: "Your roster is full." });
    }

    const fighterResult = await query(
      "SELECT id, name FROM fighters WHERE id = $1 AND has_ufc_contract = TRUE LIMIT 1",
      [fighterId]
    );
    const fighter = fighterResult.rows[0];
    if (!fighter) return res.status(404).json({ error: "Fighter not available." });

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
      [leagueId, user.id, fighterId]
    );

    return res.status(201).json({ message: `${fighter.name} drafted.` });
  } catch (error) {
    return res.status(500).json({ error: "Draft pick failed." });
  }
};
