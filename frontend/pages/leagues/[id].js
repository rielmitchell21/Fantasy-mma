import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { apiRequest, getCurrentUser } from "../../lib/api";

export default function LeaguePage() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leagueData, setLeagueData] = useState(null);
  const [draftFighterId, setDraftFighterId] = useState("");
  const [fighterForm, setFighterForm] = useState({ name: "", weightClass: "", isRanked: false });
  const [fightForm, setFightForm] = useState({
    fightDate: "",
    winnerFighterId: "",
    loserFighterId: "",
    method: "",
    notes: "",
    wasFinish: false,
    wasFiveRoundFight: false,
    wasChampionshipFight: false,
    facedRankedOpponent: false,
    wasTitleMoveFight: false
  });

  async function loadLeague() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const me = await getCurrentUser();
      if (!me) {
        router.replace("/login");
        return;
      }
      setUser(me);

      const data = await apiRequest(`/api/leagues/${id}`);
      setLeagueData(data);

      if (data.availableFighters?.length) {
        setDraftFighterId(String(data.availableFighters[0].id));
      }
      if (data.allUfcFighters?.length > 1) {
        setFightForm((prev) => ({
          ...prev,
          fightDate: new Date().toISOString().slice(0, 10),
          winnerFighterId: String(data.allUfcFighters[0].id),
          loserFighterId: String(data.allUfcFighters[1].id)
        }));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeague();
  }, [id]);

  async function startDraft() {
    setError("");
    try {
      await apiRequest(`/api/leagues/${id}/start-draft`, { method: "POST" });
      await loadLeague();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function makePick(event) {
    event.preventDefault();
    setError("");
    try {
      await apiRequest(`/api/leagues/${id}/draft`, {
        method: "POST",
        body: JSON.stringify({ fighterId: Number(draftFighterId) })
      });
      await loadLeague();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function addFighter(event) {
    event.preventDefault();
    setError("");
    try {
      await apiRequest(`/api/leagues/${id}/fighters`, {
        method: "POST",
        body: JSON.stringify(fighterForm)
      });
      setFighterForm({ name: "", weightClass: "", isRanked: false });
      await loadLeague();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function recordFight(event) {
    event.preventDefault();
    setError("");
    try {
      await apiRequest(`/api/leagues/${id}/fights`, {
        method: "POST",
        body: JSON.stringify({
          ...fightForm,
          winnerFighterId: Number(fightForm.winnerFighterId),
          loserFighterId: Number(fightForm.loserFighterId)
        })
      });
      await loadLeague();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) {
    return (
      <Layout user={user} title="League">
        <p>Loading league...</p>
      </Layout>
    );
  }

  if (!leagueData) {
    return (
      <Layout user={user} title="League">
        <p className="error">{error || "League not found."}</p>
      </Layout>
    );
  }

  const { league, members, myRoster, availableFighters, allUfcFighters, standings, fights, isCommissioner } =
    leagueData;

  return (
    <Layout user={user} title={league.name}>
      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <p>
          Invite code: <strong>{league.invite_code}</strong> | Commissioner:{" "}
          <strong>{league.commissioner_username}</strong>
        </p>
        <p>
          Members: {league.member_count}/{league.max_users} | Roster size: {league.roster_size}
        </p>
        <p>
          Draft start: {league.draft_started_at || "Not started"} | Season end:{" "}
          {league.season_ends_at || "Not set"}
        </p>
        {isCommissioner && !league.draft_started_at ? (
          <button className="button" onClick={startDraft}>
            Start Draft (begins 1-year scoring window)
          </button>
        ) : null}
      </section>

      <div className="grid-two">
        <section className="card">
          <h2>Standings</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>User</th>
                <th>Points</th>
                <th>Scoring Wins</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((item, index) => (
                <tr key={item.userId}>
                  <td>{index + 1}</td>
                  <td>{item.username}</td>
                  <td>{item.points}</td>
                  <td>{item.scoringWins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Members</h2>
          <ul>
            {members.map((member) => (
              <li key={member.id}>
                {member.username} ({member.roster_count}/{league.roster_size})
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid-two">
        <section className="card">
          <h2>
            My Roster ({myRoster.length}/{league.roster_size})
          </h2>
          {!myRoster.length ? (
            <p>No fighters drafted yet.</p>
          ) : (
            <ul>
              {myRoster.map((fighter) => (
                <li key={fighter.id}>
                  {fighter.name} - {fighter.weight_class || "N/A"}
                </li>
              ))}
            </ul>
          )}

          {league.draft_started_at ? (
            <form className="form-grid" onSubmit={makePick}>
              <label>
                Draft fighter
                <select
                  required
                  value={draftFighterId}
                  onChange={(event) => setDraftFighterId(event.target.value)}
                >
                  {availableFighters.map((fighter) => (
                    <option key={fighter.id} value={fighter.id}>
                      {fighter.name} {fighter.is_ranked ? "(Ranked)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" type="submit" disabled={!availableFighters.length}>
                Draft Pick
              </button>
            </form>
          ) : (
            <p>Draft has not started.</p>
          )}
        </section>

        <section className="card">
          <h2>Commissioner Tools</h2>
          {!isCommissioner ? (
            <p>Only commissioner can add fighters and record fights.</p>
          ) : (
            <>
              <h3>Add UFC Fighter</h3>
              <form className="form-grid" onSubmit={addFighter}>
                <label>
                  Fighter name
                  <input
                    required
                    value={fighterForm.name}
                    onChange={(event) => setFighterForm({ ...fighterForm, name: event.target.value })}
                  />
                </label>
                <label>
                  Weight class
                  <input
                    value={fighterForm.weightClass}
                    onChange={(event) =>
                      setFighterForm({ ...fighterForm, weightClass: event.target.value })
                    }
                  />
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fighterForm.isRanked}
                    onChange={(event) =>
                      setFighterForm({ ...fighterForm, isRanked: event.target.checked })
                    }
                  />
                  Ranked fighter
                </label>
                <button className="button secondary" type="submit">
                  Add Fighter
                </button>
              </form>

              <h3>Record Fight</h3>
              <form className="form-grid" onSubmit={recordFight}>
                <label>
                  Date
                  <input
                    required
                    type="date"
                    value={fightForm.fightDate}
                    onChange={(event) => setFightForm({ ...fightForm, fightDate: event.target.value })}
                  />
                </label>
                <label>
                  Winner
                  <select
                    required
                    value={fightForm.winnerFighterId}
                    onChange={(event) =>
                      setFightForm({ ...fightForm, winnerFighterId: event.target.value })
                    }
                  >
                    {allUfcFighters.map((fighter) => (
                      <option key={fighter.id} value={fighter.id}>
                        {fighter.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Loser
                  <select
                    required
                    value={fightForm.loserFighterId}
                    onChange={(event) =>
                      setFightForm({ ...fightForm, loserFighterId: event.target.value })
                    }
                  >
                    {allUfcFighters.map((fighter) => (
                      <option key={fighter.id} value={fighter.id}>
                        {fighter.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Method
                  <input
                    value={fightForm.method}
                    onChange={(event) => setFightForm({ ...fightForm, method: event.target.value })}
                    placeholder="KO/TKO, submission, decision..."
                  />
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasFinish}
                    onChange={(event) => setFightForm({ ...fightForm, wasFinish: event.target.checked })}
                  />
                  Finish (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasFiveRoundFight}
                    onChange={(event) =>
                      setFightForm({ ...fightForm, wasFiveRoundFight: event.target.checked })
                    }
                  />
                  5-round (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasChampionshipFight}
                    onChange={(event) =>
                      setFightForm({ ...fightForm, wasChampionshipFight: event.target.checked })
                    }
                  />
                  Championship (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.facedRankedOpponent}
                    onChange={(event) =>
                      setFightForm({ ...fightForm, facedRankedOpponent: event.target.checked })
                    }
                  />
                  Ranked opponent (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasTitleMoveFight}
                    onChange={(event) =>
                      setFightForm({ ...fightForm, wasTitleMoveFight: event.target.checked })
                    }
                  />
                  Title move (+1)
                </label>
                <label>
                  Notes
                  <textarea
                    rows={3}
                    value={fightForm.notes}
                    onChange={(event) => setFightForm({ ...fightForm, notes: event.target.value })}
                  />
                </label>
                <button className="button" type="submit">
                  Save Fight
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Scored Fights</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Winner</th>
              <th>Loser</th>
              <th>Method</th>
              <th>Points</th>
              <th>Awarded To</th>
            </tr>
          </thead>
          <tbody>
            {fights.map((fight) => (
              <tr key={fight.id}>
                <td>{fight.fight_date}</td>
                <td>{fight.winner_name}</td>
                <td>{fight.loser_name}</td>
                <td>{fight.method || "N/A"}</td>
                <td>{fight.pointsAwardedToWinner}</td>
                <td>{fight.awardedToUser || "No roster owner"}</td>
              </tr>
            ))}
            {!fights.length ? (
              <tr>
                <td colSpan={6}>No scored fights yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </Layout>
  );
}
