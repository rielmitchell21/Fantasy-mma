import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fetchCurrentUser } from "../lib/client-auth";

export default function LoginPage() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ identifier: "", password: "" });
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
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Login failed.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <Layout user={user} title="Login">
      <section className="card narrow">
        {error ? <p className="error">{error}</p> : null}
        <form onSubmit={submit} className="form-grid">
          <label>
            Username or Email
            <input
              required
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <button className="button" type="submit">
            Login
          </button>
        </form>
      </section>
    </Layout>
  );
}
