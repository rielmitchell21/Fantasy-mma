function calculateFightPoints(fight) {
  let points = 1;
  points += fight.was_finish ? 1 : 0;
  points += fight.was_five_round_fight ? 1 : 0;
  points += fight.was_championship_fight ? 1 : 0;
  points += fight.faced_ranked_fighter ? 1 : 0;
  points += fight.vacated_title_for_new_division_title_fight ? 1 : 0;
  return points;
}

function getLeagueStandings(db, leagueId) {
  const members = db
    .prepare(
      `
      SELECT u.id AS user_id, u.username
      FROM league_members lm
      JOIN users u ON u.id = lm.user_id
      WHERE lm.league_id = ?
      ORDER BY u.username ASC
    `
    )
    .all(leagueId);

  const standings = members.map((member) => ({
    userId: member.user_id,
    username: member.username,
    points: 0,
    scoringWins: 0
  }));

  const standingsMap = new Map();
  standings.forEach((entry) => standingsMap.set(entry.userId, entry));

  const league = db
    .prepare("SELECT draft_started_at, season_ends_at FROM leagues WHERE id = ?")
    .get(leagueId);

  if (!league || !league.draft_started_at || !league.season_ends_at) {
    return { standings, fights: [] };
  }

  const fights = db
    .prepare(
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
      WHERE f.league_id = ?
        AND f.fight_date >= ?
        AND f.fight_date <= ?
      ORDER BY f.fight_date DESC, f.id DESC
    `
    )
    .all(leagueId, league.draft_started_at, league.season_ends_at)
    .map((fight) => ({
      ...fight,
      was_finish: Number(fight.was_finish) === 1,
      was_five_round_fight: Number(fight.was_five_round_fight) === 1,
      was_championship_fight: Number(fight.was_championship_fight) === 1,
      faced_ranked_fighter: Number(fight.faced_ranked_fighter) === 1,
      vacated_title_for_new_division_title_fight:
        Number(fight.vacated_title_for_new_division_title_fight) === 1
    }));

  const scoredFights = fights.map((fight) => {
    const pointsAwarded = calculateFightPoints(fight);
    const winnerEntry = standingsMap.get(fight.winner_user_id);
    if (winnerEntry) {
      winnerEntry.points += pointsAwarded;
      winnerEntry.scoringWins += 1;
    }

    return {
      ...fight,
      pointsAwardedToWinner: winnerEntry ? pointsAwarded : 0,
      awardedToUser: winnerEntry ? winnerEntry.username : null
    };
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return b.scoringWins - a.scoringWins;
  });

  return {
    standings,
    fights: scoredFights
  };
}

module.exports = {
  calculateFightPoints,
  getLeagueStandings
};
