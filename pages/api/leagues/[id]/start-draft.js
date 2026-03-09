const dayjs = require("dayjs");
const { query } = require("../../../../lib/db");
const { requireAuth } = require("../../../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const leagueId = Number(req.query.id);
  if (!leagueId) {
    return res.status(400).json({ error: "Invalid league id." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE id = $1 LIMIT 1", [leagueId]);
    const league = leagueResult.rows[0];
    if (!league) return res.status(404).json({ error: "League not found." });
    if (league.commissioner_user_id !== user.id) {
      return res.status(403).json({ error: "Only commissioner can start draft." });
    }
    if (league.draft_started_at) {
      return res.status(400).json({ error: "Draft already started." });
    }

    const memberCountResult = await query(
      "SELECT COUNT(*)::INT AS count FROM league_members WHERE league_id = $1",
      [leagueId]
    );
    if (memberCountResult.rows[0].count < 5) {
      return res.status(400).json({ error: "Need at least 5 users to start draft." });
    }

    const draftStartedAt = dayjs().format("YYYY-MM-DD");
    const seasonEndsAt = dayjs().add(1, "year").format("YYYY-MM-DD");

    await query(
      `
      UPDATE leagues
      SET draft_started_at = $1,
          season_ends_at = $2
      WHERE id = $3
    `,
      [draftStartedAt, seasonEndsAt, leagueId]
    );

    return res.status(200).json({ draftStartedAt, seasonEndsAt });
  } catch (error) {
    return res.status(500).json({ error: "Failed to start draft." });
  }
};
