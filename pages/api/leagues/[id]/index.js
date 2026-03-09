const { query } = require("../../../../lib/db");
const { requireAuth } = require("../../../../lib/auth");
const { calculateFightPoints } = require("../../../../lib/scoring");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const leagueId = Number(req.query.id);
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
    if (!league) return res.status(404).json({ error: "League not found." });

    const membership = await query(
      "SELECT id FROM league_members WHERE league_id = $1 AND user_id = $2 LIMIT 1",
      [leagueId, user.id]
    );
    if (!membership.rows[0]) {
      return res.status(403).json({ error: "You are not a member of this league." });
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
    const members = membersResult.rows;

    const myRosterResult = await query(
      `
      SELECT f.id, f.name, f.weight_class, f.is_ranked
      FROM roster_slots rs
      JOIN fighters f ON f.id = rs.fighter_id
      WHERE rs.league_id = $1
        AND rs.user_id = $2
      ORDER BY f.name ASC
    `,
      [leagueId, user.id]
    );
    const myRoster = myRosterResult.rows;

    const availableFightersResult = await query(
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
    const availableFighters = availableFightersResult.rows;

    const allUfcFightersResult = await query(
      `
      SELECT id, name
      FROM fighters
      WHERE has_ufc_contract = TRUE
      ORDER BY name ASC
    `
    );
    const allUfcFighters = allUfcFightersResult.rows;

    const standings = members.map((member) => ({
      userId: member.id,
      username: member.username,
      points: 0,
      scoringWins: 0
    }));
    const standingsMap = new Map();
    standings.forEach((row) => standingsMap.set(row.userId, row));

    let fights = [];
    if (league.draft_started_at && league.season_ends_at) {
      const fightsResult = await query(
        `
        SELECT
          f.id,
          f.fight_date,
          f.method,
          f.was_finish,
          f.was_five_round_fight,
          f.was_championship_fight,
          f.faced_ranked_opponent,
          f.was_title_move_fight,
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
        const points = calculateFightPoints(fight);
        const owner = standingsMap.get(fight.winner_user_id);
        if (owner) {
          owner.points += points;
          owner.scoringWins += 1;
        }
        return {
          ...fight,
          pointsAwardedToWinner: owner ? points : 0,
          awardedToUser: owner ? owner.username : null
        };
      });
    }

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.scoringWins - a.scoringWins;
    });

    return res.status(200).json({
      league,
      members,
      myRoster,
      availableFighters,
      allUfcFighters,
      standings,
      fights,
      isCommissioner: league.commissioner_user_id === user.id
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load league." });
  }
};
