function calculateFightPoints(fight) {
  let points = 1;
  if (fight.was_finish) points += 1;
  if (fight.was_five_round_fight) points += 1;
  if (fight.was_championship_fight) points += 1;
  if (fight.faced_ranked_opponent) points += 1;
  if (fight.was_title_move_fight) points += 1;
  return points;
}

module.exports = {
  calculateFightPoints
};
