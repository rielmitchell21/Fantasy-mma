import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fetchCurrentUser } from "../lib/client-auth";

export default function SignupPage() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCurrentUser().then((me) => {
      if (me) window.location.href = "/dashboard";
      setUser(me);
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Signup failed.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <Layout user={user} title="Sign Up">
      <section className="card narrow">
        {error ? <p className="error">{error}</p> : null}
        <form onSubmit={submit} className="form-grid">
          <label>
            Username
            <input
              required
              minLength={3}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <button className="button" type="submit">
            Create Account
          </button>
        </form>
      </section>
    </Layout>
  );
}
