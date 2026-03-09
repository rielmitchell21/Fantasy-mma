import Link from "next/link";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getCurrentUser } from "../lib/api";

export default function HomePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <Layout user={user} title="Fantasy UFC MVP">
      <section className="card">
        <h2>Complete MVP Features</h2>
        <ul>
          <li>Next.js frontend + Node.js backend + PostgreSQL</li>
          <li>User authentication (signup, login, logout)</li>
          <li>Leagues with 5-10 users</li>
          <li>Draft with 15-20 fighters per user from UFC roster</li>
          <li>Commissioner controls draft start and fight recording</li>
          <li>Scoring max 6 points per winning fighter</li>
        </ul>
      </section>

      <section className="card">
        {!user ? (
          <div className="button-row">
            <Link href="/signup" className="button">
              Create Account
            </Link>
            <Link href="/login" className="button secondary">
              Log In
            </Link>
          </div>
        ) : (
          <Link href="/dashboard" className="button">
            Open Dashboard
          </Link>
        )}
      </section>
    </Layout>
  );
}
