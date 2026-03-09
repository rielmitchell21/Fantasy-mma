import Link from "next/link";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fetchCurrentUser } from "../lib/client-auth";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    maxUsers: 10,
    rosterSize: 15
  });
  const [joinCode, setJoinCode] = useState("");

  async function loadData() {
    const me = await fetchCurrentUser();
    if (!me) {
      window.location.href = "/login";
      return;
    }
    setUser(me);

    const response = await fetch("/api/leagues");
    const data = await response.json();
    if (response.ok) {
      setLeagues(data.leagues || []);
      return;
    }
    setError(data.error || "Failed to load dashboard.");
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createLeague(e) {
    e.preventDefault();
    setError("");
    const response = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm)
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to create league.");
      return;
    }
    window.location.href = `/leagues/${data.leagueId}`;
  }

  async function joinLeague(e) {
    e.preventDefault();
    setError("");
    const response = await fetch("/api/leagues/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: joinCode })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to join league.");
      return;
    }
    window.location.href = `/leagues/${data.leagueId}`;
  }

  return (
    <Layout user={user} title="Dashboard">
      {error ? <p className="error">{error}</p> : null}
      <div className="grid-two">
        <section className="card">
          <h2>Create League</h2>
          <form onSubmit={createLeague} className="form-grid">
            <label>
              League Name
              <input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </label>
            <label>
              Max Users (5-10)
              <input
                required
                type="number"
                min={5}
                max={10}
                value={createForm.maxUsers}
                onChange={(e) => setCreateForm({ ...createForm, maxUsers: Number(e.target.value) })}
              />
            </label>
            <label>
              Roster Size (15-20)
              <input
                required
                type="number"
                min={15}
                max={20}
                value={createForm.rosterSize}
                onChange={(e) =>
                  setCreateForm({ ...createForm, rosterSize: Number(e.target.value) })
                }
              />
            </label>
            <button type="submit" className="button">
              Create
            </button>
          </form>
        </section>
        <section className="card">
          <h2>Join League</h2>
          <form onSubmit={joinLeague} className="form-grid">
            <label>
              Invite Code
              <input
                required
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </label>
            <button type="submit" className="button">
              Join
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>Your Leagues</h2>
        {leagues.length === 0 ? (
          <p>You are not in any leagues yet.</p>
        ) : (
          <div className="league-list">
            {leagues.map((league) => (
              <Link key={league.id} href={`/leagues/${league.id}`} className="league-item">
                <strong>{league.name}</strong>
                <span>Invite: {league.invite_code}</span>
                <span>
                  Members: {league.member_count}/{league.max_users}
                </span>
                <span>
                  Roster Size: {league.roster_size} | Draft:{" "}
                  {league.draft_started_at ? "Started" : "Not started"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
