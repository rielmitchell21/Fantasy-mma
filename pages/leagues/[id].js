import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { fetchCurrentUser } from "../../lib/client-auth";

export default function LeaguePage() {
  const router = useRouter();
  const leagueId = router.query.id;

  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
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

  async function loadData() {
    if (!leagueId) return;
    setLoading(true);
    setError("");
    const me = await fetchCurrentUser();
    if (!me) {
      window.location.href = "/login";
      return;
    }
    setUser(me);

    const response = await fetch(`/api/leagues/${leagueId}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Failed to load league.");
      setLoading(false);
      return;
    }
    setData(payload);
    if (payload.availableFighters?.length) {
      setDraftFighterId(String(payload.availableFighters[0].id));
    }
    if (payload.allUfcFighters?.length > 1) {
      setFightForm((prev) => ({
        ...prev,
        fightDate: new Date().toISOString().slice(0, 10),
        winnerFighterId: String(payload.allUfcFighters[0].id),
        loserFighterId: String(payload.allUfcFighters[1].id)
      }));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [leagueId]);

  async function startDraft() {
    setError("");
    const response = await fetch(`/api/leagues/${leagueId}/start-draft`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Failed to start draft.");
      return;
    }
    await loadData();
  }

  async function makeDraftPick(e) {
    e.preventDefault();
    setError("");
    const response = await fetch(`/api/leagues/${leagueId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fighterId: Number(draftFighterId) })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Draft pick failed.");
      return;
    }
    await loadData();
  }

  async function addFighter(e) {
    e.preventDefault();
    setError("");
    const response = await fetch(`/api/leagues/${leagueId}/fighters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fighterForm)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Failed to add fighter.");
      return;
    }
    setFighterForm({ name: "", weightClass: "", isRanked: false });
    await loadData();
  }

  async function addFight(e) {
    e.preventDefault();
    setError("");
    const response = await fetch(`/api/leagues/${leagueId}/fights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fightForm,
        winnerFighterId: Number(fightForm.winnerFighterId),
        loserFighterId: Number(fightForm.loserFighterId)
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Failed to record fight.");
      return;
    }
    await loadData();
  }

  if (loading) {
    return (
      <Layout user={user} title="League">
        <p>Loading...</p>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout user={user} title="League">
        <p className="error">{error || "League not found."}</p>
      </Layout>
    );
  }

  const { league, members, myRoster, availableFighters, allUfcFighters, standings, fights, isCommissioner } =
    data;

  return (
    <Layout user={user} title={league.name}>
      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <p>
          Invite: <strong>{league.invite_code}</strong> | Commissioner:{" "}
          <strong>{league.commissioner_username}</strong>
        </p>
        <p>
          Members: {league.member_count}/{league.max_users} | Roster size: {league.roster_size}
        </p>
        <p>
          Draft started: {league.draft_started_at || "No"} | Season ends:{" "}
          {league.season_ends_at || "Not set"}
        </p>
        {isCommissioner && !league.draft_started_at ? (
          <button className="button" onClick={startDraft}>
            Start Draft (starts 1-year scoring season)
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
              {standings.map((row, index) => (
                <tr key={row.userId}>
                  <td>{index + 1}</td>
                  <td>{row.username}</td>
                  <td>{row.points}</td>
                  <td>{row.scoringWins}</td>
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
          <ul>
            {myRoster.map((fighter) => (
              <li key={fighter.id}>
                {fighter.name} - {fighter.weight_class || "N/A"}
              </li>
            ))}
          </ul>
          {league.draft_started_at ? (
            <form className="form-grid" onSubmit={makeDraftPick}>
              <label>
                Draft fighter
                <select
                  value={draftFighterId}
                  onChange={(e) => setDraftFighterId(e.target.value)}
                  required
                >
                  {availableFighters.map((fighter) => (
                    <option key={fighter.id} value={fighter.id}>
                      {fighter.name}
                      {fighter.is_ranked ? " (Ranked)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" type="submit" disabled={!availableFighters.length}>
                Draft
              </button>
            </form>
          ) : (
            <p>Draft has not started yet.</p>
          )}
        </section>

        <section className="card">
          <h2>Commissioner Tools</h2>
          {!isCommissioner ? (
            <p>Only commissioner can add fighters and record fights.</p>
          ) : (
            <>
              <h3>Add UFC Fighter</h3>
              <form onSubmit={addFighter} className="form-grid">
                <label>
                  Name
                  <input
                    required
                    value={fighterForm.name}
                    onChange={(e) => setFighterForm({ ...fighterForm, name: e.target.value })}
                  />
                </label>
                <label>
                  Weight class
                  <input
                    value={fighterForm.weightClass}
                    onChange={(e) =>
                      setFighterForm({ ...fighterForm, weightClass: e.target.value })
                    }
                  />
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fighterForm.isRanked}
                    onChange={(e) => setFighterForm({ ...fighterForm, isRanked: e.target.checked })}
                  />
                  Ranked fighter
                </label>
                <button className="button secondary" type="submit">
                  Add Fighter
                </button>
              </form>

              <h3>Record Fight</h3>
              <form onSubmit={addFight} className="form-grid">
                <label>
                  Fight date
                  <input
                    type="date"
                    required
                    value={fightForm.fightDate}
                    onChange={(e) => setFightForm({ ...fightForm, fightDate: e.target.value })}
                  />
                </label>
                <label>
                  Winner
                  <select
                    value={fightForm.winnerFighterId}
                    onChange={(e) => setFightForm({ ...fightForm, winnerFighterId: e.target.value })}
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
                    value={fightForm.loserFighterId}
                    onChange={(e) => setFightForm({ ...fightForm, loserFighterId: e.target.value })}
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
                    onChange={(e) => setFightForm({ ...fightForm, method: e.target.value })}
                    placeholder="KO/TKO, submission, decision..."
                  />
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasFinish}
                    onChange={(e) => setFightForm({ ...fightForm, wasFinish: e.target.checked })}
                  />
                  Finish (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasFiveRoundFight}
                    onChange={(e) =>
                      setFightForm({ ...fightForm, wasFiveRoundFight: e.target.checked })
                    }
                  />
                  5-round fight (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasChampionshipFight}
                    onChange={(e) =>
                      setFightForm({ ...fightForm, wasChampionshipFight: e.target.checked })
                    }
                  />
                  Championship fight (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.facedRankedOpponent}
                    onChange={(e) =>
                      setFightForm({ ...fightForm, facedRankedOpponent: e.target.checked })
                    }
                  />
                  Ranked opponent (+1)
                </label>
                <label className="inline-row">
                  <input
                    type="checkbox"
                    checked={fightForm.wasTitleMoveFight}
                    onChange={(e) =>
                      setFightForm({ ...fightForm, wasTitleMoveFight: e.target.checked })
                    }
                  />
                  Title move fight (+1)
                </label>
                <label>
                  Notes
                  <textarea
                    rows={3}
                    value={fightForm.notes}
                    onChange={(e) => setFightForm({ ...fightForm, notes: e.target.value })}
                  />
                </label>
                <button className="button" type="submit">
                  Record Fight
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
                <td colSpan={6}>No fights scored yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </Layout>
  );
}
