import Link from "next/link";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fetchCurrentUser } from "../lib/client-auth";

export default function HomePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser);
  }, []);

  return (
    <Layout user={user} title="Fantasy UFC MVP">
      <section className="card">
        <h2>Rules in this MVP</h2>
        <ul>
          <li>5-10 users per league</li>
          <li>15-20 fighters per user roster</li>
          <li>Only UFC roster fighters can be drafted/scored</li>
          <li>No fights before draft start count</li>
          <li>Season lasts one year from draft start</li>
          <li>Max 6 points per winning fighter per fight</li>
        </ul>
      </section>

      <section className="card">
        {!user ? (
          <div className="actions">
            <Link href="/signup" className="button">
              Create Account
            </Link>
            <Link href="/login" className="button secondary">
              Login
            </Link>
          </div>
        ) : (
          <Link href="/dashboard" className="button">
            Go to Dashboard
          </Link>
        )}
      </section>
    </Layout>
  );
}
