const dayjs = require("dayjs");
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
  const fightDate = (req.body?.fightDate || "").trim();
  const winnerFighterId = Number(req.body?.winnerFighterId);
  const loserFighterId = Number(req.body?.loserFighterId);
  const method = (req.body?.method || "").trim();
  const notes = (req.body?.notes || "").trim();

  if (!leagueId || !fightDate || !winnerFighterId || !loserFighterId) {
    return res.status(400).json({ error: "Required fields are missing." });
  }
  if (winnerFighterId === loserFighterId) {
    return res.status(400).json({ error: "Winner and loser must be different fighters." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fightDate) || !dayjs(fightDate).isValid()) {
    return res.status(400).json({ error: "Fight date must be valid YYYY-MM-DD." });
  }

  try {
    const leagueResult = await query("SELECT * FROM leagues WHERE id = $1 LIMIT 1", [leagueId]);
    const league = leagueResult.rows[0];
    if (!league) return res.status(404).json({ error: "League not found." });
    if (league.commissioner_user_id !== user.id) {
      return res.status(403).json({ error: "Only commissioner can record fights." });
    }
    if (!league.draft_started_at || !league.season_ends_at) {
      return res.status(400).json({ error: "Draft must be started first." });
    }
    if (fightDate < String(league.draft_started_at) || fightDate > String(league.season_ends_at)) {
      return res.status(400).json({
        error: `Fight date must be within ${league.draft_started_at} and ${league.season_ends_at}.`
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
      return res.status(400).json({ error: "Only UFC roster fighters can be used." });
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
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11
      )
    `,
      [
        leagueId,
        fightDate,
        winnerFighterId,
        loserFighterId,
        method || null,
        toBool(req.body?.wasFinish),
        toBool(req.body?.wasFiveRoundFight),
        toBool(req.body?.wasChampionshipFight),
        toBool(req.body?.facedRankedOpponent),
        toBool(req.body?.wasTitleMoveFight),
        notes || null
      ]
    );

    return res.status(201).json({ message: "Fight recorded." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to record fight." });
  }
};
