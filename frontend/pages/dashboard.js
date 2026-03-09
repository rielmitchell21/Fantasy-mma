import Link from "next/link";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { apiRequest, getCurrentUser } from "../lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    maxUsers: 10,
    rosterSize: 15
  });
  const [inviteCode, setInviteCode] = useState("");

  async function loadDashboard() {
    const me = await getCurrentUser();
    if (!me) {
      window.location.href = "/login";
      return;
    }
    setUser(me);

    try {
      const data = await apiRequest("/api/leagues");
      setLeagues(data.leagues || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function createLeague(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await apiRequest("/api/leagues", {
        method: "POST",
        body: JSON.stringify(createForm)
      });
      window.location.href = `/leagues/${data.leagueId}`;
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function joinLeague(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await apiRequest("/api/leagues/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode })
      });
      window.location.href = `/leagues/${data.leagueId}`;
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <Layout user={user} title="Dashboard">
      {error ? <p className="error">{error}</p> : null}

      <div className="grid-two">
        <section className="card">
          <h2>Create League</h2>
          <form className="form-grid" onSubmit={createLeague}>
            <label>
              League name
              <input
                required
                value={createForm.name}
                onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
              />
            </label>
            <label>
              Max users (5-10)
              <input
                required
                type="number"
                min={5}
                max={10}
                value={createForm.maxUsers}
                onChange={(event) =>
                  setCreateForm({ ...createForm, maxUsers: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Roster size (15-20)
              <input
                required
                type="number"
                min={15}
                max={20}
                value={createForm.rosterSize}
                onChange={(event) =>
                  setCreateForm({ ...createForm, rosterSize: Number(event.target.value) })
                }
              />
            </label>
            <button className="button" type="submit">
              Create League
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Join League</h2>
          <form className="form-grid" onSubmit={joinLeague}>
            <label>
              Invite code
              <input
                required
                maxLength={6}
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              />
            </label>
            <button className="button" type="submit">
              Join League
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>Your leagues</h2>
        {!leagues.length ? (
          <p>You have not joined any leagues yet.</p>
        ) : (
          <div className="league-list">
            {leagues.map((league) => (
              <Link key={league.id} href={`/leagues/${league.id}`} className="league-item">
                <strong>{league.name}</strong>
                <span>Invite: {league.invite_code}</span>
                <span>
                  Members: {league.member_count}/{league.max_users}
                </span>
                <span>Roster size: {league.roster_size}</span>
                <span>Draft: {league.draft_started_at ? "Started" : "Not started"}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
