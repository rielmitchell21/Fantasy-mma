const { query } = require("../../../../lib/db");
const { requireAuth } = require("../../../../lib/auth");
const { toBool } = require("../../../../lib/league-utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const leagueId = Number(req.query.id);
  const name = (req.body?.name || "").trim();
  const weightClass = (req.body?.weightClass || "").trim();
  const isRanked = toBool(req.body?.isRanked);

  if (!leagueId || !name) {
    return res.status(400).json({ error: "League and fighter name are required." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE id = $1 LIMIT 1", [leagueId]);
    const league = leagueResult.rows[0];
    if (!league) return res.status(404).json({ error: "League not found." });
    if (league.commissioner_user_id !== user.id) {
      return res.status(403).json({ error: "Only commissioner can add fighters." });
    }

    const existing = await query("SELECT id FROM fighters WHERE name = $1 LIMIT 1", [name]);
    if (existing.rows[0]) return res.status(409).json({ error: "Fighter already exists." });

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
};
